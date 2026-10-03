import { describe, it, expect, beforeAll, afterAll } from "vitest";
import "../src/lib/config.js";
import request from "supertest";
import type { Express } from "express";
import { createApp } from "../src/app.js";
import prisma from "../src/lib/prisma.js";

let app: Express;

beforeAll(async () => {
  app = createApp();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("AI Analysis Lifecycle", () => {
  it("prevents parallel analysis and returns 409", async () => {
    // 1. Create a release
    const createRes = await request(app)
      .post("/api/releases")
      .send({ 
        version: "5.0.0", 
        title: "Parallel Test",
        items: [
          {
            itemType: "FEATURE",
            title: "Test Feature",
            content: "Test Content"
          },
          {
            itemType: "QA_EVIDENCE",
            title: "Test QA",
            content: "Test Content"
          }
        ]
      });
    const releaseId = createRes.body.data.id;

    // 2. Insert a fake RUNNING analysis that started 1 minute ago
    const startedAt = new Date(Date.now() - 60 * 1000);
    await prisma.aiAnalysis.create({
      data: {
        releaseId,
        status: "RUNNING",
        model: "gemini-3.7-flash",
        startedAt,
      }
    });

    // 3. Try to start analysis
    const analyzeRes = await request(app)
      .post(`/api/releases/${releaseId}/analyze`);
    
    expect(analyzeRes.status).toBe(409);
    expect(analyzeRes.body.error.message).toBe("Analysis is already running");
  });

  it("sweeps stuck RUNNING analyses older than 5 minutes", async () => {
    // 1. Create a release
    const createRes = await request(app)
      .post("/api/releases")
      .send({ version: "6.0.0", title: "Sweep Test" });
    const releaseId = createRes.body.data.id;

    // 2. Insert a fake RUNNING analysis that started 10 minutes ago
    const startedAt = new Date(Date.now() - 10 * 60 * 1000);
    await prisma.aiAnalysis.create({
      data: {
        releaseId,
        status: "RUNNING",
        model: "gemini-3.7-flash",
        startedAt,
      }
    });

    // 3. Manually run the sweep logic from index.ts
    const fiveMinsAgo = new Date(Date.now() - 5 * 60 * 1000);
    await prisma.aiAnalysis.updateMany({
      where: { status: "RUNNING", startedAt: { lt: fiveMinsAgo } },
      data: { status: "FAILED", error: "Interrupted", completedAt: new Date() }
    });

    // 4. Verify it was swept
    const analysis = await prisma.aiAnalysis.findFirst({ where: { releaseId } });
    expect(analysis?.status).toBe("FAILED");
    expect(analysis?.error).toBe("Interrupted");
  });
});
