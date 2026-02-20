import { Controller, Get, Param } from "@nestjs/common";
import { AdminService } from "./admin.service";

@Controller("/api/admin")
export class AdminController {
  constructor(private readonly service: AdminService) {}

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
}
