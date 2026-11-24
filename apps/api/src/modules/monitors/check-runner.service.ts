import { env } from "../../config/env.ts";
import { acquireHostSlot } from "../../lib/host-concurrency.ts";
import { checkMonitor } from "./monitor-check.service.ts";
import { findMonitor } from "./monitor.repository.ts";

const LEASE_MARGIN_MS = 30_000;

export type CheckRunResult = "completed" | "host-busy";

const hostOf = (url: string) => URL.parse(url)?.hostname.toLowerCase() ?? url;

export const runCheckWithHostLimit = async (
  monitorId: string,
): Promise<CheckRunResult> => {
  const monitor = await findMonitor(monitorId);

  if (!monitor || monitor.isPaused) {
    return "completed";
  }

  const slot = await acquireHostSlot(
    hostOf(monitor.url),
    env.CHECK_MAX_CONCURRENCY_PER_HOST,
    monitor.timeoutMs + LEASE_MARGIN_MS,
  );

  if (!slot) {
    return "host-busy";
  }

  try {
    await checkMonitor(monitorId);
  } finally {
    await slot.release();
  }

  return "completed";
};
