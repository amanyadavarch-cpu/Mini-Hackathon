import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import routes from "./routes.js";
import { errorHandler } from "./lib/http.js";

export function createApp() {
  const app = express();
  app.disable("x-powered-by");
  app.use(helmet());
  const origins = (process.env.FRONTEND_ORIGIN || "http://localhost:5173").split(",").map(s => s.trim());
  app.use(cors({ origin: origins, credentials: false }));
  app.use(express.json({ limit: "1mb" }));
  app.use(rateLimit({ windowMs: 15 * 60 * 1000, limit: 300, standardHeaders: "draft-7", legacyHeaders: false }));
  app.get("/api/v1/health", (_req, res) => res.json({ success: true, data: { status: "ok", uptime: process.uptime() } }));
  app.get("/api/v1/ready", async (_req, res) => {
    const mongoose = await import("mongoose");
    const ready = mongoose.default.connection.readyState === 1;
    res.status(ready ? 200 : 503).json({ success: ready, data: { database: ready ? "connected" : "disconnected" } });
  });
  app.use("/api/v1", routes);
  app.use((_req, res) => res.status(404).json({ success: false, error: "Route not found" }));
  app.use(errorHandler);
  return app;
}
