import { z } from "zod";

/**
 * Delade scheman.
 * - En källa för kontrakt minskar missförstånd mellan UI/API/Worker.
 * - Vi använder Zod även i Nest via en custom pipe.
 */

export const ContactSchema = z.object({
  name: z.string().min(1),
  email: z.string().email().optional(),
  phone: z.string().min(6).optional(),
  role: z.string().optional()
});

export const PowerWatchEventSchema = z.object({
  eventId: z.string().uuid(),
  source: z.literal("POWERWATCH"),
  deviceRef: z.string().min(1),
  timestamp: z.string().datetime(),
  payload: z
    .object({
      note: z.string().optional(),
      photoUrl: z.string().url().optional(),
      reportedProblem: z.string().optional(),
      installYear: z.number().int().optional(),
      lastServiceYear: z.number().int().optional()
    })
    .passthrough(),
  contact: ContactSchema.optional()
});

export const BatchSchema = z.object({
  events: z.array(PowerWatchEventSchema).min(1)
});

export const TelemetrySchema = z.object({
  deviceRef: z.string().min(1),
  timestamp: z.string().datetime(),
  metrics: z
    .object({
      voltage: z.number().optional(),
      temperature: z.number().optional(),
      faultCode: z.string().optional()
    })
    .passthrough()
});

export const SizingInputSchema = z.object({
  load: z.number().positive(),
  backupHours: z.number().positive(),
  temperature: z.number()
});

export const PowerwatchMlTargetStrategySchema = z.enum([
  "failure_within_6_months",
  "remaining_runtime_minutes"
]);

export const PowerwatchMlModelNameSchema = z.enum([
  "logistic_regression",
  "random_forest",
  "gradient_boosting",
  "linear_regression",
  "random_forest_regressor",
  "gradient_boosting_regressor"
]);

export const PowerwatchMlJobRequestSchema = z.object({
  datasetName: z.string().min(1).max(120).optional(),
  targetStrategy: PowerwatchMlTargetStrategySchema,
  randomSeed: z.number().int().min(1).max(999_999).optional(),
  testSize: z.number().min(0.1).max(0.4).optional(),
  modelNames: z.array(PowerwatchMlModelNameSchema).min(1).max(6).optional(),
  deviceFileName: z.string().min(1).max(240).optional(),
  telemetryFileName: z.string().min(1).max(240).optional(),
  serviceFileName: z.string().min(1).max(240).optional(),
  deviceCsv: z.string().min(1),
  telemetryCsv: z.string().min(1),
  serviceCsv: z.string().optional()
});
