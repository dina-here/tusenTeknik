import { Module } from "@nestjs/common";
import { SizingController } from "./sizing.controller";
import { SizingService } from "./sizing.service";

@Module({
  controllers: [SizingController],
  providers: [SizingService]
})
export class SizingModule {}
