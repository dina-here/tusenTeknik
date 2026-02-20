import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../common/prisma/prisma.service";
import { HealthService } from "./health.service";

/**
 * Telemetri:
 * - Spara rådata (append-only)
 * - Skapa health snapshot (demo) med enkel “ML-lik” scoring
 *
 * I produktion kan snapshot skapas async via queue för bättre skalning.
 */
@Injectable()
export class TelemetryService {
  constructor(private prisma: PrismaService, private health: HealthService) {}

  async ingest(input: { deviceRef: string; timestamp: string; metrics: any }) {
    const device = await this.prisma.device.findFirst({
      where: { OR: [{ qrCodeId: input.deviceRef }, { serialNumber: input.deviceRef }] },
      include: { model: true }
    });

    if (!device) {
      throw new NotFoundException("Okänd enhet. Skapa i PowerAdmin eller rapportera via PowerWatch först.");
    }

    await this.prisma.telemetryRaw.create({
      data: {
        deviceId: device.id,
        timestamp: new Date(input.timestamp),
        metrics: input.metrics
      }
    });

    const snapshot = this.health.computeHealthSnapshot({
      device: { installDate: device.installDate, expectedLifetimeMonths: device.model.expectedLifetimeMonths },
      metrics: input.metrics
    });

    await this.prisma.deviceHealthSnapshot.create({
      data: {
        deviceId: device.id,
        health: snapshot.health,
        score: snapshot.score,
        reasons: snapshot.reasons
      }
    });

    return { ok: true, deviceId: device.id, snapshot };
  }
}
