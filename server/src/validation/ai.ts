import { z } from "zod";

export const impactSchema = z.enum(["LOW", "MEDIUM", "HIGH"]);
export const supportStatusSchema = z.enum(["SUPPORTED", "PARTIALLY_SUPPORTED", "UNSUPPORTED"]);

export const aiAnalysisResponseSchema = z.object({
  impactAnalysis: z.array(
    z.object({
      itemId: z.string(), // e.g. "F-001"
      impact: impactSchema,
      reason: z.string(),
      evidenceIds: z.array(z.string()),
    })
  ).default([]),
  missingInformation: z.array(
    z.object({
      question: z.string(),
      severity: impactSchema, // Or we could use LOW/MEDIUM/HIGH
    })
  ).default([]),
  unsupportedClaims: z.array(
    z.object({
      claim: z.string(),
      status: supportStatusSchema,
      evidenceIds: z.array(z.string()),
      reason: z.string(),
    })
  ).default([]),
  risks: z.array(
    z.object({
      description: z.string(),
      severity: impactSchema,
      evidenceIds: z.array(z.string()),
    })
  ).default([]),
  internalStatements: z.array(
    z.object({
      statement: z.string(),
      impact: impactSchema,
      supportStatus: supportStatusSchema,
      evidenceIds: z.array(z.string()),
    })
  ).default([]),
  clientStatements: z.array(
    z.object({
      statement: z.string(),
      impact: impactSchema,
      supportStatus: supportStatusSchema,
      evidenceIds: z.array(z.string()),
    })
  ).default([]),
});

export type AiAnalysisResponse = z.infer<typeof aiAnalysisResponseSchema>;
