import { z } from "zod";

const ReleaseItemTypeEnum = z.enum([
  "FEATURE",
  "BUG_FIX",
  "BEHAVIOR_CHANGE",
  "QA_EVIDENCE",
  "LIMITATION",
  "MIGRATION_NOTE",
  "AFFECTED_GROUP",
]);

const ReleaseStatusEnum = z.enum(["DRAFT", "ANALYZED", "IN_REVIEW", "FINAL"]);

const releaseItemSchema = z.object({
  itemType: ReleaseItemTypeEnum,
  title: z.string().min(1, "Item title is required"),
  content: z.string().min(1, "Item content is required"),
  sortOrder: z.number().int().min(0).optional(),
});

export const createReleaseSchema = z.object({
  version: z.string().min(1, "Version is required"),
  title: z.string().min(1, "Title is required"),
  parentReleaseId: z.string().uuid().optional().nullable(),
  items: z.array(releaseItemSchema).optional().default([]),
});

export const updateReleaseSchema = z.object({
  version: z.string().min(1).optional(),
  title: z.string().min(1).optional(),
  status: ReleaseStatusEnum.optional(),
  parentReleaseId: z.string().uuid().optional().nullable(),
  items: z.array(releaseItemSchema).optional(),
});

export type CreateReleaseInput = z.infer<typeof createReleaseSchema>;
export type UpdateReleaseInput = z.infer<typeof updateReleaseSchema>;
