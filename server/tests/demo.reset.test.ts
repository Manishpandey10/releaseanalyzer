import { describe, it, expect, beforeEach, afterEach } from "vitest";
import "../src/lib/config";
import prisma from "../src/lib/prisma";
import { resetDemoReleases } from "../scripts/reset-demo";

describe("Demo Reset Suite", () => {
  let nonDemoId: string;
  let demoId: string;
  let demoChildId: string;

  beforeEach(async () => {
    const v = Date.now().toString() + Math.random().toString();
    // 10. A normal release such as "Reports Release" is NOT considered demo data.
    const nonDemo = await prisma.release.create({
      data: {
        title: "Reports Release " + v,
        version: v,
        status: "DRAFT",
        items: {
          create: [
            { itemType: "FEATURE", title: "Non-demo feature", content: "Data", contentHash: "hash1" }
          ]
        },
        aiAnalyses: {
          create: [
            { status: "COMPLETED" }
          ]
        }
      },
      include: { items: true }
    });
    nonDemoId = nonDemo.id;
    
    await prisma.generatedStatement.create({
      data: {
        releaseId: nonDemoId,
        audience: "INTERNAL",
        statement: "Non-demo statement",
        impact: "LOW",
        evidence: {
          create: [
            { releaseItemId: nonDemo.items[0].id, sourceHashAtGeneration: "hash1" }
          ]
        }
      }
    });

    // 9. A title such as "DEMO Reports Release" is considered demo data.
    const demo = await prisma.release.create({
      data: {
        title: "DEMO Reports Release " + v,
        version: v,
        status: "DRAFT",
        items: {
          create: [
            { itemType: "FEATURE", title: "Demo feature", content: "Data", contentHash: "hash2" }
          ]
        },
        aiAnalyses: {
          create: [
            { status: "COMPLETED" }
          ]
        }
      },
      include: { items: true }
    });
    demoId = demo.id;

    await prisma.generatedStatement.create({
      data: {
        releaseId: demoId,
        audience: "INTERNAL",
        statement: "Demo statement",
        impact: "LOW",
        evidence: {
          create: [
            { releaseItemId: demo.items[0].id, sourceHashAtGeneration: "hash2" }
          ]
        }
      }
    });

    const demoChild = await prisma.release.create({
      data: {
        title: "DEMO Reports Release " + v,
        version: "1.1.0-" + Date.now(),
        status: "DRAFT",
        parentReleaseId: demoId,
      }
    });
    demoChildId = demoChild.id;
  });

  afterEach(async () => {
    // Cleanup any lingering releases after tests
    const ids = [nonDemoId, demoId, demoChildId].filter(Boolean);
    if (ids.length > 0) {
      await prisma.release.deleteMany({
        where: { id: { in: ids } }
      });
    }
  });

  it("resets demo data correctly", async () => {
    // Run the reset logic
    await resetDemoReleases();

    // 1. A DEMO release is deleted.
    const demoCheck = await prisma.release.findUnique({ where: { id: demoId } });
    expect(demoCheck).toBeNull();

    // 6. Demo child versions are deleted.
    const childCheck = await prisma.release.findUnique({ where: { id: demoChildId } });
    expect(childCheck).toBeNull();

    // 2. Its ReleaseItems are deleted.
    const itemsCheck = await prisma.releaseItem.findMany({ where: { releaseId: demoId } });
    expect(itemsCheck.length).toBe(0);

    // 3. Its AI analysis is deleted.
    const aiCheck = await prisma.aiAnalysis.findMany({ where: { releaseId: demoId } });
    expect(aiCheck.length).toBe(0);

    // 4. Its GeneratedStatements are deleted.
    const stmtsCheck = await prisma.generatedStatement.findMany({ where: { releaseId: demoId } });
    expect(stmtsCheck.length).toBe(0);

    // 5. Its StatementEvidence records are deleted. (Cascaded via statements/items)
    const evidenceCheck = await prisma.statementEvidence.findMany({
      where: {
        statement: { releaseId: demoId }
      }
    });
    expect(evidenceCheck.length).toBe(0);

    // 7. Non-demo releases remain untouched.
    const nonDemoCheck = await prisma.release.findUnique({ where: { id: nonDemoId } });
    expect(nonDemoCheck).not.toBeNull();
    const nonDemoItems = await prisma.releaseItem.findMany({ where: { releaseId: nonDemoId } });
    expect(nonDemoItems.length).toBeGreaterThan(0);
    const nonDemoStmts = await prisma.generatedStatement.findMany({ where: { releaseId: nonDemoId } });
    expect(nonDemoStmts.length).toBeGreaterThan(0);

    // 8. Running reset twice does not fail.
    await expect(resetDemoReleases()).resolves.not.toThrow();
  });
});
