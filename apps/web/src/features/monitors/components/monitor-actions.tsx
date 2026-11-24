import { type Monitor, createMonitorSchema } from "@pulse/contracts";
import { PauseIcon, PlayIcon } from "lucide-react";
import { ActionButton } from "@/components/actions/action-button";
import { DeleteResourceButton } from "@/components/actions/delete-resource-button";
import { EditButton } from "@/components/actions/edit-button";
import { EditResourceDialog } from "@/components/dialogs/edit-resource-dialog";
import { Can } from "@/features/auth/components/can";
import { useUpdateResource } from "@/lib/query/use-resource-mutations";
import { monitorResource } from "../api/monitor-resource";
import { MonitorForm } from "./monitor-form";

const PauseToggleButton = ({ monitor }: { monitor: Monitor }) => {
  const updateMonitor = useUpdateResource(monitorResource, {
    optimistic: true,
    successMessage: (updated) =>
      updated.isPaused ? "Monitor paused" : "Monitor resumed",
  });

  return (
    <ActionButton
      variant="outline"
      icon={monitor.isPaused ? PlayIcon : PauseIcon}
      label={monitor.isPaused ? "Resume" : "Pause"}
      disabled={updateMonitor.isPending}
      onClick={() =>
        updateMonitor.mutate({
          id: monitor.id,
          input: { isPaused: !monitor.isPaused },
        })
      }
    />
  );
};

export const MonitorActions = ({ monitor }: { monitor: Monitor }) => (
  <Can permission="monitor:write">
    <PauseToggleButton monitor={monitor} />
    <EditResourceDialog
      resource={monitorResource}
      item={monitor}
      toInput={(item) => createMonitorSchema.parse(item)}
      form={MonitorForm}
      title={`Edit ${monitor.name}`}
      description="Changes apply from the next scheduled check."
      size="wide"
      trigger={<EditButton />}
    />
    <DeleteResourceButton
      resource={monitorResource}
      id={monitor.id}
      name={monitor.name}
      consequence="Its check history will be removed. Past incidents stay in the incident log, and an active incident is resolved."
      redirectTo="/monitors"
    />
  </Can>
);
