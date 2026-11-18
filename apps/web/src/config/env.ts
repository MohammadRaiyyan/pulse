import { z } from "zod";

const envSchema = z
  .object({
    VITE_API_URL: z.string().min(1).default("/api"),
    VITE_API_MOCKING: z.stringbool().default(false),
  })
  .transform((raw) => ({
    apiUrl: raw.VITE_API_URL,
    isApiMockingEnabled: raw.VITE_API_MOCKING,
  }));

export const env = envSchema.parse(import.meta.env);
