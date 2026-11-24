import { type ChangeEvent, changeEventSchema } from "@pulse/contracts";
import type { Redis } from "ioredis";
import { logger } from "./logger.ts";
import { createRedisConnection, redis } from "./redis.ts";

type ChangeListener = (event: ChangeEvent) => void;

type Subscriber = {
  connection: Redis;
  ready: Promise<unknown>;
};

const CHANGES_CHANNEL = `pulse:${redis.options.db ?? 0}:changes`;

const listeners = new Set<ChangeListener>();
let subscriber: Subscriber | null = null;

export const publishChange = (event: ChangeEvent) => {
  redis
    .publish(CHANGES_CHANNEL, JSON.stringify(event))
    .catch((error: unknown) => {
      logger.warn({ err: error, event }, "Failed to publish change event");
    });
};

const parseChange = (message: string) => {
  try {
    const parsed = changeEventSchema.safeParse(JSON.parse(message));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
};

const deliver = (message: string) => {
  const event = parseChange(message);

  if (!event) {
    logger.warn({ message }, "Ignored malformed change event");
    return;
  }

  for (const listener of listeners) {
    listener(event);
  }
};

const startSubscriber = (): Subscriber => {
  const connection = createRedisConnection();

  connection.on("message", (_channel: string, message: string) =>
    deliver(message),
  );
  connection.on("error", (error: unknown) => {
    logger.warn({ err: error }, "Change subscriber connection error");
  });

  return { connection, ready: connection.subscribe(CHANGES_CHANNEL) };
};

export const subscribeToChanges = async (listener: ChangeListener) => {
  subscriber ??= startSubscriber();
  listeners.add(listener);
  await subscriber.ready;

  return () => {
    listeners.delete(listener);
  };
};

export const closeChangeSubscriber = async () => {
  const current = subscriber;

  subscriber = null;
  listeners.clear();

  if (current) {
    await current.connection.quit();
  }
};
