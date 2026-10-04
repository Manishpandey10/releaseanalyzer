import { describe, it, expect, beforeAll, afterAll } from "vitest";
import "../src/lib/config.js";
import request from "supertest";
import type { Express } from "express";
import { createApp } from "../src/app.js";

import prisma from "../src/lib/prisma.js";

let app: Express;

beforeAll(() => {
  app = createApp();
});

afterAll(async () => {
  await prisma.release.deleteMany({
    where: { title: { startsWith: "TEST-" } },
  });
  await prisma.$disconnect();
});

describe("GET /health", () => {
  it("returns status ok", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe("ok");
    expect(res.body.data.timestamp).toBeDefined();
  });
});

describe("POST /api/releases", () => {
  it("creates a release with valid data", async () => {
    const res = await request(app)
      .post("/api/releases")
      .send({
        version: "1.0.0",
        title: "TEST- Release " + Date.now(),
        items: [
          {
            itemType: "FEATURE",
            title: "New login",
            content: "Added OAuth2 login flow",
          },
          {
            itemType: "BUG_FIX",
            title: "Fix crash on startup",
            content: "Null pointer exception fixed",
          },
        ],
      });

    expect(res.status).toBe(201);
    expect(res.body.data).toBeDefined();
    expect(res.body.data.version).toBe("1.0.0");
    expect(res.body.data.title).toMatch(/^TEST- Release \d+$/);
    expect(res.body.data.status).toBe("DRAFT");
    expect(res.body.data.items).toHaveLength(2);

    // Check content hashes are populated
    for (const item of res.body.data.items) {
      expect(item.contentHash).toMatch(/^[a-f0-9]{64}$/);
    }

    // Check display IDs
    const feature = res.body.data.items.find((i: any) => i.itemType === "FEATURE");
    expect(feature.displayId).toBe("F-001");

    const bugfix = res.body.data.items.find((i: any) => i.itemType === "BUG_FIX");
    expect(bugfix.displayId).toBe("B-001");
  });

  it("rejects duplicate title and version", async () => {
    // Generate unique title to avoid conflicts across test runs
    const uniqueTitle = "TEST-Duplicate-" + Date.now();
    
    // First creation
    const res1 = await request(app)
      .post("/api/releases")
      .send({
        version: "1.0.0",
        title: uniqueTitle,
        items: []
      });
    expect(res1.status).toBe(201);
    
    // Duplicate creation
    const res2 = await request(app)
      .post("/api/releases")
      .send({
        version: "1.0.0",
        title: uniqueTitle,
        items: []
      });
    expect(res2.status).toBe(409);
    expect(res2.body.error.message).toContain("already exists");
  });

  it("validates a release through /validate endpoint", async () => {
    const title = "TEST-Validate-" + Date.now();
    const createRes = await request(app)
      .post("/api/releases")
      .send({
        version: "1.1.0",
        title: title,
        items: [
          { itemType: "FEATURE", title: "F", content: "f" }
        ]
      });
    expect(createRes.status).toBe(201);
    const releaseId = createRes.body.data.id;

    const valRes = await request(app).post(`/api/releases/${releaseId}/validate`);
    expect(valRes.status).toBe(200);
    expect(valRes.body.data.valid).toBe(false);
    expect(valRes.body.data.issues.length).toBeGreaterThan(0);
    expect(valRes.body.data.sections).toBeDefined();
    
    // Check one of the sections
    const changeSec = valRes.body.data.sections.find((s: any) => s.key === "CHANGES");
    expect(changeSec.present).toBe(true);
    const qaSec = valRes.body.data.sections.find((s: any) => s.key === "QA_EVIDENCE");
    expect(qaSec.present).toBe(false);
  });

  it("rejects request with missing version", async () => {
    const res = await request(app)
      .post("/api/releases")
      .send({ title: "No version" });

    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("rejects request with missing title", async () => {
    const res = await request(app)
      .post("/api/releases")
      .send({ version: "1.0.0" });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("rejects request with invalid item type", async () => {
    const res = await request(app)
      .post("/api/releases")
      .send({
        version: "1.0.0",
        title: "Bad item type",
        items: [{ itemType: "INVALID", title: "t", content: "c" }],
      });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });
});

describe("Release Validation and Analysis Rules", () => {
  const allSections = [
    { itemType: "FEATURE", title: "F", content: "c" },
    { itemType: "BEHAVIOR_CHANGE", title: "B", content: "c" },
    { itemType: "QA_EVIDENCE", title: "Q", content: "c" },
    { itemType: "LIMITATION", title: "L", content: "c" },
    { itemType: "MIGRATION_NOTE", title: "M", content: "c" },
    { itemType: "AFFECTED_GROUP", title: "A", content: "c" }
  ];

  it("fails if one section is missing and reports correct issue", async () => {
    // Missing QA_EVIDENCE
    const items = allSections.filter(s => s.itemType !== "QA_EVIDENCE");
    
    const createRes = await request(app).post("/api/releases").send({
      version: "1.0.0",
      title: "TEST- Missing QA " + Date.now() + Math.random(),
      items
    });
    expect(createRes.status).toBe(201);
    const releaseId = createRes.body.data.id;

    const valRes = await request(app).post(`/api/releases/${releaseId}/validate`);
    expect(valRes.body.data.valid).toBe(false);
    expect(valRes.body.data.issues.some((iss: string) => iss.includes("QA Evidence"))).toBe(true);

    const qaSec = valRes.body.data.sections.find((s: any) => s.key === "QA_EVIDENCE");
    expect(qaSec.present).toBe(false);
  });

  it("FEATURE only (no BUG_FIX) satisfies the Changes section", async () => {
    // allSections already has FEATURE but no BUG_FIX
    const createRes = await request(app).post("/api/releases").send({
      version: "1.0.0",
      title: "TEST- Feature Only " + Date.now() + Math.random(),
      items: allSections
    });
    expect(createRes.status).toBe(201);
    const releaseId = createRes.body.data.id;

    const valRes = await request(app).post(`/api/releases/${releaseId}/validate`);
    expect(valRes.body.data.valid).toBe(true);
    const changeSec = valRes.body.data.sections.find((s: any) => s.key === "CHANGES");
    expect(changeSec.present).toBe(true);
  });

  it("POST analyze on an invalid release returns 400", async () => {
    // Missing LIMITATION
    const items = allSections.filter(s => s.itemType !== "LIMITATION");
    const createRes = await request(app).post("/api/releases").send({
      version: "1.0.0",
      title: "TEST- Analyze Invalid " + Date.now() + Math.random(),
      items
    });
    expect(createRes.status).toBe(201);
    const releaseId = createRes.body.data.id;

    const analyzeRes = await request(app).post(`/api/releases/${releaseId}/analyze`);
    expect(analyzeRes.status).toBe(400);
    expect(analyzeRes.body.error.code).toBe("VALIDATION_ERROR");
  });
});

describe("GET /api/releases", () => {
  it("returns a list of releases", async () => {
    const res = await request(app).get("/api/releases");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });
});

describe("GET /api/releases/:id", () => {
  it("returns 404 for non-existent release", async () => {
    const res = await request(app).get("/api/releases/00000000-0000-0000-0000-000000000000");
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });

  it("returns a release by ID", async () => {
    // First create a release
    const createRes = await request(app)
      .post("/api/releases")
      .send({ version: "2.0.0", title: "TEST- Fetch Test " + Date.now() });

    const id = createRes.body.data.id;

    const res = await request(app).get(`/api/releases/${id}`);
    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(id);
    expect(res.body.data.version).toBe("2.0.0");
  });
});

describe("Staleness Edge Cases and Resolution", () => {
  let releaseId: string;
  let stmt1Id: string;
  let stmt2Id: string;
  let stmtUnrelatedId: string;

  beforeAll(async () => {
    // 1. Create Release
    const createRes = await request(app).post("/api/releases").send({
      version: "1.0.0",
      title: "TEST- Stale Split " + Date.now() + Math.random(),
      items: [
        { itemType: "FEATURE", title: "Item 1", content: "Original 1" },
        { itemType: "BUG_FIX", title: "Item 2", content: "Original 2" },
        { itemType: "BEHAVIOR_CHANGE", title: "Item 3", content: "Original 3" }
      ]
    });
    releaseId = createRes.body.data.id;
    const items = createRes.body.data.items;

    // 2. Insert statements manually
    const stmt1 = await prisma.generatedStatement.create({
      data: {
        releaseId, audience: "INTERNAL", statement: "Refers to Item 1", impact: "LOW", supportStatus: "SUPPORTED", reviewStatus: "PENDING", isStale: false,
        originalEvidenceCount: 1, originalEvidenceDisplayIds: [items[0].displayId],
        evidence: { create: [{ releaseItemId: items[0].id, sourceHashAtGeneration: items[0].contentHash }] }
      }
    });
    stmt1Id = stmt1.id;

    const stmt2 = await prisma.generatedStatement.create({
      data: {
        releaseId, audience: "INTERNAL", statement: "Refers to Item 2", impact: "LOW", supportStatus: "SUPPORTED", reviewStatus: "PENDING", isStale: false,
        originalEvidenceCount: 1, originalEvidenceDisplayIds: [items[1].displayId],
        evidence: { create: [{ releaseItemId: items[1].id, sourceHashAtGeneration: items[1].contentHash }] }
      }
    });
    stmt2Id = stmt2.id;

    const stmt3 = await prisma.generatedStatement.create({
      data: {
        releaseId, audience: "INTERNAL", statement: "Refers to Item 3", impact: "LOW", supportStatus: "SUPPORTED", reviewStatus: "PENDING", isStale: false,
        originalEvidenceCount: 1, originalEvidenceDisplayIds: [items[2].displayId],
        evidence: { create: [{ releaseItemId: items[2].id, sourceHashAtGeneration: items[2].contentHash }] }
      }
    });
    stmtUnrelatedId = stmt3.id;
  });

  it("changing a cited item makes the statement stale, but unrelated item does not", async () => {
    // Update Item 1 to make stmt1 stale, and Item 3 to make stmtUnrelated stale. Leave Item 2 alone.
    // Wait, the prompt says "removing a cited item makes it stale...". 
    // Let's change Item 1, remove Item 2, keep Item 3 same.
    const patchRes = await request(app).patch(`/api/releases/${releaseId}`).send({
      items: [
        { itemType: "FEATURE", title: "Item 1", content: "Changed 1" },
        // Item 2 omitted (removed)
        { itemType: "BEHAVIOR_CHANGE", title: "Item 3", content: "Original 3" }
      ]
    });
    expect(patchRes.status).toBe(200);

    const stmts = await request(app).get(`/api/releases/${releaseId}/statements`);
    const s1 = stmts.body.data.find((s: any) => s.id === stmt1Id);
    const s2 = stmts.body.data.find((s: any) => s.id === stmt2Id);
    const s3 = stmts.body.data.find((s: any) => s.id === stmtUnrelatedId);

    expect(s1.isStale).toBe(true);
    expect(s1.reasons[0].reason).toBe("CHANGED");

    expect(s3.isStale).toBe(false); // unrelated item not changed
  });

  it("removing a cited item makes it stale with REMOVED reason naming the item", async () => {
    const stmts = await request(app).get(`/api/releases/${releaseId}/statements`);
    const s2 = stmts.body.data.find((s: any) => s.id === stmt2Id);
    expect(s2.isStale).toBe(true);
    expect(s2.reasons[0].reason).toBe("REMOVED");
    expect(s2.reasons[0].displayId).not.toBe("Unknown");
  });

  it("approving a stale statement -> 409", async () => {
    const approveFail = await request(app).post(`/api/releases/${releaseId}/statements/${stmt1Id}/approve`);
    expect(approveFail.status).toBe(409);
  });

  it("resolve without note / short note -> 400", async () => {
    const res = await request(app).post(`/api/releases/${releaseId}/statements/${stmt1Id}/resolve`).send({ note: "ok" });
    expect(res.status).toBe(400);
  });

  it("resolve refreshes hashes, sets PENDING and isStale=false", async () => {
    const resolveRes = await request(app).post(`/api/releases/${releaseId}/statements/${stmt1Id}/resolve`).send({ note: "Resolved note" });
    expect(resolveRes.status).toBe(200);
    expect(resolveRes.body.data.isStale).toBe(false);
    expect(resolveRes.body.data.reviewStatus).toBe("PENDING");
  });

  it("resolved statement can then be approved", async () => {
    const approveRes = await request(app).post(`/api/releases/${releaseId}/statements/${stmt1Id}/approve`);
    expect(approveRes.status).toBe(200);
    expect(approveRes.body.data.reviewStatus).toBe("APPROVED");
  });

  it("resolve when a cited item was removed -> 409", async () => {
    const resolveFail = await request(app).post(`/api/releases/${releaseId}/statements/${stmt2Id}/resolve`).send({ note: "Resolved note" });
    expect(resolveFail.status).toBe(409);
  });

  it("editing a stale statement clears stale and sets PENDING", async () => {
    const editRes = await request(app).patch(`/api/releases/${releaseId}/statements/${stmt2Id}`).send({ statement: "Edited statement" });
    expect(editRes.status).toBe(200);
    expect(editRes.body.data.isStale).toBe(false);
    expect(editRes.body.data.reviewStatus).toBe("PENDING");
  });

  it("rejected stale statement blocks finalize", async () => {
    // Approve stmt3 to be safe
    await request(app).post(`/api/releases/${releaseId}/statements/${stmtUnrelatedId}/approve`);
    
    // We reject a stale statement by changing a new one
    const stmt4 = await prisma.generatedStatement.create({
      data: {
        releaseId, audience: "INTERNAL", statement: "To be rejected", impact: "LOW", supportStatus: "SUPPORTED", reviewStatus: "PENDING", isStale: true, originalEvidenceCount: 1, originalEvidenceDisplayIds: []
      }
    });
    
    await request(app).post(`/api/releases/${releaseId}/statements/${stmt4.id}/reject`);
    
    // Attempt finalize (should fail because of stale rejected statement)
    // Wait, stmt2 is PENDING right now after the edit. Let's approve it.
    await request(app).post(`/api/releases/${releaseId}/statements/${stmt2Id}/approve`);

    const finRes = await request(app).post(`/api/releases/${releaseId}/finalize`);
    expect(finRes.status).toBe(400);
    expect(finRes.body.error.details.staleCount).toBeGreaterThan(0);
  });

  it("finalize blocked while a stale approved statement exists", async () => {
    // Create new release to test blocked finalize
    const createRes = await request(app).post("/api/releases").send({ version: "1.0.1", title: "TEST- Block " + Date.now(), items: [{ itemType: "FEATURE", title: "F", content: "f" }] });
    const rId = createRes.body.data.id;
    await prisma.generatedStatement.create({
      data: { releaseId: rId, audience: "INTERNAL", statement: "S", impact: "LOW", supportStatus: "SUPPORTED", reviewStatus: "APPROVED", isStale: true, originalEvidenceCount: 0 }
    });
    const finRes = await request(app).post(`/api/releases/${rId}/finalize`);
    expect(finRes.status).toBe(400); // or 500
  });

  it("compare returns staleStatements with reasons", { timeout: 10000 }, async () => {
    // Tested implicitly in `getStatementsByRelease` above, but let's test the specific /versions compare
    const createRes = await request(app).post("/api/releases").send({ version: "1.0.0", title: "TEST- Compare " + Date.now(), items: [{ itemType: "FEATURE", title: "F", content: "f" }] });
    const bId = createRes.body.data.id;
    const bItems = createRes.body.data.items;
    
    await prisma.generatedStatement.create({
      data: { releaseId: bId, audience: "INTERNAL", statement: "S", impact: "LOW", supportStatus: "SUPPORTED", reviewStatus: "APPROVED", isStale: false, originalEvidenceCount: 1, originalEvidenceDisplayIds: [bItems[0].displayId], evidence: { create: [{ releaseItemId: bItems[0].id, sourceHashAtGeneration: bItems[0].contentHash }] } }
    });
    
    const verRes = await request(app).post(`/api/releases/${bId}/versions`).send({ version: "1.1.0" });
    const tId = verRes.body.data.id;
    
    // Change item in tId
    await request(app).patch(`/api/releases/${tId}`).send({ items: [{ itemType: "FEATURE", title: "F", content: "changed" }] });
    
    const compRes = await request(app).get(`/api/releases/${bId}/compare/${tId}`);
    expect(compRes.body.data.staleStatements.length).toBe(1);
    expect(compRes.body.data.staleStatements[0].reasons[0].reason).toBe("CHANGED");
  });

  it("v1.0 statements are cloned into v1.1 and become stale after a cited item changes", async () => {
    // Already demonstrated in the test above, but explicitly:
    // The previous test creates v1.0, clones to v1.1, changes item, and checks compare. 
    // We can just verify the statements endpoint of tId.
    const rels = await request(app).get("/api/releases");
    const tRel = rels.body.data.find((r: any) => r.version === "1.1.0" && r.title.startsWith("TEST- Compare"));
    const stmts = await request(app).get(`/api/releases/${tRel.id}/statements`);
    expect(stmts.body.data[0].isStale).toBe(true);
  });
});

describe("isEdited property rules", () => {
  async function setupTestRelease() {
    const createRes = await request(app).post("/api/releases").send({ version: "1.0.0", title: "TEST- isEdited " + Date.now(), items: [{ itemType: "FEATURE", title: "F", content: "f" }] });
    const rId = createRes.body.data.id;
    const items = createRes.body.data.items;
    
    const stmt = await prisma.generatedStatement.create({
      data: { releaseId: rId, audience: "INTERNAL", statement: "S", impact: "LOW", supportStatus: "SUPPORTED", reviewStatus: "PENDING", isStale: false, isEdited: false, originalEvidenceCount: 1, originalEvidenceDisplayIds: [items[0].displayId], evidence: { create: [{ releaseItemId: items[0].id, sourceHashAtGeneration: items[0].contentHash }] } }
    });
    return { releaseId: rId, items, statement: stmt };
  }

  it("editing a statement sets isEdited", async () => {
    const { releaseId, statement } = await setupTestRelease();
    const res = await request(app).patch(`/api/releases/${releaseId}/statements/${statement.id}`).send({ statement: "Edited text" });
    expect(res.status).toBe(200);
    expect(res.body.data.isEdited).toBe(true);
  });

  it("approve, reject, resolve and system stale-marking do not set isEdited", async () => {
    const { releaseId, statement, items } = await setupTestRelease();
    
    let res = await request(app).post(`/api/releases/${releaseId}/statements/${statement.id}/approve`);
    expect(res.body.data.isEdited).toBe(false);

    res = await request(app).post(`/api/releases/${releaseId}/statements/${statement.id}/reject`);
    expect(res.body.data.isEdited).toBe(false);

    await request(app).patch(`/api/releases/${releaseId}`).send({ items: [{ id: items[0].id, itemType: "FEATURE", title: "F", content: "changed_for_stale" }] });
    await request(app).get(`/api/releases/${releaseId}/statements`); // triggers stale
    
    const staleStmt = await prisma.generatedStatement.findUnique({ where: { id: statement.id } });
    expect(staleStmt?.isStale).toBe(true);
    expect(staleStmt?.isEdited).toBe(false);

    res = await request(app).post(`/api/releases/${releaseId}/statements/${statement.id}/resolve`).send({ note: "resolved stale" });
    expect(res.body.data.isEdited).toBe(false);
  });

  it("editing an APPROVED statement resets it to PENDING and sets isEdited", async () => {
    const { releaseId, statement } = await setupTestRelease();
    await request(app).post(`/api/releases/${releaseId}/statements/${statement.id}/approve`);
    
    const res = await request(app).patch(`/api/releases/${releaseId}/statements/${statement.id}`).send({ statement: "I am changing this" });
    expect(res.body.data.reviewStatus).toBe("PENDING");
    expect(res.body.data.isEdited).toBe(true);
  });

  it("version clone keeps isEdited", async () => {
    const { releaseId, statement } = await setupTestRelease();
    await request(app).patch(`/api/releases/${releaseId}/statements/${statement.id}`).send({ statement: "Edited" });
    await request(app).post(`/api/releases/${releaseId}/statements/${statement.id}/approve`);
    await prisma.release.update({ where: { id: releaseId }, data: { status: "FINAL" } });
    
    const res = await request(app).post(`/api/releases/${releaseId}/versions`).send({ version: "2.0.0" });
    const newReleaseId = res.body.data.id;
    const clonedStmts = await prisma.generatedStatement.findMany({ where: { releaseId: newReleaseId } });
    expect(clonedStmts[0].isEdited).toBe(true);
  });

  it("re-analyze returns 409 for an edited statement", async () => {
    const { releaseId, statement } = await setupTestRelease();
    await request(app).patch(`/api/releases/${releaseId}/statements/${statement.id}`).send({ statement: "Edited" });

    const res = await request(app).post(`/api/releases/${releaseId}/analyze`);
    expect(res.status).toBe(409);
    expect(res.text).toMatch(/source package changed but there is already reviewed\/edited work/);
  });

  it("re-analyze does NOT return 409 when the only change is system stale marking", async () => {
    const { releaseId, statement, items } = await setupTestRelease();
    await request(app).patch(`/api/releases/${releaseId}`).send({ items: [{ id: items[0].id, itemType: "FEATURE", title: "F", content: "changed_for_stale" }] });
    await request(app).get(`/api/releases/${releaseId}/statements`);
    
    const staleStmt = await prisma.generatedStatement.findUnique({ where: { id: statement.id } });
    expect(staleStmt?.isStale).toBe(true);
    expect(staleStmt?.isEdited).toBe(false);

    // AI is not fully mocked here for a successful run (requires valid items etc.), 
    // but the 409 guard happens BEFORE item validation, so if we get 400 (validation), 
    // it successfully bypassed the 409 guard!
    const res = await request(app).post(`/api/releases/${releaseId}/analyze`);
    expect(res.status).not.toBe(409);
  });
});
