import { describe, it, expect, beforeAll } from "vitest";
import "../src/lib/config";
import prisma from "../src/lib/prisma";
import { generateDemoReleases } from "../src/services/demo.service";
import { resetDevDb } from "../scripts/reset-dev-db";

describe("Database Reset Suite", { timeout: 30000 }, () => {
  beforeAll(async () => {
    // Seed some data first to make sure there's something to delete
    await generateDemoReleases();
  }, 60000);

  it("resets all application data correctly", async () => {
    // Verify data exists
    const beforeReleases = await prisma.release.count();
    const beforeItems = await prisma.releaseItem.count();
    const beforeAnalyses = await prisma.aiAnalysis.count();
    const beforeStatements = await prisma.generatedStatement.count();
    
    expect(beforeReleases).toBeGreaterThan(0);
    expect(beforeItems).toBeGreaterThan(0);
    expect(beforeAnalyses).toBeGreaterThan(0);
    expect(beforeStatements).toBeGreaterThan(0);

    // Run reset
    await resetDevDb();

    // Verify everything is deleted
    const afterReleases = await prisma.release.count();
    const afterItems = await prisma.releaseItem.count();
    const afterAnalyses = await prisma.aiAnalysis.count();
    const afterStatements = await prisma.generatedStatement.count();
    const afterEvidence = await prisma.statementEvidence.count();

    expect(afterReleases).toBe(0);
    expect(afterItems).toBe(0);
    expect(afterAnalyses).toBe(0);
    expect(afterStatements).toBe(0);
    expect(afterEvidence).toBe(0);
  });
});
