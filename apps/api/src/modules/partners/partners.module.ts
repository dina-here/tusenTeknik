import { Module } from "@nestjs/common";
import { PartnersController } from "./partners.controller";
import { PartnersService } from "./partners.service";
import { PartnerApiKeyGuard } from "./partner-api-key.guard";

@Module({
  controllers: [PartnersController],
  providers: [PartnersService, PartnerApiKeyGuard]
})
export class PartnersModule {}
