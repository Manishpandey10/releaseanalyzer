npm install -D @types/express @types/corsimport "./src/lib/config.js";
import { analyzeRelease } from "./src/services/ai.service.js";

async function run() {
  try {
    await analyzeRelease("bc79d0d3-d2fa-49d1-9ebb-03fcd1820ef5");
  } catch (e) {
    console.error(e);
  }
}

run();
