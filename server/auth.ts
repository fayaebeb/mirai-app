import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express } from "express";
import session from "express-session";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { storage } from "./storage";
import { User as SelectUser } from "@shared/schema";

import rateLimit from "express-rate-limit";

declare global {
  namespace Express {
    interface User extends SelectUser {}
  }
}

const scryptAsync = promisify(scrypt);

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

async function comparePasswords(supplied: string, stored: string) {
  const [hashed, salt] = stored.split(".");
  const hashedBuf = Buffer.from(hashed, "hex");
  const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
  return timingSafeEqual(hashedBuf, suppliedBuf);
}

export function setupAuth(app: Express) {
  const sessionSecret = process.env.SESSION_SECRET || (() => {throw new Error('SESSION_SECRET must be set')})();

  const isProduction = process.env.NODE_ENV === 'production';
  console.log('Auth setup - Environment:', isProduction ? 'Production' : 'Development');

  const sessionSettings: session.SessionOptions = {
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    store: storage.sessionStore,
    cookie: {
      maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
      secure: true,
      httpOnly: true,
      sameSite: 'strict',
    }
  };

  app.set("trust proxy", 1);
  app.use(session(sessionSettings));
  app.use(passport.initialize());
  app.use(passport.session());

  const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5
  });

  passport.use(
    new LocalStrategy(async (username, password, done) => {
      try {
        console.log(`Auth - Login attempt`);
        const user = await storage.getUserByUsername(username);
        if (!user) {
          return done(null, false);
        }
        const passwordValid = await comparePasswords(password, user.password);
        if (!passwordValid) {
          return done(null, false);
        }
        console.log(`Auth - Login successful`);
        return done(null, user);
      } catch (error) {
        console.error(`Auth - Login error:`, error);
        return done(error);
      }
    }),
  );

  passport.serializeUser((user, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id: number, done) => {
    try {
      const user = await storage.getUser(id);
      if (!user) return done(null, false);
      done(null, user);
    } catch (error) {
      console.error(`Auth - Deserialization error:`, error);
      done(error);
    }
  });

  app.post("/api/register", async (req, res, next) => {
    try {
      const existingUser = await storage.getUserByUsername(req.body.username);
      if (existingUser) {
        return res.status(400).send("Username already exists");
      }
      const user = await storage.createUser({
        ...req.body,
        password: await hashPassword(req.body.password),
      });
      req.login(user, (err) => {
        if (err) return next(err);
        res.status(201).json({ id: user.id, username: user.username });
      });
    } catch (error) {
      console.error(`Auth - Registration error:`, error);
      res.status(500).send("Registration failed");
    }
  });

  app.post("/api/login", loginLimiter, (req, res, next) => {
    passport.authenticate(
      "local",
      async (err: Error | null, user: Express.User | false | null) => {
        if (err) {
          return res.status(500).json({ error: "ログイン処理中にエラーが発生しました。" });
        }

        if (!user) {
          const userExists = await storage.getUserByUsername(req.body.username);
          if (!userExists) {
            return res.status(401).json({ error: "メールアドレスが見つかりません。" });
          }
          return res.status(401).json({ error: "パスワードが正しくありません。" });
        }

        req.login(user, (loginErr) => {
          if (loginErr) {
            return res.status(500).json({ error: "セッションの作成に失敗しました。" });
          }
          res.status(200).json({ id: user.id, username: user.username });
        });
      }
    )(req, res, next);
  });

  app.post("/api/logout", (req, res, next) => {
    req.logout((err) => {
      if (err) return next(err);
      res.sendStatus(200);
    });
  });

  app.get("/api/user", (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    res.json({ id: req.user!.id, username: req.user!.username });
  });
}
