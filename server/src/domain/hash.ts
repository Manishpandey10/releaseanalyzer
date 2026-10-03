import crypto from "node:crypto";

/**
 * Generates a deterministic content hash for a release item.
 *
 * Hashes the meaningful source content (itemType, title, content)
 * using SHA-256. This will later support stale-statement detection
 * by comparing old vs current source hashes.
 */
export function hashReleaseItemContent(item: {
  itemType: string;
  title: string;
  content: string;
}): string {
  const payload = [item.itemType, item.title, item.content].join("\n---\n");
  return crypto.createHash("sha256").update(payload, "utf-8").digest("hex");
}
