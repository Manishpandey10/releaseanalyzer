import type { Request, Response, NextFunction } from "express";
import * as statementService from "../services/statement.service.js";
import { successResponse, errorResponse } from "../lib/response.js";
import { z } from "zod";

export async function approveStatement(req: Request, res: Response, next: NextFunction) {
  try {
    const { id, statementId } = req.params;
    const stmt = await statementService.approveStatement(id!, statementId!);
    if (!stmt) {
      res.status(404).json(errorResponse("NOT_FOUND", "Statement not found"));
      return;
    }
    res.json(successResponse(stmt));
  } catch (err: any) {
    if (err.status) {
      res.status(err.status).json(errorResponse("CONFLICT", err.message));
      return;
    }
    next(err);
  }
}

export async function rejectStatement(req: Request, res: Response, next: NextFunction) {
  try {
    const { id, statementId } = req.params;
    const stmt = await statementService.rejectStatement(id!, statementId!);
    if (!stmt) {
      res.status(404).json(errorResponse("NOT_FOUND", "Statement not found"));
      return;
    }
    res.json(successResponse(stmt));
  } catch (err) {
    next(err);
  }
}

const updateSchema = z.object({
  statement: z.string().min(1)
});

export async function updateStatement(req: Request, res: Response, next: NextFunction) {
  try {
    const { id, statementId } = req.params;
    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json(errorResponse("VALIDATION_ERROR", "Invalid content"));
      return;
    }
    
    const stmt = await statementService.updateStatementContent(id!, statementId!, parsed.data.statement);
    if (!stmt) {
      res.status(404).json(errorResponse("NOT_FOUND", "Statement not found"));
      return;
    }
    res.json(successResponse(stmt));
  } catch (err) {
    next(err);
  }
}

export async function getStatements(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const statements = await statementService.getStatementsByRelease(id!);
    res.json(successResponse(statements));
  } catch (err) {
    next(err);
  }
}

export async function resolveStatement(req: Request, res: Response, next: NextFunction) {
  try {
    const { id, statementId } = req.params;
    const { note } = req.body;
    
    if (typeof note !== "string" || note.length < 5) {
      res.status(400).json(errorResponse("VALIDATION_ERROR", "Note must be at least 5 characters"));
      return;
    }

    const stmt = await statementService.resolveStatement(id!, statementId!, note);
    if (!stmt) {
      res.status(404).json(errorResponse("NOT_FOUND", "Statement not found"));
      return;
    }
    res.json(successResponse(stmt));
  } catch (err: any) {
    if (err.status) {
      res.status(err.status).json(errorResponse("CONFLICT", err.message));
      return;
    }
    next(err);
  }
}
