import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../common/prisma/prisma.service";

/**
 * Service-lager: DB-skrivning + idempotenshantering.
 * Logiken hålls här (inte i controller) för att vara testbar och ren.
 */
@Injectable()
export class PowerwatchService {
  constructor(private prisma: PrismaService) {}

  async insertBatch(events: any[]) {
    const results = await Promise.all(
      events.map(async (evt) => {
        try {
          await this.prisma.ingressEvent.create({
            data: {
              eventId: evt.eventId,
              source: evt.source,
              deviceRef: evt.deviceRef,
              payload: evt.payload,
              contact: evt.contact ?? undefined,
              status: "RECEIVED",
              receivedAt: new Date(evt.timestamp)
            }
          });
          return { eventId: evt.eventId, status: "RECEIVED" as const };
        } catch (e: any) {
          // Prisma unique constraint => event finns redan
          if (e?.code === "P2002") {
            return { eventId: evt.eventId, status: "ALREADY_RECEIVED" as const };
          }
          throw e;
        }
      })
    );

    return { received: results };
  }
}
