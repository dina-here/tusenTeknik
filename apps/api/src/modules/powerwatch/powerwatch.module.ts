import { Module } from "@nestjs/common";
import { PowerwatchController } from "./powerwatch.controller";
import { PowerwatchService } from "./powerwatch.service";

@Module({
  controllers: [PowerwatchController],
  providers: [PowerwatchService]
})
export class PowerwatchModule {}
