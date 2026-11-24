import { checksQueue } from "../../jobs/queues.ts";
import { cacheKeys, invalidate } from "../../lib/cache.ts";
import { logger } from "../../lib/logger.ts";
import { publishChange } from "../../lib/realtime.ts";
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
  await saveCheckResult(monitor.id, measurement);
  await invalidate(cacheKeys.dashboardSummary);

  logger.debug(
    { monitor: monitor.name, outcome: measurement.outcome },
    "Monitor checked",
  );

  const source = {
    type: "monitor" as const,
    id: monitor.id,
    name: monitor.name,
    alertChannelIds: await findChannelIdsForMonitor(monitor.id),
  };

  if (measurement.outcome === "up") {
    await resolveIncidentForSource(source);
  } else {
    await openIncidentForSource(
      source,
      measurement.errorMessage ?? `Monitor is ${measurement.outcome}`,
    );
  }

  publishChange({ type: "monitor.checked", id: monitor.id });
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
