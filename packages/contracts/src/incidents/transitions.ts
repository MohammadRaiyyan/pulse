import { z } from "zod";
import {
  type Incident,
  type IncidentActor,
  type IncidentStatus,
  type IncidentStatusFilter,
  activeIncidentStatuses,
} from "./incident.ts";

export const incidentTransitionSchema = z.enum(["acknowledge", "resolve"]);

export type IncidentTransition = z.infer<typeof incidentTransitionSchema>;

type TransitionRule = {
  from: readonly IncidentStatus[];
  to: IncidentStatus;
};

export const incidentTransitionRules: Record<
  IncidentTransition,
  TransitionRule
> = {
  acknowledge: { from: ["open"], to: "acknowledged" },
  resolve: { from: ["open", "acknowledged"], to: "resolved" },
};

export const canTransitionIncident = (
  incident: Incident,
  transition: IncidentTransition,
) => incidentTransitionRules[transition].from.includes(incident.status);

export const applyIncidentTransition = (
  incident: Incident,
  transition: IncidentTransition,
  at: string,
  actor: IncidentActor,
): Incident => ({
  ...incident,
  status: incidentTransitionRules[transition].to,
  acknowledgedAt: incident.acknowledgedAt ?? at,
  acknowledgedBy: incident.acknowledgedBy ?? actor,
  resolvedAt: transition === "resolve" ? at : incident.resolvedAt,
  resolvedBy: transition === "resolve" ? actor : incident.resolvedBy,
});

export const isActiveIncidentStatus = (status: IncidentStatus) =>
  (activeIncidentStatuses as readonly IncidentStatus[]).includes(status);

export const matchesIncidentStatusFilter = (
  status: IncidentStatus,
  filter: IncidentStatusFilter | undefined,
) =>
  filter === undefined ||
  (filter === "active" ? isActiveIncidentStatus(status) : status === filter);
