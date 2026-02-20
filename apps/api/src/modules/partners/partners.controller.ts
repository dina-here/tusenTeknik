import { Body, Controller, Get, Param, Post, Req, UseGuards } from "@nestjs/common";
import { PartnersService } from "./partners.service";
import { PartnerApiKeyGuard } from "./partner-api-key.guard";

@Controller("/api/partners")
@UseGuards(PartnerApiKeyGuard)
export class PartnersController {
  constructor(private readonly service: PartnersService) {}

  @Post("/customers")
  createCustomer(@Req() req: any, @Body() body: any) {
    return this.service.createCustomer(req.partner.id, body);
  }

  @Get("/devices/:serial/status")
  deviceStatus(@Param("serial") serial: string) {
    return this.service.deviceStatus(serial);
  }
}
