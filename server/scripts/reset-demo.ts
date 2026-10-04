import "../src/lib/config.js";
import prisma from "../src/lib/prisma.js";

export async function resetDemoReleases() {
  const demoReleases = await prisma.release.findMany({
    where: {
      title: {
        startsWith: "DEMO ",
      },
    },
  });

  if (demoReleases.length === 0) {
    console.log("No demo releases found. Nothing to reset.");
    return;
  }

  console.log("Demo reset:");
  console.log(`Found ${demoReleases.length} demo releases.\n`);
  for (const r of demoReleases) {
    console.log(`- ${r.title} v${r.version}`);
  }

  const ids = demoReleases.map((r) => r.id);
  
  await prisma.release.deleteMany({
    where: {
      id: { in: ids },
    },
  });

  console.log(`\nDemo reset complete.`);
  console.log(`Deleted ${demoReleases.length} demo releases.`);
}

// Since we are using ES modules, require.main is not available.
// We can check if the file is being run directly via process.argv.
const isMain = process.argv[1] && process.argv[1].endsWith("reset-demo.ts");
if (isMain) {
  resetDemoReleases()
    .catch((e) => {
      console.error("Error during reset:", e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
