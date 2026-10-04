import "./lib/config.js";
import { createApp } from "./app.js";
import { config } from "./lib/config.js";
import prisma from "./lib/prisma.js";

const app = createApp();

async function main() {
  try {
    // Verify database connection
    await prisma.$connect();
    console.log("✓ Database connected");

    // Sweep stale RUNNING analyses that were interrupted by a server restart
    const fiveMinsAgo = new Date(Date.now() - 5 * 60 * 1000);
    const { count } = await prisma.aiAnalysis.updateMany({
      where: { status: "RUNNING", startedAt: { lt: fiveMinsAgo } },
      data: { status: "FAILED", error: "Interrupted", completedAt: new Date() }
    });
    if (count > 0) {
      console.log(`✓ Swept ${count} interrupted AI analysis records.`);
    }

    app.listen(config.port, "0.0.0.0", () => {
      console.log(`✓ ReleaseAnalyst server running on http://0.0.0.0:${config.port}`);
      console.log(`✓ Gemini model: ${config.geminiModel}`);
    });
  } catch (err) {
    console.error("Failed to start server:", err);
    process.exit(1);
  }
}

main();
