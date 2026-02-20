import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../common/prisma/prisma.service";

/**
 * Dimensionering (demo):
 * - Sparar request + result
 * - Returnerar rekommenderad modell + batterikapacitet + marginal
 *
 * Viktigt: algorithmVersion gör att vi kan förbättra logik senare utan att “förstöra historik”.
 */
@Injectable()
export class SizingService {
  constructor(private prisma: PrismaService) {}

  async createSizing(input: { load: number; backupHours: number; temperature: number }) {
    const sizingReq = await this.prisma.sizingRequest.create({
      data: { inputs: input }
    });

    const result = await this.recommendSizing(input);

    await this.prisma.sizingResult.create({
      data: {
        sizingRequestId: sizingReq.id,
        recommendedModelSku: result.recommendedModelSku,
        batteryCapacityAh: result.batteryCapacityAh,
        safetyMargin: result.safetyMargin,
        algorithmVersion: result.algorithmVersion
      }
    });

    return { sizingRequestId: sizingReq.id, ...result };
  }

  private async recommendSizing(input: { load: number; backupHours: number; temperature: number }) {
    const baseWh = input.load * input.backupHours;

    // Demo-approx: 12V. I verkligheten kan det vara 24/48V etc.
    const baseAh = Math.ceil(baseWh / 12);

    // Enkel marginal baserat på temperatur
    const tempPenalty = input.temperature < 10 ? 0.15 : input.temperature > 30 ? 0.10 : 0.05;
    const safetyMargin = 0.20 + tempPenalty;

    const targetAh = Math.ceil(baseAh * (1 + safetyMargin));

    const models = await this.prisma.productModel.findMany({
      where: { batteryCapacityAh: { not: null } },
      orderBy: { batteryCapacityAh: "asc" }
    });

    const picked = models.find((m) => (m.batteryCapacityAh ?? 0) >= targetAh) ?? models[models.length - 1];

    return {
      recommendedModelSku: picked?.sku ?? "UNKNOWN",
      batteryCapacityAh: targetAh,
      safetyMargin,
      algorithmVersion: "sizing-v1"
    };
  }
}
