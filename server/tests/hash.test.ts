import { describe, it, expect } from "vitest";
import { hashReleaseItemContent } from "../src/domain/hash.js";

describe("hashReleaseItemContent", () => {
  it("returns a consistent hash for the same input", () => {
    const item = { itemType: "FEATURE", title: "Login page", content: "Added OAuth support" };
    const hash1 = hashReleaseItemContent(item);
    const hash2 = hashReleaseItemContent(item);
    expect(hash1).toBe(hash2);
  });

  it("returns a 64-character hex string (SHA-256)", () => {
    const item = { itemType: "BUG_FIX", title: "Fix crash", content: "Null check added" };
    const hash = hashReleaseItemContent(item);
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("returns different hashes for different content", () => {
    const item1 = { itemType: "FEATURE", title: "Login page", content: "Version 1" };
    const item2 = { itemType: "FEATURE", title: "Login page", content: "Version 2" };
    expect(hashReleaseItemContent(item1)).not.toBe(hashReleaseItemContent(item2));
  });

  it("returns different hashes for different item types with same title/content", () => {
    const item1 = { itemType: "FEATURE", title: "Update", content: "Changed behavior" };
    const item2 = { itemType: "BEHAVIOR_CHANGE", title: "Update", content: "Changed behavior" };
    expect(hashReleaseItemContent(item1)).not.toBe(hashReleaseItemContent(item2));
  });

  it("returns different hashes for different titles with same type/content", () => {
    const item1 = { itemType: "FEATURE", title: "Title A", content: "Same content" };
    const item2 = { itemType: "FEATURE", title: "Title B", content: "Same content" };
    expect(hashReleaseItemContent(item1)).not.toBe(hashReleaseItemContent(item2));
  });
});
