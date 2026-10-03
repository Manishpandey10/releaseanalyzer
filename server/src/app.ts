import express from "express";
import cors from "cors";
import releaseRoutes from "./routes/release.routes.js";
import { errorMiddleware } from "./middleware/error.js";
import { successResponse } from "./lib/response.js";

export function createApp() {
  const app = express();

  // Middleware
  app.use(cors());
  app.use(express.json());

  // Health check
  app.get("/health", (_req, res) => {
    res.json(successResponse({ status: "ok", timestamp: new Date().toISOString() }));
  });

  // API routes
  app.use("/api/releases", releaseRoutes);

  // Error handler (must be last)
  app.use(errorMiddleware);

  return app;
}
