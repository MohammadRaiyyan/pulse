import {
  type Incident,
  type IncidentTransition,
  canTransitionIncident,
  incidentTransitionSchema,
} from "@pulse/contracts";
import { Button } from "@pulse/ui/components/button";
import { useIncidentTransition } from "../api/incident-resource";
import { incidentTransitionMeta } from "../incident-meta";

type TransitionButtonProps = {
  incident: Incident;
  transition: IncidentTransition;
};

const TransitionButton = ({ incident, transition }: TransitionButtonProps) => {
  const mutation = useIncidentTransition(transition);

  return (
    <Button
      variant="outline"
      disabled={mutation.isPending}
      onClick={() => mutation.mutate({ id: incident.id })}
    >
      {incidentTransitionMeta[transition].label}
    </Button>
  );
};

export const IncidentActions = ({ incident }: { incident: Incident }) => (
  <div className="flex justify-end gap-2">
    {incidentTransitionSchema.options
      .filter((transition) => canTransitionIncident(incident, transition))
      .map((transition) => (
        <TransitionButton
          key={transition}
          incident={incident}
          transition={transition}
        />
      ))}
  </div>
);
