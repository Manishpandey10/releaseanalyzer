import "../src/lib/config.js";
import prisma from "../src/lib/prisma.js";

export async function resetDevDb() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Refusing to reset a production database.");
  }

  // Double check the connection doesn't look like prod if possible
  // Since this is a dev tool, we're trusting NODE_ENV mostly.
  const dbUrl = process.env.DATABASE_URL || "";
  if (!dbUrl) {
    throw new Error("DATABASE_URL is not set.");
  }

  // Delete all application records respecting foreign keys.
  // Using a transaction to ensure it's all or nothing.
  await prisma.$transaction([
    prisma.statementEvidence.deleteMany({}),
    prisma.generatedStatement.deleteMany({}),
    prisma.aiAnalysis.deleteMany({}),
    prisma.releaseItem.deleteMany({}),
    // Update self-referential relations before deleting Release
    prisma.release.updateMany({ data: { parentReleaseId: null } }),
    prisma.release.deleteMany({})
  ]);
}

async function run() {
  console.log("Starting development database reset...");
  try {
    await resetDevDb();
    console.log("Development database reset complete. All application data has been removed.");
  } catch (err: any) {
    console.error(err.message || err);
    process.exit(1);
  }
}

// Only run automatically if this is the main module
import { fileURLToPath } from 'url';
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  run().finally(() => process.exit(0));
}
