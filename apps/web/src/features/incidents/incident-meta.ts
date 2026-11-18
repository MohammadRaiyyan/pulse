import {
  type IncidentStatus,
  type IncidentTransition,
  incidentStatusSchema,
} from "@pulse/contracts";
import type { StatusMeta } from "@/components/data/tones";
import { metaOptions } from "@/lib/options";

export const incidentStatusMeta: Record<IncidentStatus, StatusMeta> = {
  open: { label: "Open", tone: "danger" },
  acknowledged: { label: "Acknowledged", tone: "warning" },
  resolved: { label: "Resolved", tone: "success" },
};

export const incidentStatusOptions = metaOptions(
  incidentStatusSchema.options,
  incidentStatusMeta,
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
