import { Injectable } from "@nestjs/common";

/**
 * Dummy-ML:
 * - Detta är inte “riktig ML”, men upplägget liknar scoring/prediction.
 * - Poängen i demot: pipeline + datamodell är redo för riktig modell senare.
 *
 * Framtid (kort instruktion):
 * 1) Skapa features: ålder, temp/voltage-trender, fault-rate, servicehistorik
 * 2) Label: batteribyte inom X månader, serviceärende, incidenter
 * 3) Träna modell (logistisk regression / GBDT)
 * 4) Lägg prediction i separat tjänst (versionerad modell + driftövervakning)
 */
@Injectable()
export class HealthService {
  computeHealthSnapshot(input: {
    device: { installDate: Date | null; expectedLifetimeMonths: number };
    metrics: any;
  }) {
    const voltage = Number(input.metrics.voltage ?? NaN);
    const temperature = Number(input.metrics.temperature ?? NaN);

    const reasons: string[] = [];
    const ageMonths = input.device.installDate ? monthsBetween(input.device.installDate, new Date()) : 0;

    const lifetime = input.device.expectedLifetimeMonths;
    const ageRatio = lifetime > 0 ? ageMonths / lifetime : 0;

    // Enkel risk-summering (0..1)
    let risk = 0;

    if (!Number.isNaN(voltage)) {
      if (voltage < 11.5) { risk += 0.45; reasons.push("Låg spänning"); }
      else if (voltage < 12.0) { risk += 0.20; reasons.push("Något låg spänning"); }
    }

    if (!Number.isNaN(temperature)) {
      if (temperature > 35) { risk += 0.25; reasons.push("Hög temperatur"); }
      else if (temperature < 0) { risk += 0.15; reasons.push("Mycket låg temperatur"); }
    }

    if (ageRatio > 1.0) { risk += 0.35; reasons.push("Över förväntad livslängd"); }
    else if (ageRatio > 0.8) { risk += 0.20; reasons.push("Nära livslängdsgräns"); }

    const score = clamp(Math.round((1 - clamp01(risk)) * 100), 0, 100);
    const health = score >= 75 ? "OK" : score >= 45 ? "WARN" : "CRITICAL";

    return { health, score, reasons };
  }
}

function monthsBetween(a: Date, b: Date) {
  return (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
}
function clamp01(x: number) {
  return Math.max(0, Math.min(1, x));
}
function clamp(x: number, min: number, max: number) {
  return Math.max(min, Math.min(max, x));
}
