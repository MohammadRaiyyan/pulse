import { DelayedError, type Job } from "bullmq";
import { runCheckWithHostLimit } from "../../modules/monitors/check-runner.service.ts";
import { dispatchDueChecks } from "../../modules/monitors/monitor-check.service.ts";
import type { RunCheckJobData } from "../queues.ts";

const HOST_BUSY_RETRY_MS = 2_000;

const retryAt = () =>
  Date.now() +
  HOST_BUSY_RETRY_MS +
  Math.floor(Math.random() * HOST_BUSY_RETRY_MS);

export const processCheckJob = async (job: Job, token?: string) => {
  if (job.name === "dispatch-due-checks") {
    return dispatchDueChecks();
  }

  if (job.name === "run-check") {
    const data = job.data as RunCheckJobData;
    const result = await runCheckWithHostLimit(data.monitorId);

    if (result === "host-busy") {
      await job.moveToDelayed(retryAt(), token);
      throw new DelayedError();
    }

    return;
  }

  throw new Error(`Unknown checks job: ${job.name}`);
};
