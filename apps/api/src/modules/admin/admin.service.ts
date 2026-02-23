import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../common/prisma/prisma.service";

@Injectable()
export class AdminService {
  constructor(private prisma: PrismaService) {}

  async listInbox() {
    return this.prisma.ingressEvent.findMany({
      orderBy: { receivedAt: "desc" },
      take: 100
    });
  }

  async listDevices() {
    return this.prisma.device.findMany({
      include: {
        model: true,
        site: { include: { customer: true } },
        serviceHistory: { orderBy: { serviceDate: "desc" }, take: 1 },
        recommendations: { orderBy: { createdAt: "desc" }, take: 3 },
        healthSnapshots: { orderBy: { timestamp: "desc" }, take: 1 }
      },
      orderBy: { createdAt: "desc" },
      take: 200
    });
  }

  async getDevice(id: string) {
    const device = await this.prisma.device.findUnique({
      where: { id },
      include: {
        model: true,
        site: { include: { customer: true } },
        serviceHistory: { orderBy: { serviceDate: "desc" } },
        recommendations: { orderBy: { createdAt: "desc" } },
        healthSnapshots: { orderBy: { timestamp: "desc" }, take: 50 },
        telemetryRaw: { orderBy: { timestamp: "desc" }, take: 50 }
      }
    });

    if (!device) throw new NotFoundException("Enhet saknas");
    return device;
  }

  async listServiceHistory() {
    return this.prisma.serviceHistory.findMany({
      orderBy: { serviceDate: "desc" },
      take: 200,
      include: {
        device: {
          include: {
            model: true,
            site: { include: { customer: true } }
          }
        }
      }
    });
  }

  async resolveInbox(
    ingressId: string,
    input: { action: "merge" | "create"; deviceId?: string }
  ) {
    const evt = await this.prisma.ingressEvent.findUnique({ where: { id: ingressId } });
    if (!evt) throw new NotFoundException("Inbox-event saknas");

    const deviceRef = String(evt.deviceRef ?? "").trim();
    if (!deviceRef) throw new NotFoundException("deviceRef saknas");

    let device = null as any;

    if (input.action === "merge") {
      if (!input.deviceId) throw new NotFoundException("deviceId saknas");
      device = await this.prisma.device.findUnique({
        where: { id: input.deviceId },
        include: { model: true, recommendations: { orderBy: { createdAt: "desc" }, take: 1 } }
      });
      if (!device) throw new NotFoundException("Enhet saknas");
    } else {
      const defaultModel = await this.prisma.productModel.findFirst({ orderBy: { displayName: "asc" } });
      if (!defaultModel) throw new NotFoundException("Inga ProductModel finns i DB");

      const serialNumber = deviceRef.startsWith("SN-") ? deviceRef : `SN-${evt.eventId.slice(0, 8)}`;
      const qrCodeId = deviceRef.startsWith("QR-") ? deviceRef : `QR-${evt.eventId.slice(0, 8)}`;

      device = await this.prisma.device.create({
        data: {
          serialNumber,
          qrCodeId,
          modelId: defaultModel.id,
          status: "ACTIVE"
        },
        include: { model: true, recommendations: { orderBy: { createdAt: "desc" }, take: 1 } }
      });
    }

    const payload = (evt.payload ?? {}) as { installYear?: number; lastServiceYear?: number };
    const installYear = Number.isFinite(payload.installYear) ? payload.installYear : undefined;
    const lastServiceYear = Number.isFinite(payload.lastServiceYear) ? payload.lastServiceYear : undefined;

    if (installYear && !device.installDate) {
      await this.prisma.device.update({
        where: { id: device.id },
        data: { installDate: new Date(installYear, 0, 1) }
      });
    }

    if (lastServiceYear) {
      const from = new Date(lastServiceYear, 0, 1);
      const to = new Date(lastServiceYear + 1, 0, 1);
      const exists = await this.prisma.serviceHistory.findFirst({
        where: { deviceId: device.id, serviceDate: { gte: from, lt: to } }
      });
      if (!exists) {
        await this.prisma.serviceHistory.create({
          data: {
            deviceId: device.id,
            serviceDate: from,
            action: "SERVICE",
            notes: "Serviceår rapporterat från PowerWatch"
          }
        });
      }
    }

    await this.createRecommendations(device.id);

    await this.prisma.ingressEvent.update({
      where: { id: evt.id },
      data: { status: "ACCEPTED", processedAt: new Date() }
    });

    return { status: "ACCEPTED" as const, deviceId: device.id };
  }

  private async createRecommendations(deviceId: string) {
    const device = await this.prisma.device.findUnique({
      where: { id: deviceId },
      include: { model: true, recommendations: { orderBy: { createdAt: "desc" }, take: 1 } }
    });
    if (!device) return;

    const now = new Date();
    const last = device.recommendations[0];
    if (last && this.daysBetween(last.createdAt, now) < 7) return;

    const install = device.installDate;
    if (!install) {
      await this.prisma.recommendation.create({
        data: {
          deviceId: device.id,
          type: "INSPECT",
          reason: "Installationsdatum saknas – rekommenderar inspektion och komplettering."
        }
      });
      return;
    }

    const ageMonths = this.monthsBetween(install, now);
    const lifetime = device.model.expectedLifetimeMonths;

    if (ageMonths > lifetime) {
      await this.prisma.recommendation.create({
        data: {
          deviceId: device.id,
          type: "REPLACE",
          reason: `Enheten är ${ageMonths} månader gammal (förväntad livslängd ${lifetime}). Rekommenderar byte.`
        }
      });
      return;
    }

    if (ageMonths > lifetime * 0.8) {
      await this.prisma.recommendation.create({
        data: {
          deviceId: device.id,
          type: "SERVICE",
          reason: `Enheten närmar sig livslängdsgräns (${ageMonths}/${lifetime}). Rekommenderar service/inspektion.`
        }
      });
    }
  }

  private monthsBetween(a: Date, b: Date) {
    return (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
  }

  private daysBetween(a: Date, b: Date) {
    return Math.floor((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
  }
}
