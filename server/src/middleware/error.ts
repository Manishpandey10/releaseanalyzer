import type { Request, Response, NextFunction } from "express";
import { errorResponse } from "../lib/response.js";

export function errorMiddleware(err: Error, _req: Request, res: Response, _next: NextFunction) {
  console.error("[Error]", err.message, err.stack);
  res.status(500).json(errorResponse("INTERNAL_ERROR", "An unexpected error occurred"));
}
