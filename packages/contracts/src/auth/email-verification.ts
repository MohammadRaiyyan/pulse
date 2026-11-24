import { z } from "zod";
import { tokenSchema } from "../common/index.ts";

export const verifyEmailSchema = z.object({
  token: tokenSchema,
});

export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>;
