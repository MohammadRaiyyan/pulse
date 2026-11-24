import { redis } from "../lib/redis.ts";
import {
  readHeartbeat,
  workerStatusOf,
} from "../modules/health/worker-heartbeat.ts";

const heartbeat = await readHeartbeat().catch(() => null);
const status = workerStatusOf(heartbeat);

redis.disconnect();
process.exit(status === "up" ? 0 : 1);
