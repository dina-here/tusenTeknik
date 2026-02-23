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

  const payload = (evt.payload ?? {}) as { installYear?: number; lastServiceYear?: number };
  const installYear = Number.isFinite(payload.installYear) ? payload.installYear : undefined;
  const lastServiceYear = Number.isFinite(payload.lastServiceYear) ? payload.lastServiceYear : undefined;

  if (installYear && !device.installDate) {
    await prisma.device.update({
      where: { id: device.id },
      data: { installDate: new Date(installYear, 0, 1) }
    });
  }

  if (lastServiceYear) {
    const from = new Date(lastServiceYear, 0, 1);
    const to = new Date(lastServiceYear + 1, 0, 1);
    const exists = await prisma.serviceHistory.findFirst({
      where: {
        deviceId: device.id,
        serviceDate: { gte: from, lt: to }
      }
    });
    if (!exists) {
      await prisma.serviceHistory.create({
        data: {
          deviceId: device.id,
          serviceDate: from,
          action: "SERVICE",
          notes: "Serviceår rapporterat från PowerWatch"
        }
      });
    }
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
