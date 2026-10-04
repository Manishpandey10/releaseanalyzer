import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import "../src/lib/config";
import prisma from "../src/lib/prisma";
import { generateDemoReleases } from "../src/services/demo.service";
import { compareVersions, finalizeRelease } from "../src/services/release.service";
import { resolveStatement } from "../src/services/statement.service";
import { validateReleasePackage } from "../src/domain/validation";
import * as fs from "fs";
import * as path from "path";

describe("Demo Fixtures Suite", { timeout: 30000 }, () => {
  beforeEach(async () => {
    const demoReleases = await prisma.release.findMany({ where: { title: { startsWith: "DEMO " } } });
    const demoIds = demoReleases.map(r => r.id);
    await prisma.statementEvidence.deleteMany({ where: { statement: { releaseId: { in: demoIds } } } });
    await prisma.generatedStatement.deleteMany({ where: { releaseId: { in: demoIds } } });
    await prisma.aiAnalysis.deleteMany({ where: { releaseId: { in: demoIds } } });
    await prisma.releaseItem.deleteMany({ where: { releaseId: { in: demoIds } } });
    await prisma.release.deleteMany({ where: { id: { in: demoIds } } });
  });

  afterEach(async () => {
    vi.restoreAllMocks();
  });

  it("1 & 2. Load Demo creates all three primary DEMO releases and is idempotent", async () => {
    await generateDemoReleases();
    let releases = await prisma.release.findMany();
    // Demo A (1), Demo B 1.0.0 (1), Demo B 1.1.0 (1), Demo C (1) = 4 releases
    expect(releases.length).toBe(4);

    // Run again
    await generateDemoReleases();
    releases = await prisma.release.findMany();
    expect(releases.length).toBe(4); // No duplicates
  });

  it("3 & 4. DEMO titles start with 'DEMO ' and title === content", async () => {
    await generateDemoReleases();
    const releases = await prisma.release.findMany({ include: { items: true } });
    
    for (const r of releases) {
      expect(r.title.startsWith("DEMO ")).toBe(true);
      for (const item of r.items) {
        expect(item.title).toBe(item.content);
      }
    }
  });

  it("5. DEMO A meets requirements", async () => {
    await generateDemoReleases();
    const demoA = await prisma.release.findFirst({ where: { title: "DEMO Checkout and Session Release", version: "1.0.0" }, include: { items: true } });
    expect(demoA).not.toBeNull();
    expect(demoA!.status).toBe("DRAFT");
    
    // validate
    const validation = validateReleasePackage(demoA!.items as any);
    expect(validation.issues).toHaveLength(0);

    const analyses = await prisma.aiAnalysis.findMany({ where: { releaseId: demoA!.id } });
    expect(analyses.length).toBe(0); // No gemini calls
  });

  it("6. DEMO B v1.0.0 meets requirements", async () => {
    await generateDemoReleases();
    const demoB1 = await prisma.release.findFirst({ where: { title: "DEMO Reports Release", version: "1.0.0" }, include: { statements: true } });
    expect(demoB1).not.toBeNull();
    expect(demoB1!.status).toBe("FINAL");

    const stmts = demoB1!.statements;
    expect(stmts.length).toBe(5);
    
    const approved = stmts.filter(s => s.reviewStatus === "APPROVED");
    const rejected = stmts.filter(s => s.reviewStatus === "REJECTED");
    expect(approved.length).toBe(4);
    expect(rejected.length).toBe(1);
  });

  it("7. DEMO B v1.1.0 meets requirements and staleness is correct", async () => {
    await generateDemoReleases();
    const demoB1 = await prisma.release.findFirst({ where: { title: "DEMO Reports Release", version: "1.0.0" } });
    const demoB11 = await prisma.release.findFirst({ where: { title: "DEMO Reports Release", version: "1.1.0" }, include: { items: true, statements: true } });
    
    expect(demoB11).not.toBeNull();
    expect(demoB11!.parentReleaseId).toBe(demoB1!.id);

    const comparison = await compareVersions(demoB1!.id, demoB11!.id);
    
    // S2 stale CHANGED, S3 stale REMOVED
    const s2 = comparison.staleStatements.find(s => s.text === "CSV export is not available for reports yet.");
    expect(s2).toBeDefined();
    expect(s2!.reasons.some(r => r.reason === "CHANGED")).toBe(true);

    const s3 = comparison.staleStatements.find(s => s.text === "Duplicate rows in the weekly report were fixed.");
    expect(s3).toBeDefined();
    expect(s3!.reasons.some(r => r.reason === "REMOVED")).toBe(true);

    const s1 = comparison.staleStatements.find(s => s.text === "A date range filter was added to the reports dashboard.");
    expect(s1).toBeUndefined();

    const s4 = comparison.staleStatements.find(s => s.text === "Reports now show 50 rows per page.");
    expect(s4).toBeUndefined();
    
    const s5 = demoB11!.statements.find(s => s.statement === "Reports load 40% faster.");
    expect(s5!.reviewStatus).toBe("REJECTED");
  });

  it("8. Removed-source stale resolution returns 409", async () => {
    await generateDemoReleases();
    const demoB11 = await prisma.release.findFirst({ where: { title: "DEMO Reports Release", version: "1.1.0" }, include: { statements: true } });
    
    const s3 = demoB11!.statements.find(s => s.statement === "Duplicate rows in the weekly report were fixed.");
    
    await expect(resolveStatement(demoB11!.id, s3!.id, "Should fail")).rejects.toThrow();
  });

  it("9. DEMO C meets requirements", async () => {
    await generateDemoReleases();
    const demoC = await prisma.release.findFirst({ where: { title: "DEMO Incomplete and Injection", version: "0.9.0" }, include: { items: true } });
    expect(demoC).not.toBeNull();
    expect(demoC!.status).toBe("DRAFT");
    
    const validation = validateReleasePackage(demoC!.items as any);
    expect(validation.issues.length).toBe(3);
    expect(validation.issues.some(i => i.includes("Behavior Change"))).toBe(true);
    expect(validation.issues.some(i => i.includes("Migration Note"))).toBe(true);
    expect(validation.issues.some(i => i.includes("Affected Group"))).toBe(true);
  });

  it("10. Demo badge is present in Dashboard.tsx code", () => {
    const dashboardPath = path.join(__dirname, "../../client/src/pages/Dashboard.tsx");
    const content = fs.readFileSync(dashboardPath, "utf-8");
    expect(content).toContain('release.title.startsWith("DEMO ")');
    expect(content).toContain('DEMO');
  });

  it("11. Finalization block rules", async () => {
    await generateDemoReleases();
    
    // Test PENDING blocks finalization
    const demoC = await prisma.release.findFirst({ where: { title: "DEMO Incomplete and Injection", version: "0.9.0" } });
    await prisma.generatedStatement.create({
      data: {
        releaseId: demoC!.id,
        statement: "Pending",
        reviewStatus: "PENDING",
        supportStatus: "SUPPORTED",
        audience: "INTERNAL",
        impact: "LOW"
      }
    });
    
    await expect(finalizeRelease(demoC!.id)).rejects.toThrow("Cannot finalize release.");

    // Update to APPROVED + STALE
    const stmt = await prisma.generatedStatement.findFirst({ where: { releaseId: demoC!.id } });
    await prisma.generatedStatement.update({ where: { id: stmt!.id }, data: { reviewStatus: "APPROVED", isStale: true } });
    await expect(finalizeRelease(demoC!.id)).rejects.toThrow("Cannot finalize release.");
  });
});
