import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import { AdminService } from "./admin.service";
import { PrismaService } from "../../common/prisma/prisma.service";

@Controller("/api/admin")
export class AdminController {
  constructor(private readonly service: AdminService, private readonly prisma: PrismaService) {}

  @Get("/inbox")
  inbox() {
    return this.service.listInbox();
  }

  @Get("/devices")
  devices() {
    return this.service.listDevices();
  }

  @Get("/devices/:id")
  device(@Param("id") id: string) {
    return this.service.getDevice(id);
  }

  @Get("/service-history")
  serviceHistory() {
    return this.service.listServiceHistory();
  }

  @Post("/inbox/:id/resolve")
  resolveInbox(
    @Param("id") id: string,
    @Body() body: { action: "merge" | "create"; deviceId?: string }
  ) {
    return this.service.resolveInbox(id, body);
  }

  // 1) Recommendations (senaste 50)
  @Get("recommendations")
  async recommendations() {
    return this.prisma.recommendation.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
      include: {
        device: {
          include: {
            model: true,
            site: { include: { customer: true } },
          },
        },
      },
    });
  }

  // 2) Telemetry (senaste 200 readings)
  @Get("telemetry")
  async telemetry() {
    return this.prisma.telemetryRaw.findMany({
      orderBy: { timestamp: "desc" },
      take: 200,
      include: {
        device: {
          include: {
            model: true,
            site: { include: { customer: true } },
          },
        },
      },
    });
  }
}
