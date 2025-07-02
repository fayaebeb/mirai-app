import bcrypt from 'bcrypt';
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express, Request, Response, NextFunction } from "express";
import session from "express-session";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { storage } from "./storage";
import { User as SelectUser, users } from "@shared/schema";

import rateLimit from "express-rate-limit";
import { authRateLimit, bruteForce, handleValidationErrors, validateLogin, validateRegistration } from './security';
import { db } from './db';
import { eq } from 'drizzle-orm';
import { verifyTurnstile } from './utils/verifyTurnstile';

declare global {
  namespace Express {
    interface User extends SelectUser { }
  }
}

const SALT_ROUNDS = 12;
const scryptAsync = promisify(scrypt);

// async function hashPassword(password: string) {
//   const salt = randomBytes(16).toString("hex");
//   const buf = (await scryptAsync(password, salt, 64)) as Buffer;
//   return `${buf.toString("hex")}.${salt}`;
// }

// async function comparePasswords(supplied: string, stored: string) {
//   const [hashed, salt] = stored.split(".");
//   const hashedBuf = Buffer.from(hashed, "hex");
//   const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
//   return timingSafeEqual(hashedBuf, suppliedBuf);
// }

async function generateUniqueUsername(base: string): Promise<string> {
  let candidate = base;
  let suffix = 1;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const exists = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.username, candidate))
      .limit(1);

    if (exists.length === 0) return candidate;

    candidate = `${base}${suffix}`;
    suffix += 1;
  }
}

export async function hashPassword(password: string): Promise<string> {
  return await bcrypt.hash(password, SALT_ROUNDS);
}

// Legacy scrypt password comparison
async function compareScryptPasswords(supplied: string, stored: string): Promise<boolean> {
  try {
    const [hashed, salt] = stored.split(".");
    if (!hashed || !salt) return false;

    const hashedBuf = Buffer.from(hashed, "hex");
    const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
    return timingSafeEqual(hashedBuf, suppliedBuf);
  } catch (error) {
    console.error("Error comparing scrypt passwords:", error);
    return false;
  }
}

// Hybrid password comparison that handles both bcrypt and legacy scrypt
export async function comparePasswords(supplied: string, stored: string): Promise<boolean> {
  // Check if it's a bcrypt hash (starts with $2b$)
  if (stored.startsWith('$2b$')) {
    return await bcrypt.compare(supplied, stored);
  }

  // Check if it's a legacy scrypt hash (contains a dot separator)
  if (stored.includes('.')) {
    return await compareScryptPasswords(supplied, stored);
  }

  // Unknown format
  console.error("Unknown password hash format:", stored.substring(0, 10) + "...");
  return false;
}

export function setupAuth(app: Express) {
  const isProduction = process.env.NODE_ENV === 'production';

  console.log('Auth setup - Environment:', isProduction ? 'Production' : 'Development');

  const sessionSettings: session.SessionOptions = {
    secret: process.env.SESSION_SECRET!,
    resave: false,
    saveUninitialized: false,
    store: storage.sessionStore,
    name: 'mirai.sid',
    cookie: {
      maxAge: 24 * 60 * 60 * 1000, // 7 days
      secure: isProduction,
      httpOnly: true,
      sameSite: isProduction ? 'strict' : 'lax',
    },
    rolling: true,
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
    new LocalStrategy({
      usernameField: "email",
    }, async (email, password, done) => {
      try {
        console.log(`Auth - Login attempt for user: ${email}`);
        const user = await storage.getUserByEmail(email);
        if (!user) {
          console.log(`Auth - User not found: ${email}`);
          return done(null, false);
        }

        const passwordValid = await comparePasswords(password, user.password);
        if (!passwordValid) {
          console.log(`Auth - Invalid password for user: ${email}`);
          return done(null, false);
        }
        console.log(`Auth - Login successful for user: ${email}`);
        return done(null, user);
      } catch (error) {
        console.error(`Auth - Login error for ${email}:`, error);
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
      console.error(`Auth - Deserialization error:`, error);
      done(error);
    }
  });

  app.post("/api/register",
    authRateLimit,
    verifyTurnstile,
    validateRegistration,
    handleValidationErrors,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        console.log(`Auth - Register attempt: ${req.body.email}`);
        const existingUser = await storage.getUserByEmail(req.body.email);
        if (existingUser) {
          console.log(`Auth - Registration failed: ${req.body.email} already exists`);
          return res.status(409).json({
            error: "このユーザー名は既に使用されています。"
          });
        }

        const { email, password, inviteToken } = req.body as {
          email: string;
          password: string;
          inviteToken?: string;
        };

        if (!inviteToken) {
          return res.status(400).json({ error: "招待トークンが必要です。" });
        }

        const tokenRecord = await storage.getInviteToken(inviteToken);
        if (!tokenRecord || !tokenRecord.isValid || tokenRecord.usedById) {
          return res.status(400).json({ error: "無効なまたは使用済みの招待トークンです。" });
        }

        const baseUsername = email.split('@')[0];
        const username = await generateUniqueUsername(baseUsername);

        const user = await storage.createUser({
          ...req.body,
          username: username,
          password: await hashPassword(password),
        });

        if (inviteToken && user?.id) {
          const tokenRecord = await storage.getInviteToken(inviteToken);
          if (tokenRecord) {
            await storage.useInviteToken(tokenRecord.id, user.id);
          }
        }

        console.log(`Auth - User registered: ${user.email}`);
        req.login(user, async (err: any) => {
          if (err) {
            console.error(`Auth - Login after registration failed for ${user.email}:`, err);
            return next(err);
          }
          console.log(`Auth - User logged in after registration: ${user.email}`);
          await storage.stampInitialLogin(user.id);
          user.initialLoginAt = new Date();
          const { password, ...userResponse } = user;
          (userResponse as any).needsOnboarding = true;
          res.status(201).json(userResponse);
        });
      } catch (error) {
        console.error(`Auth - Registration error:`, error);
        res.status(500).json({
          error: "ユーザー登録に失敗しました。"
        });
      }
    });

  app.post("/api/login",
    authRateLimit,
    bruteForce.prevent,
    verifyTurnstile,
    validateLogin,
    handleValidationErrors,
    (req: Request, res: Response, next: NextFunction) => {
      passport.authenticate(
        "local",
        async (err: Error | null, user: Express.User | false | null, info: { message: string } | undefined) => {
          if (err) {
            console.error("Auth - Login error:", err);
            return res.status(500).json({ error: "ログイン処理中にエラーが発生しました。" });
          }
          if (!user) {
            console.log("Auth - Login failed for:", req.body.email);

            // const userExists = await storage.getUserByUsername(req.body.username);

            return res.status(401).json({
              error: "ユーザー名またはパスワードが正しくありません。"
            });
          }

          // req.login(user, (loginErr) => {
          //   if (loginErr) {
          //     return res.status(500).json({ error: "セッションの作成に失敗しました。" });
          //   }
          //   res.status(200).json({ id: user.id, username: user.username });
          // });

          const userData = user;

          let needsOnboarding = !userData.onboardingCompletedAt;
          console.log("needsOnBoarding:", needsOnboarding);
          if (!userData.initialLoginAt) {
            await storage.stampInitialLogin(userData.id);
            userData.initialLoginAt = new Date();
            needsOnboarding = true;
          }


          req.session.regenerate((regenerateErr: any) => {
            if (regenerateErr) {
              console.error(`Auth - Session regeneration error:`, regenerateErr);
              return res.status(500).json({
                error: "セッションの作成に失敗しました。"
              });
            }

            // Now login with the new session
            req.login(userData, (loginErr: any) => {
              if (loginErr) {
                console.error(`Auth - Session creation error for ${userData.email}:`, loginErr);
                return res.status(500).json({
                  error: "セッションの作成に失敗しました。"
                });
              }

              console.log(`Auth - Login successful: ${userData.email}`);
              res.status(200).json({ id: user.id, email: user.email, username: user.username, needsOnboarding: needsOnboarding });
            });
          });
        }
      )(req, res, next);
    });

  // app.post("/api/logout", (req, res, next) => {
  //   req.logout((err) => {
  //     if (err) return next(err);
  //     res.sendStatus(200);
  //   });
  // });

  app.post("/api/logout", (req, res, next) => {
    const email = req.user?.email;
    console.log(`Auth - Logout attempt: ${email || 'Unknown user'}`);

    req.logout((err) => {
      if (err) {
        console.error(`Auth - Logout error for ${email}:`, err);
        return next(err);
      }

      // Destroy session completely
      req.session.destroy((destroyErr) => {
        if (destroyErr) {
          console.error(`Auth - Session destruction error:`, destroyErr);
          return res.status(500).json({
            error: "ログアウト処理中にエラーが発生しました。"
          });
        }

        console.log(`Auth - Logout successful: ${email}`);
        res.clearCookie('mirai.sid');
        res.sendStatus(200);
      });
    });
  });

  // app.get("/api/user", (req, res) => {
  //   if (!req.isAuthenticated()) return res.sendStatus(401);
  //   res.json({ id: req.user!.id, username: req.user!.username });
  // });

  app.get("/api/user", (req, res) => {
    if (!req.isAuthenticated()) {
      console.log("Auth - Unauthorized /api/user access");
      return res.sendStatus(401);
    }

    console.log(`Auth - Authorized /api/user access: ${req.user?.email}`);
    res.json({ id: req.user!.id, email: req.user!.email, username: req.user!.username, needsOnBoarding: (req.user!.onboardingCompletedAt ? false : true) });
  });

  app.post("/api/onboarding/complete", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    await storage.completeOnboarding(req.user!.id);
    res.sendStatus(204);
  });
}
