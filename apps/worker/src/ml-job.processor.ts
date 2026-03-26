import { spawn } from "child_process";
import { mkdirSync } from "fs";
import { resolve } from "path";
import type { PrismaClient } from "@prisma/client";

type PythonJobResult = {
  inputSummary?: Record<string, unknown>;
  [key: string]: unknown;
};

/**
 * Kör Python-baserad ML-analys som ett asynkront jobb i worker-processen.
 * API:t enqueuar bara jobbet. All CPU-tung logik ligger här.
 */
export async function processMlAnalysisJob(prisma: PrismaClient, jobId: string) {
  const job = await prisma.analysisJob.findUnique({ where: { id: jobId } });
  if (!job) return;

  const artifactDir = resolve(__dirname, "..", "..", "prognos", "artifacts", job.id);
  const scriptPath = resolve(__dirname, "..", "..", "prognos", "prognos.py");
  mkdirSync(artifactDir, { recursive: true });

  const rawInput = isRecord(job.input) ? job.input : {};
  const payload = {
    ...rawInput,
    jobId: job.id,
    artifactDir
  };

  const result = await runPythonJob(scriptPath, payload);
  const sanitizedInput = isRecord(result.inputSummary)
    ? result.inputSummary
    : sanitizeInput(rawInput);

  await prisma.analysisJob.update({
    where: { id: job.id },
    data: {
      status: "SUCCEEDED",
      input: sanitizedInput as never,
      result: result as never,
      errorMessage: null,
      finishedAt: new Date()
    }
  });
}

export function sanitizeInput(input: unknown) {
  if (!isRecord(input)) {
    return input;
  }

  const sanitized: Record<string, unknown> = { ...input };
  const deviceCsv = typeof input.deviceCsv === "string" ? input.deviceCsv : "";
  const telemetryCsv = typeof input.telemetryCsv === "string" ? input.telemetryCsv : "";
  const serviceCsv = typeof input.serviceCsv === "string" ? input.serviceCsv : "";

  delete sanitized.deviceCsv;
  delete sanitized.telemetryCsv;
  delete sanitized.serviceCsv;

  sanitized.csvBytes = {
    deviceCsv: Buffer.byteLength(deviceCsv, "utf8"),
    telemetryCsv: Buffer.byteLength(telemetryCsv, "utf8"),
    serviceCsv: Buffer.byteLength(serviceCsv, "utf8")
  };

  return sanitized;
}

async function runPythonJob(scriptPath: string, payload: Record<string, unknown>) {
  const pythonExecutable = process.env.ML_PYTHON_EXECUTABLE || "python";

  return new Promise<PythonJobResult>((resolvePromise, rejectPromise) => {
    const child = spawn(pythonExecutable, [scriptPath, "--job-id", String(payload.jobId ?? "unknown")], {
      env: {
        ...process.env,
        PYTHONIOENCODING: "utf-8"
      },
      stdio: ["pipe", "pipe", "pipe"]
    });

    let stdout = "";
    let stderr = "";
    let settled = false;

    const resolveOnce = (result: PythonJobResult) => {
      if (settled) return;
      settled = true;
      resolvePromise(result);
    };

    const rejectOnce = (error: Error) => {
      if (settled) return;
      settled = true;
      rejectPromise(error);
    };

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", (error) => {
      rejectOnce(new Error(`Kunde inte starta Python-processen: ${error.message}`));
    });

    child.stdin.on("error", (error) => {
      const details = stderr.trim() || stdout.trim();
      rejectOnce(
        new Error(
          details
            ? `Python-processen avbröts innan indata kunde skickas. ${details}`
            : `Python-processen avbröts innan indata kunde skickas: ${error.message}`
        )
      );
    });

    child.on("close", (code) => {
      if (code !== 0) {
        rejectOnce(new Error(stderr.trim() || stdout.trim() || `Python-processen avslutades med kod ${code}`));
        return;
      }

      try {
        const parsed = JSON.parse(stdout) as PythonJobResult;
        resolveOnce(parsed);
      } catch (error) {
        rejectOnce(new Error(`Ogiltigt JSON-svar från Python-jobbet. ${stderr || String(error)}`));
      }
    });

    try {
      child.stdin.write(JSON.stringify(payload));
      child.stdin.end();
    } catch (error) {
      rejectOnce(
        new Error(
          `Kunde inte skriva jobbdata till Python-processen: ${error instanceof Error ? error.message : String(error)}`
        )
      );
    }
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
