import { randomUUID } from "node:crypto";
import { redis } from "./redis.ts";

const ACQUIRE_SCRIPT = `
redis.call("ZREMRANGEBYSCORE", KEYS[1], "-inf", ARGV[1])
if redis.call("ZCARD", KEYS[1]) >= tonumber(ARGV[3]) then
  return 0
end
redis.call("ZADD", KEYS[1], ARGV[2], ARGV[4])
redis.call("PEXPIRE", KEYS[1], ARGV[5])
return 1
`;

export type HostSlot = {
  release: () => Promise<void>;
};

const slotKey = (host: string) => `host-slots:${host}`;

export const acquireHostSlot = async (
  host: string,
  limit: number,
  leaseMs: number,
): Promise<HostSlot | null> => {
  const key = slotKey(host);
  const token = randomUUID();
  const now = Date.now();

  const acquired = await redis.eval(
    ACQUIRE_SCRIPT,
    1,
    key,
    now,
    now + leaseMs,
    limit,
    token,
    leaseMs,
  );

  if (acquired !== 1) {
    return null;
  }

  return {
    release: async () => {
      await redis.zrem(key, token);
    },
  };
};
