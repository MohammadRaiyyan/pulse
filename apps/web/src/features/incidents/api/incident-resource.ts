import {
  type IncidentTransition,
  applyIncidentTransition,
  endpoints,
  resources,
} from "@pulse/contracts";
import { useCurrentUser } from "@/features/auth/hooks/use-current-user";
import { callEndpoint } from "@/lib/api/call-endpoint";
import { createResource } from "@/lib/query/resource";
import { useResourceAction } from "@/lib/query/use-resource-action";
import { incidentTransitionMeta } from "../incident-meta";

export const incidentResource = createResource(resources.incidents, "Incident");

export const useIncidentTransition = (transition: IncidentTransition) => {
  const user = useCurrentUser();

  return useResourceAction(incidentResource, {
    action: ({ id }: { id: string }) =>
      callEndpoint(endpoints.transitionIncident, {
        params: { id, transition },
      }),
    patch: (incident) =>
      applyIncidentTransition(incident, transition, new Date().toISOString(), {
        id: user.id,
        name: user.name,
      }),
    successMessage: incidentTransitionMeta[transition].successMessage,
  });
};
