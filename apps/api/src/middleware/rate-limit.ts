import type { Request, RequestHandler } from "express";
import { AppError } from "../lib/errors.ts";
import { redis } from "../lib/redis.ts";

type RateLimitOptions = {
  name: string;
  limit: number;
  windowSeconds: number;
  key: (req: Request) => string;
};

export const rateLimit = ({
  name,
  limit,
  windowSeconds,
  key,
}: RateLimitOptions): RequestHandler => {
  return async (req, _res, next) => {
    const redisKey = `rate:${name}:${key(req)}`;

    const results = await redis
      .multi()
      .incr(redisKey)
      .expire(redisKey, windowSeconds, "NX")
      .ttl(redisKey)
      .exec();

    const hits = Number(results?.[0]?.[1] ?? 0);
    const secondsLeft = Number(results?.[2]?.[1] ?? windowSeconds);

    if (hits > limit) {
      throw new AppError("RATE_LIMITED", "Too many attempts.", {
        retryAfterSeconds: secondsLeft > 0 ? secondsLeft : windowSeconds,
      });
    }

    next();
  };
};

export const byIp = (req: Request) => req.ip ?? "unknown";

export const byBodyEmail = (req: Request) => {
  const email: unknown = req.body?.email;

  return typeof email === "string" ? email.trim().toLowerCase() : "none";
};

export const byIpAndBodyEmail = (req: Request) =>
  `${byIp(req)}:${byBodyEmail(req)}`;

export const byUser = (req: Request) => req.user?.id ?? byIp(req);
