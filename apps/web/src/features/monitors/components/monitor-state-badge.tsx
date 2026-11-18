import type { Monitor } from "@pulse/contracts";
import { StatusBadge } from "@/components/data/status-badge";
import { pausedMeta } from "../monitor-meta";
import { MonitorStatusBadge } from "./monitor-status-badge";

export const MonitorStateBadge = ({ monitor }: { monitor: Monitor }) =>
  monitor.isPaused ? (
    <StatusBadge {...pausedMeta} />
  ) : (
    <MonitorStatusBadge value={monitor.status} />
  );
