import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../common/prisma/prisma.service";

@Injectable()
export class PartnersService {
  constructor(private prisma: PrismaService) {}

  async createCustomer(partnerId: string, body: any) {
    const name = String(body?.name ?? "").trim();
    if (!name) throw new BadRequestException("name required");

    return this.prisma.customer.create({
      data: { name, partnerId }
    });
  }

  async deviceStatus(serialNumber: string) {
    const device = await this.prisma.device.findUnique({
      where: { serialNumber },
      include: { healthSnapshots: { orderBy: { timestamp: "desc" }, take: 1 } }
    });

    if (!device) throw new NotFoundException("Unknown device");

    const last = device.healthSnapshots[0];
    return {
      serialNumber: device.serialNumber,
      status: device.status,
      health: last?.health ?? "UNKNOWN",
      score: last?.score ?? null,
      timestamp: last?.timestamp ?? null
    };
  }
}
