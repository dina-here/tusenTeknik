import { Module } from "@nestjs/common";
import { TelemetryController } from "./telemetry.controller";
import { TelemetryService } from "./telemetry.service";
import { HealthService } from "./health.service";

@Module({
  controllers: [TelemetryController],
  providers: [TelemetryService, HealthService]
})
export class TelemetryModule {}
