import { redis } from "./redis.ts";

export const cacheKeys = {
  dashboardSummary: "cache:dashboard:summary",
  user: (userId: string) => `cache:user:${userId}`,
};

export const cached = async <TValue>(
  key: string,
  ttlSeconds: number,
  load: () => Promise<TValue>,
) => {
  const hit = await redis.get(key);

  if (hit !== null) {
    return JSON.parse(hit) as TValue;
  }

  const value = await load();

  if (value !== null && value !== undefined) {
    await redis.set(key, JSON.stringify(value), "EX", ttlSeconds);
  }

  return value;
};

export const invalidate = async (...keys: string[]) => {
  await redis.del(...keys);
};
