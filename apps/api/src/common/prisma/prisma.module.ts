import { Global, Module } from "@nestjs/common";
import { PrismaService } from "./prisma.service";

/**
 * Global modul så vi slipper importera PrismaModule överallt.
 * (Förenklar demo-koden och gör den lättare att läsa.)
 */
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService]
})
export class PrismaModule {}
