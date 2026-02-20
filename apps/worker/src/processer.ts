import type { PrismaClient } from "@prisma/client";

/**
 * Worker-processor:
 * - Validera
 * - Matcha device via qr/serial
 * - Skapa placeholder device om okänd (så admin kan komplettera)
 * - Skapa rekommendation baserat på livslängd (demo)
 */
export async function processIngressEvent(prisma: PrismaClient, ingressId: string) {
  const evt = await prisma.ingressEvent.findUnique({ where: { id: ingressId } });
  if (!evt) return;

  const deviceRef = String(evt.deviceRef ?? "").trim();
  if (!deviceRef) return reject(prisma, evt.id, ["deviceRef saknas"]);

  let device = await prisma.device.findFirst({
    where: { OR: [{ qrCodeId: deviceRef }, { serialNumber: deviceRef }] },
    include: { model: true, site: { include: { customer: true } } }
  });

  if (!device) {
    const defaultModel = await prisma.productModel.findFirst({ orderBy: { displayName: "asc" } });
    if (!defaultModel) return reject(prisma, evt.id, ["Inga ProductModel finns i DB"]);

    device = await prisma.device.create({
      data: {
        serialNumber: `UNKNOWN-${evt.eventId.slice(0, 8)}`,
        qrCodeId: deviceRef.startsWith("QR-") ? deviceRef : `QR-${evt.eventId.slice(0, 8)}`,
        modelId: defaultModel.id,
        status: "UNKNOWN"
      },
      include: { model: true, site: { include: { customer: true } } }
    });
  }

  const recs = await buildRecommendations(prisma, device.id);
  for (const r of recs) {
    await prisma.recommendation.create({
      data: { deviceId: device.id, type: r.type, reason: r.reason }
    });
  }

  await prisma.ingressEvent.update({
    where: { id: evt.id },
    data: { status: "ACCEPTED", processedAt: new Date() }
  });
}

async function buildRecommendations(prisma: PrismaClient, deviceId: string) {
  const device = await prisma.device.findUnique({
    where: { id: deviceId },
    include: { model: true, recommendations: { orderBy: { createdAt: "desc" }, take: 1 } }
  });
  if (!device) return [];

  const now = new Date();
  const last = device.recommendations[0];
  if (last && daysBetween(last.createdAt, now) < 7) return [];

  const install = device.installDate;
  if (!install) {
    return [{ type: "INSPECT" as const, reason: "Installationsdatum saknas – rekommenderar inspektion och komplettering." }];
    }

  const ageMonths = monthsBetween(install, now);
  const lifetime = device.model.expectedLifetimeMonths;

  if (ageMonths > lifetime) {
    return [{ type: "REPLACE" as const, reason: `Enheten är ${ageMonths} månader gammal (förväntad livslängd ${lifetime}). Rekommenderar byte.` }];
  }

  if (ageMonths > lifetime * 0.8) {
    return [{ type: "SERVICE" as const, reason: `Enheten närmar sig livslängdsgräns (${ageMonths}/${lifetime}). Rekommenderar service/inspektion.` }];
  }

  return [];
}

async function reject(prisma: PrismaClient, ingressId: string, errors: string[]) {
  await prisma.ingressEvent.update({
    where: { id: ingressId },
    data: {
      status: "REJECTED",
      validationErrors: { errors },
      processedAt: new Date()
    }
  });
}

function monthsBetween(a: Date, b: Date) {
  return (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
}
function daysBetween(a: Date, b: Date) {
  return Math.floor((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}
