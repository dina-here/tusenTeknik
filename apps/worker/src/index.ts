import { PrismaClient } from "@prisma/client";
import { processIngressEvent } from "./processor";

const prisma = new PrismaClient();

/**
 * DB-polling worker:
 * - Enkel och stabil för demo (ingen Redis krävs).
 * - Plockar nästa IngressEvent med status RECEIVED.
 */
async function loop() {
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const next = await prisma.ingressEvent.findFirst({
      where: { status: "RECEIVED" },
      orderBy: { receivedAt: "asc" }
    });

    if (!next) {
      await sleep(1500);
      continue;
    }

    await prisma.ingressEvent.update({
      where: { id: next.id },
      data: { status: "PROCESSING" }
    });

    try {
      await processIngressEvent(prisma, next.id);
    } catch (e) {
      console.error("Worker error:", e);
      await prisma.ingressEvent.update({
        where: { id: next.id },
        data: {
          status: "REJECTED",
          validationErrors: { message: "Worker failed", hint: "Se worker-loggar" },
          processedAt: new Date()
        }
      });
    }
  }
}

loop().catch((e) => {
  console.error(e);
  process.exit(1);
});

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
