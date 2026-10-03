import type { ReleaseItemType } from "@prisma/client";

export interface ValidationSection {
  key: string;
  label: string;
  present: boolean;
  count: number;
}

export interface ValidationResult {
  valid: boolean;
  sections: ValidationSection[];
  issues: string[];
}

export function validateReleasePackage(items: { itemType: ReleaseItemType }[]): ValidationResult {
  const issues: string[] = [];
  const sections: ValidationSection[] = [];

  const changesCount = items.filter(i => i.itemType === "FEATURE" || i.itemType === "BUG_FIX").length;
  const changesPresent = changesCount > 0;
  sections.push({ key: "CHANGES", label: "Feature or Bug Fix", present: changesPresent, count: changesCount });
  if (!changesPresent) issues.push("Release must contain at least one Feature or Bug Fix.");

  const behaviorChangeCount = items.filter(i => i.itemType === "BEHAVIOR_CHANGE").length;
  const behaviorChangePresent = behaviorChangeCount > 0;
  sections.push({ key: "BEHAVIOR_CHANGE", label: "Behavior Change", present: behaviorChangePresent, count: behaviorChangeCount });
  if (!behaviorChangePresent) issues.push("Release must contain at least one Behavior Change.");

  const qaEvidenceCount = items.filter(i => i.itemType === "QA_EVIDENCE").length;
  const qaEvidencePresent = qaEvidenceCount > 0;
  sections.push({ key: "QA_EVIDENCE", label: "QA Evidence", present: qaEvidencePresent, count: qaEvidenceCount });
  if (!qaEvidencePresent) issues.push("Release must contain at least one QA Evidence item.");

  const limitationCount = items.filter(i => i.itemType === "LIMITATION").length;
  const limitationPresent = limitationCount > 0;
  sections.push({ key: "LIMITATION", label: "Limitation", present: limitationPresent, count: limitationCount });
  if (!limitationPresent) issues.push("Release must contain at least one Limitation.");

  const migrationNoteCount = items.filter(i => i.itemType === "MIGRATION_NOTE").length;
  const migrationNotePresent = migrationNoteCount > 0;
  sections.push({ key: "MIGRATION_NOTE", label: "Migration Note", present: migrationNotePresent, count: migrationNoteCount });
  if (!migrationNotePresent) issues.push("Release must contain at least one Migration Note.");

  const affectedGroupCount = items.filter(i => i.itemType === "AFFECTED_GROUP").length;
  const affectedGroupPresent = affectedGroupCount > 0;
  sections.push({ key: "AFFECTED_GROUP", label: "Affected Group", present: affectedGroupPresent, count: affectedGroupCount });
  if (!affectedGroupPresent) issues.push("Release must contain at least one Affected Group.");

  return {
    valid: issues.length === 0,
    sections,
    issues
  };
}
