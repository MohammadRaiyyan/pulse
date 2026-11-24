import {
  type IncidentResolutionReason,
  type IncidentSeverity,
  type IncidentStatus,
  type IncidentStatusFilter,
  type IncidentTransition,
  incidentStatusFilterSchema,
} from "@pulse/contracts";
import { z } from "zod";
import type { StatusMeta } from "@/components/data/tones";
import { metaOptions } from "@/lib/options";

export const incidentStatusMeta: Record<IncidentStatus, StatusMeta> = {
  open: { label: "Open", tone: "danger" },
  acknowledged: { label: "Acknowledged", tone: "warning" },
  resolved: { label: "Resolved", tone: "success" },
};

export const incidentSeverityMeta: Record<IncidentSeverity, StatusMeta> = {
  critical: { label: "Critical", tone: "danger" },
  warning: { label: "Warning", tone: "warning" },
};

export const incidentResolutionReasonLabels: Record<
  IncidentResolutionReason,
  string
> = {
  recovered: "Recovered",
  monitor_paused: "Monitor paused",
  source_deleted: "Source deleted",
};

export const incidentViewSchema = z.enum([
  ...incidentStatusFilterSchema.options,
  "all",
]);

export type IncidentView = z.infer<typeof incidentViewSchema>;

export const DEFAULT_INCIDENT_VIEW: IncidentView = "active";

export const toIncidentStatusFilter = (
  view: IncidentView,
): IncidentStatusFilter | undefined => (view === "all" ? undefined : view);

type IncidentViewMeta = {
  label: string;
  emptyTitle: string;
  emptyDescription: string;
};

export const incidentViewMeta: Record<IncidentView, IncidentViewMeta> = {
  active: {
    label: "Active",
    emptyTitle: "No active incidents",
    emptyDescription: "Everything is operating normally.",
  },
  open: {
    label: "Open",
    emptyTitle: "No open incidents",
    emptyDescription: "Every active incident has been acknowledged.",
  },
  acknowledged: {
    label: "Acknowledged",
    emptyTitle: "No acknowledged incidents",
    emptyDescription: "Incidents someone is working on appear here.",
  },
  resolved: {
    label: "Resolved",
    emptyTitle: "No resolved incidents",
    emptyDescription: "Resolved incidents appear here.",
  },
  all: {
    label: "All",
    emptyTitle: "No incidents",
    emptyDescription: "Everything is operating normally.",
  },
};

export const incidentViewOptions = metaOptions(
  incidentViewSchema.options,
  incidentViewMeta,
);

type TransitionMeta = {
  label: string;
  successMessage: string;
};

export const incidentTransitionMeta: Record<
  IncidentTransition,
  TransitionMeta
> = {
  acknowledge: {
    label: "Acknowledge",
    successMessage: "Incident acknowledged",
  },
  resolve: { label: "Resolve", successMessage: "Incident resolved" },
};
