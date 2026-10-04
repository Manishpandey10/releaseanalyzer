import type { Request, Response, NextFunction } from "express";
import { z, ZodError } from "zod";
import { createReleaseSchema, updateReleaseSchema } from "../validation/release.js";
import * as releaseService from "../services/release.service.js";
import { successResponse, errorResponse } from "../lib/response.js";

export async function createRelease(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = createReleaseSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json(errorResponse("VALIDATION_ERROR", formatZodError(parsed.error)));
      return;
    }

    const release = await releaseService.createRelease(parsed.data);
    res.status(201).json(successResponse(release));
  } catch (err: any) {
    if (err.status === 409) {
      res.status(409).json(errorResponse("CONFLICT", err.message));
      return;
    }
    next(err);
  }
}

export async function getAllReleases(req: Request, res: Response, next: NextFunction) {
  try {
    const releases = await releaseService.getAllReleases();
    res.json(successResponse(releases));
  } catch (err) {
    next(err);
  }
}

export async function getReleaseById(req: Request, res: Response, next: NextFunction) {
  try {
    const release = await releaseService.getReleaseById(req.params.id!);
    if (!release) {
      res.status(404).json(errorResponse("NOT_FOUND", "Release not found"));
      return;
    }
    res.json(successResponse(release));
  } catch (err) {
    next(err);
  }
}

export async function updateRelease(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = updateReleaseSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json(errorResponse("VALIDATION_ERROR", formatZodError(parsed.error)));
      return;
    }

    const release = await releaseService.updateRelease(req.params.id!, parsed.data);
    if (!release) {
      res.status(404).json(errorResponse("NOT_FOUND", "Release not found"));
      return;
    }
    res.json(successResponse(release));
  } catch (err) {
    next(err);
  }
}

function formatZodError(error: ZodError): string {
  return error.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join("; ");
}

export async function validateRelease(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const release = await releaseService.getReleaseById(id!);
    if (!release) {
      res.status(404).json(errorResponse("NOT_FOUND", "Release not found"));
      return;
    }
    const { validateReleasePackage } = await import("../domain/validation.js");
    const result = validateReleasePackage(release.items);
    res.json(successResponse(result));
  } catch (err) {
    next(err);
  }
}

export async function analyzeRelease(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const force = req.body?.force === true;
    // We import dynamically or top level, let's use dynamic import here to avoid circular dependencies just in case, or add to top.
    const aiService = await import("../services/ai.service.js");
    const result = await aiService.analyzeRelease(id!, force);
    res.json(successResponse(result));
    } catch (err: any) {
    if (err.status === 409) {
      res.status(409).json(errorResponse("CONFLICT", err.message));
      return;
    }
    if (err instanceof Error && err.message.includes("Invalid release package")) {
      res.status(400).json(errorResponse("VALIDATION_ERROR", err.message));
      return;
    }
    next(err);
  }
}

export async function getAnalysis(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const aiService = await import("../services/ai.service.js");
    const analysis = await aiService.getAnalysis(id!);
    if (!analysis) {
      res.status(404).json(errorResponse("NOT_FOUND", "Analysis not found"));
      return;
    }
    res.json(successResponse(analysis));
  } catch (err) {
    next(err);
  }
}

export async function finalizeRelease(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const result = await releaseService.finalizeRelease(id!);
    res.json(successResponse(result));
  } catch (err) {
    if (err instanceof Error && err.message === "Cannot finalize release." && (err as any).details) {
      res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: err.message,
          details: (err as any).details
        }
      });
      return;
    }
    if (err instanceof Error && err.message.includes("Cannot finalize")) {
      res.status(400).json(errorResponse("VALIDATION_ERROR", err.message));
      return;
    }
    next(err);
  }
}

const createVersionSchema = z.object({
  version: z.string().min(1)
});

export async function createVersion(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const parsed = createVersionSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json(errorResponse("VALIDATION_ERROR", formatZodError(parsed.error)));
      return;
    }

    const newVersion = await releaseService.createVersion(id!, parsed.data.version);
    res.json(successResponse(newVersion));
  } catch (err) {
    next(err);
  }
}

export async function compareVersions(req: Request, res: Response, next: NextFunction) {
  try {
    const { id, otherVersionId } = req.params;
    const result = await releaseService.compareVersions(id!, otherVersionId!);
    res.json(successResponse(result));
  } catch (err) {
    next(err);
  }
}

export async function generateDemoRelease(req: Request, res: Response, next: NextFunction) {
  try {
    const demoItems = [
      { itemType: "FEATURE", title: "Bulk CSV Import", content: "Users can import up to 10,000 records using CSV.", sortOrder: 1 },
      { itemType: "BUG_FIX", title: "Checkout timeout fix", content: "Fixed checkout sessions expiring prematurely.", sortOrder: 1 },
      { itemType: "BEHAVIOR_CHANGE", title: "Session timeout", content: "Inactive sessions now expire after 15 minutes.\nPrevious behavior: 30 minutes.", sortOrder: 1 },
      { itemType: "QA_EVIDENCE", title: "CSV import test", content: "1,000 valid records imported successfully in Chrome 140.", sortOrder: 1 },
      { itemType: "QA_EVIDENCE", title: "Session expiration test", content: "Session timeout behavior verified successfully in Chrome 140.", sortOrder: 2 },
      { itemType: "LIMITATION", title: "CSV Limit", content: "CSV imports are limited to 10,000 records.", sortOrder: 1 },
      { itemType: "MIGRATION_NOTE", title: "Timeout Config", content: "SESSION_TIMEOUT_MINUTES changed to 15.", sortOrder: 1 },
      { itemType: "AFFECTED_GROUP", title: "Users", content: "Existing users.", sortOrder: 1 },
    ];

    const release = await releaseService.createRelease({
      version: "1.0.0",
      title: "March Platform Release",
      items: demoItems as any[]
    });
    
    res.json(successResponse(release));
  } catch (err) {
    next(err);
  }
}
