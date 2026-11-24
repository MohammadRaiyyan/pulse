import { env } from "../config/env.ts";
import { checksQueue, maintenanceQueue } from "./queues.ts";

export const registerSchedulers = async () => {
  await checksQueue.upsertJobScheduler(
    "dispatch-due-checks",
    { every: env.CHECK_DISPATCH_INTERVAL_MS },
    { name: "dispatch-due-checks" },
  );

  await maintenanceQueue.upsertJobScheduler(
    "detect-silent-webhooks",
    { every: env.SILENCE_CHECK_INTERVAL_MS },
    { name: "detect-silent-webhooks" },
  );

  await maintenanceQueue.upsertJobScheduler(
    "cleanup",
    { pattern: "0 3 * * *" },
    { name: "cleanup" },
  );
};
