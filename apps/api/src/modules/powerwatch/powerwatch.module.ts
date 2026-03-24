import { Module } from "@nestjs/common";
import { PowerwatchController } from "./powerwatch.controller";
import { PowerwatchMlService } from "./powerwatch-ml.service";
import { PowerwatchService } from "./powerwatch.service";

@Module({
  controllers: [PowerwatchController],
  providers: [PowerwatchService, PowerwatchMlService]
})
export class PowerwatchModule {}
