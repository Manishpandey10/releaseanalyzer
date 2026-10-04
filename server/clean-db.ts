
import "./src/lib/config.js";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function clean() {
  await prisma.statementEvidence.deleteMany({});
  await prisma.generatedStatement.deleteMany({});
  await prisma.aiAnalysis.deleteMany({});
  await prisma.releaseItem.deleteMany({});
  await prisma.release.deleteMany({});
  console.log("Deleted all data in the database.");
}

clean().finally(() => prisma.$disconnect());
