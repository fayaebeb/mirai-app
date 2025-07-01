import axios from "axios";
import { Request, Response, NextFunction } from "express";

export async function verifyTurnstile(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const token = req.body?.turnstileToken ?? req.body?.["cf-turnstile-response"];
  if (typeof token !== "string") {
    return res.status(400).json({ error: "Missing CAPTCHA token." });
  }

  const params = new URLSearchParams();
  params.append("secret", process.env.TURNSTILE_SECRET_KEY!);
  params.append("response", token);
  if (req.ip) params.append("remoteip", req.ip);   // only add if defined

  try {
    const { data } = await axios.post(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      params, // ← already url-encoded
      { headers: { "Content-Type": "application/x-www-form-urlencoded" } },
    );
    console.log(data)
    if (data.success) return next();
    return res.status(403).json({ error: "CAPTCHA verification failed", details: data["error-codes"] });
  } catch (e) {
    console.error("Turnstile error", e);
    return res.status(500).json({ error: "CAPTCHA verification error" });
  }
}
