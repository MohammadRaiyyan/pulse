import { useNavigate } from "@tanstack/react-router";
import { CreateButton } from "@/components/actions/create-button";
import { CreateResourceDialog } from "@/components/dialogs/create-resource-dialog";
import { Can } from "@/features/auth/components/can";
import { monitorResource } from "../api/monitor-resource";
import { defaultMonitorInput } from "../monitor-defaults";
import { MonitorForm } from "./monitor-form";

export const NewMonitorButton = () => {
  const navigate = useNavigate();

  return (
    <Can permission="monitor:write">
      <CreateResourceDialog
        resource={monitorResource}
        form={MonitorForm}
        defaultValues={defaultMonitorInput}
        title="New monitor"
        description="Check an HTTP endpoint on a schedule."
        size="wide"
        submitLabel="Create monitor"
        trigger={<CreateButton label="New monitor" />}
        onCreated={(monitor) =>
          navigate({
            to: "/monitors/$monitorId",
            params: { monitorId: monitor.id },
          })
        }
      />
    </Can>
  );
};
