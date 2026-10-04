import "../src/lib/config.js";
import { generateDemoReleases } from "../src/services/demo.service.js";

async function run() {
  console.log("Seeding demo releases...");
  await generateDemoReleases();
  console.log("Demo seed complete.");
}

run()
  .catch((e) => {
    console.error("Error during seed:", e);
    process.exit(1);
  })
  .finally(() => {
    process.exit(0);
  });
