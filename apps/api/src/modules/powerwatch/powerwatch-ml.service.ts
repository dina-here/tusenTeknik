import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../common/prisma/prisma.service";

type AnalysisJobRecord = {
  id: string;
  jobType: string;
  status: string;
  input: unknown;
  result: unknown;
  errorMessage: string | null;
  requestedAt: Date;
  startedAt: Date | null;
  finishedAt: Date | null;
};

type MlJobInput = {
  datasetName?: string;
  targetStrategy: string;
  randomSeed?: number;
  testSize?: number;
  modelNames?: string[];
  deviceFileName?: string;
  telemetryFileName?: string;
  serviceFileName?: string;
  deviceCsv: string;
  telemetryCsv: string;
  serviceCsv?: string;
};

@Injectable()
export class PowerwatchMlService {
  constructor(private readonly prisma: PrismaService) {}

  async enqueueJob(input: MlJobInput) {
    this.validatePayloadSize(input);

    const job = await this.prisma.analysisJob.create({
      data: {
        jobType: "POWERWATCH_TRAIN_EVALUATE",
        status: "QUEUED",
        input: input as never
      }
    });

    return this.sanitizeJob(job);
  }

  async listJobs() {
    const jobs = await this.prisma.analysisJob.findMany({
      orderBy: { requestedAt: "desc" },
      take: 20
    });

    return jobs.map((job) => this.sanitizeJob(job));
  }

  async getJob(id: string) {
    const job = await this.prisma.analysisJob.findUnique({ where: { id } });
    if (!job) {
      throw new NotFoundException("ML-jobbet hittades inte.");
    }

    return this.sanitizeJob(job);
  }

  private validatePayloadSize(input: MlJobInput) {
    const totalBytes = [input.deviceCsv, input.telemetryCsv, input.serviceCsv ?? ""]
      .reduce((sum, value) => sum + Buffer.byteLength(value, "utf8"), 0);

    if (totalBytes > 10 * 1024 * 1024) {
      throw new BadRequestException("CSV-uppladdningen är för stor. Dela upp filerna eller använd mindre testdata i demo-läget.");
    }

    if (!input.deviceCsv.trim() || !input.telemetryCsv.trim()) {
      throw new BadRequestException("Både device-CSV och telemetry-CSV måste skickas med.");
    }
  }

  private sanitizeJob(job: AnalysisJobRecord) {
    return {
      ...job,
      input: this.sanitizeInput(job.input)
    };
  }

  private sanitizeInput(input: unknown) {
    if (!input || typeof input !== "object" || Array.isArray(input)) {
      return input;
    }

    const record = input as Record<string, unknown>;
    const sanitized: Record<string, unknown> = { ...record };

    const deviceCsv = typeof record.deviceCsv === "string" ? record.deviceCsv : "";
    const telemetryCsv = typeof record.telemetryCsv === "string" ? record.telemetryCsv : "";
    const serviceCsv = typeof record.serviceCsv === "string" ? record.serviceCsv : "";

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
}
