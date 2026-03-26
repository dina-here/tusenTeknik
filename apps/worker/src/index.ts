import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { sanitizeInput, processMlAnalysisJob } from "./ml-job.processor";
import { processIngressEvent } from "./processor";
import { execSync } from "child_process";
import { existsSync } from "fs";
import { resolve } from "path";

const datasourceUrl = process.env.DATABASE_URL;
if (!datasourceUrl) {
  throw new Error("DATABASE_URL is missing. Set DATABASE_URL in environment variables.");
}

const adapter = new PrismaPg({ connectionString: datasourceUrl });
const prisma = new PrismaClient({ adapter });

/**
 * Run migrations before starting the worker
 */
async function runMigrations() {
  try {
    console.log("Running Prisma migrations...");
    const prismaCwd = resolvePrismaWorkspaceDir();
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

    if (next) {
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

      continue;
    }

    const mlJob = await prisma.analysisJob.findFirst({
      where: { status: "QUEUED" },
      orderBy: { requestedAt: "asc" }
    });

    if (mlJob) {
      await prisma.analysisJob.update({
        where: { id: mlJob.id },
        data: {
          status: "RUNNING",
          startedAt: new Date(),
          errorMessage: null
        }
      });

      try {
        await processMlAnalysisJob(prisma, mlJob.id);
      } catch (e) {
        console.error("ML worker error:", e);
        await prisma.analysisJob.update({
          where: { id: mlJob.id },
          data: {
            status: "FAILED",
            input: sanitizeInput(mlJob.input) as never,
            errorMessage: e instanceof Error ? e.message : "ML-jobbet misslyckades.",
            finishedAt: new Date()
          }
        });
      }

      continue;
    }

    await sleep(1500);
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

function resolvePrismaWorkspaceDir() {
  const explicit = process.env.PRISMA_WORKSPACE_DIR;
  if (explicit && existsSync(explicit)) return explicit;

  const candidates = [
    // Render default
    "/opt/render/project/src/prisma",
    // Local dev: start command from apps/worker
    resolve(process.cwd(), "../../prisma"),
    // Local dev: start command from repo root
    resolve(process.cwd(), "prisma"),
    // Compiled dist fallback
    resolve(__dirname, "../../../prisma")
  ];

  const found = candidates.find((candidate) => existsSync(candidate));
  return found ?? candidates[0];
}
