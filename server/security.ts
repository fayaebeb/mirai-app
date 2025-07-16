import { Express, Request, Response, NextFunction } from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import slowDown from "express-slow-down";
import ExpressBrute from "express-brute";
import { body, validationResult } from "express-validator";
import cors from "cors";

// Rate limiting configuration
const createRateLimit = (windowMs: number, max: number, message: string) => {
  return rateLimit({
    windowMs,
    max,
    message: { error: message },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req: Request, res: Response) => {
      console.log(`Rate limit exceeded for IP: ${req.ip} on ${req.path}`);
      res.status(429).json({ error: message });
    },
  });
};

// Brute force protection for authentication endpoints
const createBruteForce = () => {
  const store = new ExpressBrute.MemoryStore();
  return new ExpressBrute(store, {
    freeRetries: 3,
    minWait: 5 * 60 * 1000, // 5 minutes
    maxWait: 60 * 60 * 1000, // 1 hour
    lifetime: 24 * 60 * 60, // 24 hours (seconds)
    failCallback: (req: Request, res: Response, next: NextFunction) => {
      console.log(`Brute force protection triggered for IP: ${req.ip}`);
      res.status(429).json({
        error: "Too many failed attempts. Please try again later.",
      });
    },
  });
};

// Input validation middleware
export const validateRegistration = [
  body("email")
    .notEmpty()
    .withMessage("Email is required")
    .isEmail()
    .withMessage("Invalid email format")
    .normalizeEmail()
    .escape(),
  body("password")
    .isLength({ min: 8, max: 128 })
    .withMessage("Password must be between 8 and 128 characters")
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage("Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character"),
];

export const validateLogin = [
  body("email")
    .notEmpty()
    .withMessage("Email is required")
    .isEmail()
    .withMessage("Invalid email format")
    .normalizeEmail()
    .escape(),
  body("password")
    .notEmpty()
    .withMessage("Password is required")
    .isLength({ max: 128 })
    .withMessage("Password too long"),
];

export const validateMessage = [
  body("content")
    .isLength({ min: 1, max: 10000 })
    .withMessage("Message must be between 1 and 10000 characters")
    .trim()
    .escape(),
  body("useWeb")
    .optional()
    .isBoolean()
    .withMessage("useWeb must be a boolean"),
  body("useDb")
    .optional()
    .isBoolean()
    .withMessage("useDb must be a boolean"),
  body("chatId")
    .exists().withMessage("chatId is required")
    .bail()
    .isInt({ gt: 0 }).withMessage("chatId must be a positive integer")
    .toInt(),
  body("dbType")
    .optional()
    .isIn([
      "db1",
      "db2",
      "db3",
      "regular",
    ])
    .withMessage(
      "dbType must be one of: db1, db2, db3, regular"
    ),
];

export const validateFeedback = [
  body("comment")
    .isLength({ min: 1, max: 1000 })
    .withMessage("Comment must be between 1 and 1000 characters")
    .trim()
    .escape(),
  body("rating")
    .isInt({ min: 1, max: 5 })
    .withMessage("Rating must be between 1 and 5"),
  body("messageId")
    .optional()
    .isInt()
    .withMessage("Invalid message ID"),
];

export const validatePasswordChange = [
  body("oldPassword")
    .notEmpty()
    .withMessage("Old password is required")
    .isLength({ max: 128 })
    .withMessage("Password too long"),
  body("newPassword")
    .notEmpty()
    .withMessage("New password is required")
    .isLength({ min: 8, max: 128 })
    .withMessage("Password must be between 8 and 128 characters")
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/)
    .withMessage("Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character"),
];

// Validation error handler
export const handleValidationErrors = (req: Request, res: Response, next: NextFunction) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    console.log(`Validation errors for ${req.path}:`, errors.array());
    return res.status(400).json({
      error: "Validation failed",
      details: errors.array().map(err => err.msg),
    });
  }
  next();
};

// Security headers and CORS configuration
export function setupSecurity(app: Express) {
  const isProduction = process.env.NODE_ENV === "production";

  // Helmet for security headers (disable CSP in development)
  if (isProduction) {
    app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
          fontSrc: ["'self'", "https://fonts.gstatic.com"],
          imgSrc: ["'self'", "data:", "https:"],
          scriptSrc: ["'self'", "https://challenges.cloudflare.com"],
          connectSrc: ["'self'", "wss:", "https://skapi-qkrap.ondigitalocean.app"],
          mediaSrc: ["'self'", "blob:"],
          objectSrc: ["'none'"],
          frameSrc: [
            "'self'",
            "https://drive.google.com",
            "https://docs.google.com",
            "https://drive-thirdparty.googleusercontent.com",
            "https://challenges.cloudflare.com",
          ],
        },
      },
      crossOriginEmbedderPolicy: false,
    }));
  } else {
    // Development - use minimal security headers
    app.use(helmet({
      contentSecurityPolicy: false, // Disable CSP in development
      crossOriginEmbedderPolicy: false,
    }));
  }

  // CORS configuration
  app.use(cors({
    origin: isProduction
      ? process.env.ALLOWED_ORIGINS?.split(',') || false
      : true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  }));

  // Global rate limiting
  app.use(createRateLimit(
    15 * 60 * 1000, // 15 minutes
    1000, // requests per window
    "Too many requests from this IP, please try again later."
  ));

  // Slow down repeated requests
  app.use(slowDown({
    windowMs: 15 * 60 * 1000, // 15 minutes
    delayAfter: 500, // allow 500 requests per windowMs without delay
    delayMs: () => 500, // add 500ms delay per request after delayAfter
    maxDelayMs: 20000, // max delay of 20 seconds
    validate: { delayMs: false } // Disable warning
  }));
}

// Authentication-specific rate limiting
export const authRateLimit = createRateLimit(
  15 * 60 * 1000, // 15 minutes
  10, // attempts per window
  "Too many authentication attempts, please try again later."
);

// API-specific rate limiting
export const apiRateLimit = createRateLimit(
  1 * 60 * 1000, // 1 minute
  60, // requests per minute
  "API rate limit exceeded, please slow down."
);

// Chat-specific rate limiting
export const chatRateLimit = createRateLimit(
  1 * 60 * 1000, // 1 minute
  20, // messages per minute
  "Too many messages sent, please wait before sending more."
);

// File upload rate limiting
export const uploadRateLimit = createRateLimit(
  5 * 60 * 1000, // 5 minutes
  10, // uploads per window
  "Too many file uploads, please try again later."
);

// Brute force protection
export const bruteForce = createBruteForce();

// Security logging middleware
export const securityLogger = (req: Request, res: Response, next: NextFunction) => {
  const sensitiveEndpoints = ['/api/login', '/api/register', '/api/chat'];
  const isSensitive = sensitiveEndpoints.some(endpoint => req.path.includes(endpoint));

  if (isSensitive) {
    console.log(`Security: ${req.method} ${req.path} from IP: ${req.ip} User-Agent: ${req.get('User-Agent')}`);
  }

  next();
};

// Input sanitization middleware
export const sanitizeInput = (req: Request, res: Response, next: NextFunction) => {
  // Remove potential XSS patterns
  const sanitizeObject = (obj: any): any => {
    if (typeof obj === 'string') {
      return obj
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/javascript:/gi, '')
        .replace(/on\w+\s*=/gi, '');
    }
    if (typeof obj === 'object' && obj !== null) {
      const sanitized: any = {};
      for (const key in obj) {
        sanitized[key] = sanitizeObject(obj[key]);
      }
      return sanitized;
    }
    return obj;
  };

  if (req.body) {
    req.body = sanitizeObject(req.body);
  }

  next();
};

// Session security middleware
export const sessionSecurity = (req: Request, res: Response, next: NextFunction) => {
  // Add security headers for authenticated routes
  if (req.isAuthenticated && req.isAuthenticated()) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }

  next();
};