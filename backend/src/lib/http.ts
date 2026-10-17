import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { z, ZodError } from "zod";
import { AuditLog } from "../models.js";

export type AuthUser = { id: string; role: "admin" | "analyst" | "viewer"; email: string };
declare global {
  namespace Express {
    interface Request { user?: AuthUser }
  }
}

export function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>) {
  return (req: Request, res: Response, next: NextFunction) => Promise.resolve(fn(req, res, next)).catch(next);
}

export function authenticate(req: Request, res: Response, next: NextFunction) {
  const header = req.header("authorization");
  if (!header?.startsWith("Bearer ")) return res.status(401).json({ success: false, error: "Authentication required" });
  try {
    const secret = process.env.JWT_SECRET;
    if (!secret) throw new Error("JWT_SECRET missing");
    req.user = jwt.verify(header.slice(7), secret) as AuthUser;
    next();
  } catch {
    return res.status(401).json({ success: false, error: "Invalid or expired token" });
  }
}

export function allowRoles(...roles: AuthUser["role"][]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) return res.status(403).json({ success: false, error: "Insufficient permissions" });
    next();
  };
}

export function validate(schema: z.ZodTypeAny, source: "body" | "query" | "params" = "body") {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) return res.status(400).json({ success: false, error: "Validation failed", details: result.error.flatten() });
    if (source === "body") req.body = result.data;
    next();
  };
}

export async function audit(actor: string | undefined, action: string, entityType: string, entityId: string, metadata: Record<string, unknown> = {}) {
  await AuditLog.create({ actor: actor || null, action, entityType, entityId, metadata });
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ZodError) return res.status(400).json({ success: false, error: "Validation failed", details: err.flatten() });
  const e = err as { status?: number; message?: string; code?: number };
  if (e.code === 11000) return res.status(409).json({ success: false, error: "A record with this value already exists" });
  const status = e.status || 500;
  const message = process.env.NODE_ENV === "production" ? "Internal server error" : (e.message || "Unknown error");
  if (status >= 500) console.error(err);
  return res.status(status).json({ success: false, error: message });
}
