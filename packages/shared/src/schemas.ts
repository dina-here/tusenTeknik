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
      reportedProblem: z.string().optional()
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
