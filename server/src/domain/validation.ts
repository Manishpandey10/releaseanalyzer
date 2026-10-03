import type { ReleaseItemType } from "@prisma/client";

export function validateReleasePackage(items: { itemType: ReleaseItemType }[]): string[] {
  const errors: string[] = [];

  const hasChanges = items.some(
    (i) => i.itemType === "FEATURE" || i.itemType === "BUG_FIX" || i.itemType === "BEHAVIOR_CHANGE"
  );
  if (!hasChanges) {
    errors.push("Release must contain at least one Feature, Bug Fix, or Behavior Change.");
  }

  const hasQA = items.some((i) => i.itemType === "QA_EVIDENCE");
  if (!hasQA) {
    errors.push("Release must contain at least one QA Evidence item.");
  }

  return errors;
}
