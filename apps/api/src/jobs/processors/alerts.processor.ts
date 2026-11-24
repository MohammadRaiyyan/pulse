import type { Job } from "bullmq";
import { deliverAlert } from "../../modules/alert-channels/alert-delivery.service.ts";
import type { AlertJobData } from "../queues.ts";

export const processAlertJob = async (job: Job) => {
  if (job.name === "send-alert") {
    return deliverAlert(job.data as AlertJobData, {
      attempt: job.attemptsMade + 1,
      maxAttempts: job.opts.attempts ?? 1,
    });
  }

  throw new Error(`Unknown alerts job: ${job.name}`);
};
