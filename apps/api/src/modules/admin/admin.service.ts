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
}
