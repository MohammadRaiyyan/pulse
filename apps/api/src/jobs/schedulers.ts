import { checksQueue, maintenanceQueue } from "./queues.ts";

export const registerSchedulers = async () => {
  await checksQueue.upsertJobScheduler(
    "dispatch-due-checks",
    { every: 15_000 },
    { name: "dispatch-due-checks" },
  );

  await maintenanceQueue.upsertJobScheduler(
    "detect-silent-webhooks",
    { every: 60_000 },
    { name: "detect-silent-webhooks" },
  );

  await maintenanceQueue.upsertJobScheduler(
    "cleanup",
    { pattern: "0 3 * * *" },
    { name: "cleanup" },
  );
};
