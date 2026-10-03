
import "./src/lib/config.js";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function clean() {
  await prisma.aiAnalysis.deleteMany({});
  console.log("Deleted all AiAnalysis records.");
}

clean().finally(() => prisma.$disconnect());
