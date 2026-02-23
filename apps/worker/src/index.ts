import { PrismaClient } from "@prisma/client";
import { processIngressEvent } from "./processor";
import { execSync } from "child_process";
import path from "path";

const prisma = new PrismaClient();

/**
 * Run migrations before starting the worker
 */
async function runMigrations() {
  try {
    console.log("Running Prisma migrations...");
    const prismaCwd = process.env.PRISMA_WORKSPACE_DIR || path.resolve(__dirname, "..", "..", "..", "prisma");
    console.log(`[DEBUG] Running migrations from: ${prismaCwd}`);
    console.log(`[DEBUG] DATABASE_URL set: ${!!process.env.DATABASE_URL}`);
    execSync("pnpm prisma migrate deploy", {
      stdio: "inherit",
      cwd: prismaCwd,
      env: {
        ...process.env,
        NODE_ENV: "production"
      }
    });
    console.log("✓ Migrations completed");
  } catch (err: any) {
    console.error("⚠ Migration failed:", err.message);
    console.error("Continuing anyway - migrations may have already been applied");
  }
}

/**
 * DB-polling worker:
 * - Enkel och stabil för demo (ingen Redis krävs).
 * - Plockar nästa IngressEvent med status RECEIVED.
 */
async function loop() {
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const next = await prisma.ingressEvent.findFirst({
      where: { status: "RECEIVED" },
      orderBy: { receivedAt: "asc" }
    });

    if (!next) {
      await sleep(1500);
      continue;
    }

    await prisma.ingressEvent.update({
      where: { id: next.id },
      data: { status: "PROCESSING" }
    });

    try {
      await processIngressEvent(prisma, next.id);
    } catch (e) {
      console.error("Worker error:", e);
      await prisma.ingressEvent.update({
        where: { id: next.id },
        data: {
          status: "REJECTED",
          validationErrors: { message: "Worker failed", hint: "Se worker-loggar" },
          processedAt: new Date()
        }
      });
    }
  }
}

async function main() {
  await runMigrations();
  await loop();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
