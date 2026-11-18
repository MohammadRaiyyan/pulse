import { z } from "zod";
import type { Incident, IncidentStatus } from "./incident.ts";

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
): Incident => ({
  ...incident,
  status: incidentTransitionRules[transition].to,
  acknowledgedAt: incident.acknowledgedAt ?? at,
  resolvedAt: transition === "resolve" ? at : incident.resolvedAt,
});
