import { Body, Controller, HttpCode, Post, UsePipes } from "@nestjs/common";
import { BatchSchema } from "@milleteknik/shared";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { PowerwatchService } from "./powerwatch.service";

@Controller("/api/powerwatch")
export class PowerwatchController {
  constructor(private readonly service: PowerwatchService) {}

  /**
   * Offline/batch-synk:
   * - Appen skickar en lista med events.
   * - Varje event har eventId (UUID).
   * - DB har UNIQUE(eventId) => retry säkert, inga dubletter.
   */
  @Post("/events/batch")
  @HttpCode(202)
  @UsePipes(new ZodValidationPipe(BatchSchema))
  async batch(@Body() body: any) {
    return this.service.insertBatch(body.events);
  }
}
