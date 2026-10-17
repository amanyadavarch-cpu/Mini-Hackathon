import type { Request, Response } from "express";
import mongoose from "mongoose";
import { createApp } from "../src/app.js";
import { connectDatabase } from "../src/config/db.js";

const app = createApp();
let connection: Promise<void> | undefined;

mongoose.connection.on("disconnected", () => {
  connection = undefined;
});

async function ensureDatabaseConnection() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI is not configured");
  if (mongoose.connection.readyState === 1) return;

  if (!connection) {
    connection = connectDatabase(uri).catch((error: unknown) => {
      connection = undefined;
      throw error;
    });
  }

  await connection;
}

export default async function handler(request: Request, response: Response) {
  try {
    await ensureDatabaseConnection();
  } catch (error) {
    console.error("MongoDB connection failed", error);
    return response.status(503).json({ success: false, error: "Database unavailable" });
  }

  return app(request, response);
}
