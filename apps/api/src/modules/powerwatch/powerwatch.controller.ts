import { Body, Controller, Get, HttpCode, Param, Post, UsePipes } from "@nestjs/common";
import { BatchSchema, PowerwatchMlJobRequestSchema } from "@milleteknik/shared";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { PowerwatchMlService } from "./powerwatch-ml.service";
import { PowerwatchService } from "./powerwatch.service";

@Controller("/api/powerwatch")
export class PowerwatchController {
  constructor(
    private readonly service: PowerwatchService,
    private readonly mlService: PowerwatchMlService
  ) {}

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

  @Post("/ml/jobs")
  @HttpCode(202)
  @UsePipes(new ZodValidationPipe(PowerwatchMlJobRequestSchema))
  async enqueueMlJob(@Body() body: any) {
    return this.mlService.enqueueJob(body);
  }

  @Get("/ml/jobs")
  async listMlJobs() {
    return this.mlService.listJobs();
  }

  @Get("/ml/jobs/:id")
  async getMlJob(@Param("id") id: string) {
    return this.mlService.getJob(id);
  }
}
