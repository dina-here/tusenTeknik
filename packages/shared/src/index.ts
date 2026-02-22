/*
import { z } from "zod";

export const BatchSchema = z.object({
  deviceId: z.string(),
  data: z.record(z.unknown()),
});

export const SizingInputSchema = z.object({
  targetPowerW: z.number().positive(),
  autonomyHours: z.number().positive(),
  daysOfAutonomy: z.number().positive(),
});

export const TelemetrySchema = z.object({
  deviceId: z.string(),
  timestamp: z.string().datetime(),
  metrics: z.record(z.number()),
});

export type BatchInput = z.infer<typeof BatchSchema>;
export type SizingInput = z.infer<typeof SizingInputSchema>;
export type TelemetryInput = z.infer<typeof TelemetrySchema>;*/

export * from "./schemas";
