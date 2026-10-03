import "./src/lib/config.js";
import prisma from "./src/lib/prisma.js";
import { analyzeRelease } from "./src/services/ai.service.js";

async function run() {
  const release = await prisma.release.findFirst({
    where: { items: { some: {} } }
  });
  if (!release) {
    console.log("No release found to analyze.");
    process.exit(1);
  }

  console.log(`Analyzing release: ${release.id}`);
  const result = await analyzeRelease(release.id);
  console.log("Analysis Result:");
  console.log(JSON.stringify(result, null, 2));
}

run().finally(() => prisma.$disconnect());
