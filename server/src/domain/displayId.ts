import { ReleaseItemType } from "@prisma/client";

/**
 * Maps a ReleaseItemType to a human-readable prefix for display IDs.
 *
 * The database uses UUIDs internally for stable references,
 * but the UI/API will display readable IDs like F-001, B-001, etc.
 * The sortOrder field on release_items determines the sequence number.
 */
export const ITEM_TYPE_PREFIX: Record<ReleaseItemType, string> = {
  FEATURE: "F",
  BUG_FIX: "B",
  BEHAVIOR_CHANGE: "C",
  QA_EVIDENCE: "QA",
  LIMITATION: "LIMIT",
  MIGRATION_NOTE: "MIGRATION",
  AFFECTED_GROUP: "GROUP",
};

/**
 * Generates a human-readable display ID for a release item.
 * e.g. F-001, B-002, QA-001
 */
export function formatDisplayId(itemType: ReleaseItemType, sortOrder: number): string {
  const prefix = ITEM_TYPE_PREFIX[itemType];
  return `${prefix}-${String(sortOrder).padStart(3, "0")}`;
}
