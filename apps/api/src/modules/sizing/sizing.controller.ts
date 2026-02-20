import { Body, Controller, Post, UsePipes } from "@nestjs/common";
import { SizingInputSchema } from "@milleteknik/shared";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { SizingService } from "./sizing.service";

@Controller("/api/sizing")
export class SizingController {
  constructor(private readonly service: SizingService) {}

  @Post("/")
  @UsePipes(new ZodValidationPipe(SizingInputSchema))
  async createSizing(@Body() input: any) {
    return this.service.createSizing(input);
  }
}
