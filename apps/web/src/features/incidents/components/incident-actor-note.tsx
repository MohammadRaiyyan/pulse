import type { Incident } from "@pulse/contracts";
import { incidentResolutionReasonLabels } from "../incident-meta";

const describeActor = (incident: Incident) => {
  if (incident.status === "acknowledged") {
    return incident.acknowledgedBy
      ? `Acknowledged by ${incident.acknowledgedBy.name}`
      : null;
  }

  if (incident.status !== "resolved") {
    return null;
  }

  if (incident.resolvedBy) {
    return `Resolved by ${incident.resolvedBy.name}`;
  }

  return incident.resolutionReason
    ? `Resolved automatically: ${incidentResolutionReasonLabels[incident.resolutionReason]}`
    : "Resolved automatically";
};

export const IncidentActorNote = ({ incident }: { incident: Incident }) => {
  const note = describeActor(incident);

  return note ? (
    <span className="text-xs text-muted-foreground">{note}</span>
  ) : null;
};
