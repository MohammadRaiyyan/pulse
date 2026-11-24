import { Redis } from "ioredis";
import { env } from "../config/env.ts";

export const createRedisConnection = () =>
  new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });

export const redis = createRedisConnection();
