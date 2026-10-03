import "dotenv/config";
import prisma from "./src/lib/prisma.js";

async function run() {
  const an = await prisma.aiAnalysis.findFirst({
    orderBy: { createdAt: "desc" },
    include: { release: true }
  });
  console.log("Latest analysis:", an);
}
run();
