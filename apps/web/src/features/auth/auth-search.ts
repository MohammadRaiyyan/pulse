import { relativePathSchema } from "@pulse/contracts";
import { z } from "zod";

export const authSearchSchema = z.object({
  redirect: z.string().optional(),
});

export const toSafeRedirect = (target: string | undefined) => {
  const parsed = relativePathSchema.safeParse(target);

  return parsed.success ? parsed.data : "/";
};
