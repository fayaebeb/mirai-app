import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express } from "express";
import session from "express-session";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { storage } from "./storage";
import { User as SelectUser } from "@shared/schema";

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
  // Use a default session secret if none is provided
  const sessionSecret = process.env.SESSION_SECRET || 'sakura-ai-default-session-secret';
  
  const isProduction = process.env.NODE_ENV === 'production';
  console.log('Auth setup - Environment:', isProduction ? 'Production' : 'Development');
  
  const sessionSettings: session.SessionOptions = {
    secret: process.env.SESSION_SECRET!,
    resave: false,
    saveUninitialized: false,
    store: storage.sessionStore,
    cookie: {
      maxAge: 365 * 24 * 60 * 60 * 1000, // 1 year
      secure: process.env.NODE_ENV === 'production'
    }
  };

  app.set("trust proxy", 1);
  app.use(session(sessionSettings));
  app.use(passport.initialize());
  app.use(passport.session());

  passport.use(
    new LocalStrategy(async (username, password, done) => {
      try {
        console.log(`Auth - Login attempt for user: ${username}`);
        const user = await storage.getUserByUsername(username);
        
        if (!user) {
          console.log(`Auth - User not found: ${username}`);
          return done(null, false);
        }
        
        const passwordValid = await comparePasswords(password, user.password);
        if (!passwordValid) {
          console.log(`Auth - Invalid password for user: ${username}`);
          return done(null, false);
        }
        
        console.log(`Auth - Login successful for user: ${username}`);
        return done(null, user);
      } catch (error) {
        console.error(`Auth - Login error for ${username}:`, error);
        return done(error);
      }
    }),
  );

  passport.serializeUser((user, done) => {
    console.log(`Auth - Serializing user: ${user.id}`);
    done(null, user.id);
  });
  
  passport.deserializeUser(async (id: number, done) => {
    try {
      console.log(`Auth - Deserializing user: ${id}`);
      const user = await storage.getUser(id);
      if (!user) {
        console.log(`Auth - User not found during deserialization: ${id}`);
        return done(null, false);
      }
      done(null, user);
    } catch (error) {
      console.error(`Auth - Deserialization error for ${id}:`, error);
      done(error);
    }
  });

  app.post("/api/register", async (req, res, next) => {
    try {
      console.log(`Auth - Register attempt: ${req.body.username}`);
      const existingUser = await storage.getUserByUsername(req.body.username);
      if (existingUser) {
        console.log(`Auth - Registration failed: ${req.body.username} already exists`);
        return res.status(400).send("Username already exists");
      }

      const user = await storage.createUser({
        ...req.body,
        password: await hashPassword(req.body.password),
      });

      console.log(`Auth - User registered: ${user.username}`);
      req.login(user, (err) => {
        if (err) {
          console.error(`Auth - Login after registration failed for ${user.username}:`, err);
          return next(err);
        }
        console.log(`Auth - User logged in after registration: ${user.username}`);
        res.status(201).json(user);
      });
    } catch (error) {
      console.error(`Auth - Registration error:`, error);
      res.status(500).send("Registration failed");
    }
  });

  app.post("/api/login", (req, res, next) => {
    passport.authenticate("local", async (err: Error | null, user: Express.User | false | null, info: { message: string } | undefined) => {
      if (err) {
        console.error("Auth - Login error:", err);
        return res.status(500).json({ 
          error: "ログイン処理中にエラーが発生しました。" 
        });
      }

      if (!user) {
        // Check if user exists to provide more specific error
        const userExists = await storage.getUserByUsername(req.body.username);
        if (!userExists) {
          console.log("Auth - Login failed: User not found");
          return res.status(401).json({
            error: "メールアドレスが見つかりません。"
          });
        }

        console.log("Auth - Login failed: Invalid password");
        return res.status(401).json({
          error: "パスワードが正しくありません。"
        });
      }

      req.login(user, (loginErr) => {
        if (loginErr) {
          console.error(`Auth - Session creation error for ${user.username}:`, loginErr);
          return res.status(500).json({
            error: "セッションの作成に失敗しました。"
          });
        }

        console.log(`Auth - Login successful: ${user.username}`);
        res.status(200).json(user);
      });
    })(req, res, next);
  });

  app.post("/api/logout", (req, res, next) => {
    const username = req.user?.username;
    console.log(`Auth - Logout attempt: ${username || 'Unknown user'}`);
    
    req.logout((err) => {
      if (err) {
        console.error(`Auth - Logout error for ${username}:`, err);
        return next(err);
      }
      console.log(`Auth - Logout successful: ${username}`);
      res.sendStatus(200);
    });
  });

  app.get("/api/user", (req, res) => {
    if (!req.isAuthenticated()) {
      console.log("Auth - Unauthorized /api/user access");
      return res.sendStatus(401);
    }
    
    console.log(`Auth - Authorized /api/user access: ${req.user?.username}`);
    res.json(req.user);
  });
}