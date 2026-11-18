import type { z } from "zod";

export const encodeToken = (payload: object) => btoa(JSON.stringify(payload));

export const decodeToken = <TSchema extends z.ZodType>(
  token: string,
  schema: TSchema,
): z.output<TSchema> | null => {
  try {
    const parsed = schema.safeParse(JSON.parse(atob(token)));

    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
};
