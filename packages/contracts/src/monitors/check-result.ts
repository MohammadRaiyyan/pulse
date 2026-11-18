import { z } from "zod";
import {
  idSchema,
  nonNegativeIntSchema,
  timestampSchema,
} from "../common/index.ts";
import { monitorStatusSchema } from "./monitor.ts";

export const checkOutcomeSchema = monitorStatusSchema.exclude(["pending"]);

export type CheckOutcome = z.infer<typeof checkOutcomeSchema>;

export const checkResultSchema = z.object({
  id: idSchema,
  monitorId: idSchema,
  outcome: checkOutcomeSchema,
  statusCode: z.int().nullable(),
  responseTimeMs: nonNegativeIntSchema,
  errorMessage: z.string().nullable(),
  checkedAt: timestampSchema,
});

export type CheckResult = z.infer<typeof checkResultSchema>;
