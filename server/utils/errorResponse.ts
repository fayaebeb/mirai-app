// utils/errorResponse.ts
import { Response } from "express";

export function sendError(
  res: Response,
  statusCode: number,
  message: string,
  details?: any
) {
  return res.status(statusCode).json({
    success: false,
    message,
    ...(details ? { details } : {})
  });
}

export function getPersistentSessionId(email: string): string {
  return email.split("@")[0];
}