import type { Job } from "bullmq";
import { cleanUpOldData } from "../../modules/maintenance/cleanup.service.ts";
import { detectSilentWebhooks } from "../../modules/webhooks/webhook.service.ts";

export const processMaintenanceJob = async (job: Job) => {
  if (job.name === "detect-silent-webhooks") {
    return detectSilentWebhooks();
  }

  if (job.name === "cleanup") {
    return cleanUpOldData();
  }

  throw new Error(`Unknown maintenance job: ${job.name}`);
};
