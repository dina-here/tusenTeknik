import { Body, Controller, Post, UsePipes } from "@nestjs/common";
import { TelemetrySchema } from "@milleteknik/shared";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { TelemetryService } from "./telemetry.service";

@Controller("/api/telemetry")
export class TelemetryController {
  constructor(private readonly service: TelemetryService) {}

  @Post("/")
  @UsePipes(new ZodValidationPipe(TelemetrySchema))
  async ingest(@Body() body: any) {
    return this.service.ingest(body);
  }
}
