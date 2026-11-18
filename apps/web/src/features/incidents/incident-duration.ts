import type { Incident } from "@pulse/contracts";
import { MILLISECONDS_PER_SECOND } from "@/lib/format/time-units";

export const getIncidentDurationSeconds = ({
  startedAt,
  resolvedAt,
}: Incident) => {
  const endedAt = resolvedAt ? new Date(resolvedAt).getTime() : Date.now();

  return (endedAt - new Date(startedAt).getTime()) / MILLISECONDS_PER_SECOND;
};
