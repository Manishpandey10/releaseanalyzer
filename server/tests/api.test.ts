import { describe, it, expect, beforeAll, afterAll } from "vitest";
import "../src/lib/config.js";
import request from "supertest";
import type { Express } from "express";
import { createApp } from "../src/app.js";

let app: Express;

beforeAll(() => {
  app = createApp();
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
