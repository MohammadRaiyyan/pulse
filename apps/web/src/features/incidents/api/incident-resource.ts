import {
  type IncidentTransition,
  applyIncidentTransition,
  endpoints,
  resources,
} from "@pulse/contracts";
import { callEndpoint } from "@/lib/api/call-endpoint";
import { createResource } from "@/lib/query/resource";
import { useResourceAction } from "@/lib/query/use-resource-action";
import { incidentTransitionMeta } from "../incident-meta";

export const incidentResource = createResource(resources.incidents, "Incident");

export const useIncidentTransition = (transition: IncidentTransition) =>
  useResourceAction(incidentResource, {
    action: ({ id }: { id: string }) =>
      callEndpoint(endpoints.transitionIncident, {
        params: { id, transition },
      }),
    patch: (incident) =>
      applyIncidentTransition(incident, transition, new Date().toISOString()),
    successMessage: incidentTransitionMeta[transition].successMessage,
  });
