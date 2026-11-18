import { createStatusBadge } from "@/components/data/create-status-badge";
import { incidentStatusMeta } from "../incident-meta";

export const IncidentStatusBadge = createStatusBadge(incidentStatusMeta);
