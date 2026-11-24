import type { Job } from "bullmq";
import {
  checkMonitor,
  dispatchDueChecks,
} from "../../modules/monitors/monitor-check.service.ts";
import type { RunCheckJobData } from "../queues.ts";

export const processCheckJob = async (job: Job) => {
  if (job.name === "dispatch-due-checks") {
    return dispatchDueChecks();
  }

  if (job.name === "run-check") {
    const data = job.data as RunCheckJobData;
    return checkMonitor(data.monitorId);
  }

  throw new Error(`Unknown checks job: ${job.name}`);
};
