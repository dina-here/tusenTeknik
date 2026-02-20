import { Module } from "@nestjs/common";
import { PrismaModule } from "./common/prisma/prisma.module";
import { HealthModule } from "./modules/health/health.module";
import { PowerwatchModule } from "./modules/powerwatch/powerwatch.module";
import { SizingModule } from "./modules/sizing/sizing.module";
import { TelemetryModule } from "./modules/telemetry/telemetry.module";
import { AdminModule } from "./modules/admin/admin.module";
import { PartnersModule } from "./modules/partners/partners.module";

@Module({
  imports: [
    PrismaModule,
    HealthModule,
    PowerwatchModule,
    SizingModule,
    TelemetryModule,
    AdminModule,
    PartnersModule
  ]
})
export class AppModule {}
