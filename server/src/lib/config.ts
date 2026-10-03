import dotenv from "dotenv";
import path from "node:path";

// Load .env from server directory
dotenv.config({ path: path.resolve(import.meta.dirname, "../../.env") });

export const config = {
  port: parseInt(process.env.PORT || "3001", 10),
  databaseUrl: process.env.DATABASE_URL || "",
  nodeEnv: process.env.NODE_ENV || "development",
  geminiApiKey: process.env.GEMINI_API_KEY || "",
  geminiModel: process.env.GEMINI_MODEL || "gemini-3.7-flash",
  geminiFallbackModel: process.env.GEMINI_FALLBACK_MODEL || "",
} as const;
