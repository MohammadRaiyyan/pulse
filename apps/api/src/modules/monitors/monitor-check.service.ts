import { checksQueue } from "../../jobs/queues.ts";
import { cacheKeys, invalidate } from "../../lib/cache.ts";
import { logger } from "../../lib/logger.ts";
import {
  openIncidentForSource,
  resolveIncidentForSource,
} from "../incidents/incident.service.ts";
import { runHttpCheck } from "./http-check.ts";
import {
  findChannelIdsForMonitor,
  findDueMonitors,
  findMonitor,
  saveCheckResult,
} from "./monitor.repository.ts";

export const checkMonitor = async (monitorId: string) => {
  const monitor = await findMonitor(monitorId);

  if (!monitor || monitor.isPaused) {
    return;
  }

  const measurement = await runHttpCheck(monitor);
  const checked = await saveCheckResult(monitor.id, measurement);

  if (!checked) {
    return;
  }

  await invalidate(cacheKeys.dashboardSummary);

  logger.debug(
    {
      monitor: monitor.name,
      outcome: measurement.outcome,
      consecutiveFailures: checked.consecutiveFailures,
    },
    "Monitor checked",
  );

  const isConfirmedFailure =
    checked.consecutiveFailures >= checked.failureThreshold;

  if (measurement.outcome !== "up" && !isConfirmedFailure) {
    return;
  }

  const source = {
    type: "monitor" as const,
    id: checked.id,
    name: checked.name,
    alertChannelIds: await findChannelIdsForMonitor(checked.id),
  };

  if (measurement.outcome === "up") {
    await resolveIncidentForSource(source);
    return;
  }

  await openIncidentForSource(
    source,
    measurement.errorMessage ?? `Monitor is ${measurement.outcome}`,
    measurement.outcome === "down" ? "critical" : "warning",
  );
};

export const dispatchDueChecks = async () => {
  const dueMonitors = await findDueMonitors();
  const now = Date.now();

  await checksQueue.addBulk(
    dueMonitors.map((monitor) => ({
      name: "run-check",
      data: { monitorId: monitor.id },
      opts: {
        jobId: `check-${monitor.id}-${Math.floor(now / (monitor.intervalSeconds * 1000))}`,
      },
    })),
  );

  return dueMonitors.length;
};
