import {
  type Incident,
  canTransitionIncident,
} from "@pulse/contracts";
import { Button } from "@pulse/ui/components/button";
import { ConfirmDialog } from "@/components/dialogs/confirm-dialog";
import { useIncidentTransition } from "../api/incident-resource";
import { incidentTransitionMeta } from "../incident-meta";

const reopenWarning = ({ source }: Incident) =>
  source.type === "monitor"
    ? `If ${source.name} is still failing, Pulse opens a new incident after its next failed checks. Pause the monitor instead if you are still working on it.`
    : `If ${source.name} is still silent, Pulse opens a new incident only after it receives an event and goes silent again.`;

const AcknowledgeButton = ({ incident }: { incident: Incident }) => {
  const mutation = useIncidentTransition("acknowledge");

  return (
    <Button
      variant="outline"
      disabled={mutation.isPending}
      onClick={() => mutation.mutate({ id: incident.id })}
    >
      {incidentTransitionMeta.acknowledge.label}
    </Button>
  );
};

const ResolveButton = ({ incident }: { incident: Incident }) => {
  const mutation = useIncidentTransition("resolve");

  return (
    <ConfirmDialog
      trigger={
        <Button variant="outline" disabled={mutation.isPending}>
          {incidentTransitionMeta.resolve.label}
        </Button>
      }
      title={`Resolve the incident for ${incident.source.name}?`}
      description={reopenWarning(incident)}
      confirmLabel="Resolve incident"
      isPending={mutation.isPending}
      onConfirm={(close) =>
        mutation.mutate({ id: incident.id }, { onSuccess: close })
      }
    />
  );
};

export const IncidentActions = ({ incident }: { incident: Incident }) => (
  <div className="flex justify-end gap-2">
    {canTransitionIncident(incident, "acknowledge") ? (
      <AcknowledgeButton incident={incident} />
    ) : null}
    {canTransitionIncident(incident, "resolve") ? (
      <ResolveButton incident={incident} />
    ) : null}
  </div>
);
