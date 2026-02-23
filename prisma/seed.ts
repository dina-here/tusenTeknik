import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * Seedar demo-data så att admin-vyerna känns “på riktigt”.
 * Kategorierna är inspirerade av menyn på milleteknik.se (dummy, ej scraping).
 */
async function main() {
  const categories = [
    "Produktnyheter",
    "Webbshop",
    "ECO-serien",
    "NEO-serien",
    "NOVA-serien",
    "EN54-serien",
    "PoE",
    "Utomhus strömförsörjning",
    "Nätaggregat",
    "Tillbehör och tillval",
    "Batteriboxar och batterihyllor",
    "Batterier",
    "SINUS UPS"
  ];

  for (const name of categories) {
    await prisma.productCategory.upsert({
      where: { name },
      create: { name },
      update: {}
    });
  }

  const eco = await prisma.productCategory.findUnique({ where: { name: "ECO-serien" } });
  const neo = await prisma.productCategory.findUnique({ where: { name: "NEO-serien" } });
  const en54 = await prisma.productCategory.findUnique({ where: { name: "EN54-serien" } });
  const sinus = await prisma.productCategory.findUnique({ where: { name: "SINUS UPS" } });
  const batteries = await prisma.productCategory.findUnique({ where: { name: "Batterier" } });

  if (!eco || !neo || !en54 || !sinus || !batteries) throw new Error("Seed: kategorier saknas.");

  const models = [
    { categoryId: eco.id, sku: "MT-ECO-250", displayName: "ECO 250", expectedLifetimeMonths: 72, nominalPowerW: 250, batteryCapacityAh: 45 },
    { categoryId: neo.id, sku: "MT-NEO-500", displayName: "NEO 500", expectedLifetimeMonths: 84, nominalPowerW: 500, batteryCapacityAh: 65 },
    { categoryId: en54.id, sku: "MT-EN54-300", displayName: "EN54 300", expectedLifetimeMonths: 60, nominalPowerW: 300, batteryCapacityAh: 55, notes: "Demo: anpassad för EN54-miljöer." },
    { categoryId: sinus.id, sku: "MT-SINUS-UPS-800", displayName: "SINUS UPS 800", expectedLifetimeMonths: 72, nominalPowerW: 800, batteryCapacityAh: 80 },
    {
      categoryId: batteries.id,
      sku: "MT113-12V01-01",
      displayName: "UPLUS 6+ Design Life 1,2 Ah Battery (E-nummer 52 305 34)",
      expectedLifetimeMonths: 72,
      batteryCapacityAh: 1.2,
      notes: "Artikelnummer MT113-12V01-01"
    },
    {
      categoryId: batteries.id,
      sku: "MT113-12V14-01",
      displayName: "UPLUS 10+ Design Life 14Ah Battery (E-nummer 5230537)",
      expectedLifetimeMonths: 120,
      batteryCapacityAh: 14,
      notes: "Artikelnummer MT113-12V14-01"
    },
    {
      categoryId: neo.id,
      sku: "FM01P10024P250-DSP1",
      displayName: "NEO-serien 24V 25A FLX M Display (E-nummer 52 136 35)",
      expectedLifetimeMonths: 84,
      nominalPowerW: 600,
      notes: "Batteribackup, artikelnummer FM01P10024P250-DSP1"
    }
  ];

  for (const m of models) {
    await prisma.productModel.upsert({
      where: { sku: m.sku },
      create: m,
      update: m
    });
  }

  // Partner + kund + site + device
  const partner = await prisma.partner.upsert({
    where: { apiKey: "demo-partner-key" },
    create: { name: "DemoPartner AB", apiKey: "demo-partner-key" },
    update: {}
  });

// Kund: name är inte unique i schema, därför kan vi inte använda upsert på name.
// Vi gör istället: findFirst -> update/create.
const existingCustomer = await prisma.customer.findFirst({
  where: { name: "Brf Solgläntan" }
});

const customer = existingCustomer
  ? await prisma.customer.update({
      where: { id: existingCustomer.id },
      data: { partnerId: partner.id }
    })
  : await prisma.customer.create({
      data: { name: "Brf Solgläntan", partnerId: partner.id }
    });

  const site = await prisma.site.upsert({
    where: { id: "site-demo-1" },
    create: { id: "site-demo-1", customerId: customer.id, name: "Källare - Elrum", address: "Solgatan 1, 123 45 Stockholm" },
    update: {}
  });

  await prisma.contactPerson.upsert({
    where: { id: "contact-demo-1" },
    create: { id: "contact-demo-1", customerId: customer.id, name: "Fastighetsskötare", phone: "070-000 00 00", email: "skotare@solglantan.se", role: "Drift" },
    update: {}
  });

  const neo500 = await prisma.productModel.findUnique({ where: { sku: "MT-NEO-500" } });
  if (!neo500) throw new Error("Seed: model saknas.");

  await prisma.device.upsert({
    where: { serialNumber: "SN-NEO-0001" },
    create: {
      serialNumber: "SN-NEO-0001",
      qrCodeId: "QR-NEO-0001",
      modelId: neo500.id,
      siteId: site.id,
      installDate: new Date("2018-02-01"),
      status: "ACTIVE"
    },
    update: {}
  });
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
