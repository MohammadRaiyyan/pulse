import { z } from "zod";

export const authSearchSchema = z.object({
  redirect: z.string().optional(),
});

export const toSafeRedirect = (target: string | undefined) =>
  target?.startsWith("/") && !target.startsWith("//") ? target : "/";
