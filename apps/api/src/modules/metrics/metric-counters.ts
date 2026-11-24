import { checkOutcomeSchema } from "@pulse/contracts";
import { redis } from "../../lib/redis.ts";

export type JobOutcome = "completed" | "failed";

const JOB_COUNTER_KEYS: Record<JobOutcome, string> = {
  completed: "metrics:jobs:completed",
  failed: "metrics:jobs:failed",
};
const CHECK_COUNTER_KEY = "metrics:checks";
const FIELD_SEPARATOR = "|";

export const recordJobOutcome = async (
  queue: string,
  name: string,
  outcome: JobOutcome,
) => {
  await redis.hincrby(
    JOB_COUNTER_KEYS[outcome],
    `${queue}${FIELD_SEPARATOR}${name}`,
    1,
  );
};

export const recordCheckOutcome = async (value: unknown) => {
  const outcome = checkOutcomeSchema.safeParse(value);

  if (outcome.success) {
    await redis.hincrby(CHECK_COUNTER_KEY, outcome.data, 1);
  }
};

export const readJobCounts = async (outcome: JobOutcome) => {
  const counts = await redis.hgetall(JOB_COUNTER_KEYS[outcome]);

  return Object.entries(counts).map(([field, count]) => {
    const [queue = "", ...nameParts] = field.split(FIELD_SEPARATOR);

    return {
      queue,
      name: nameParts.join(FIELD_SEPARATOR),
      count: Number(count),
    };
  });
};

export const readCheckCounts = async () => {
  const counts = await redis.hgetall(CHECK_COUNTER_KEY);

  return Object.entries(counts).map(([outcome, count]) => ({
    outcome,
    count: Number(count),
  }));
};
