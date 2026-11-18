import { z } from "zod";

export const PASSWORD_MIN_LENGTH = 8;

export const emailSchema = z.email("Enter a valid email").toLowerCase();

export const passwordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `Use at least ${PASSWORD_MIN_LENGTH} characters`)
  .max(128);
