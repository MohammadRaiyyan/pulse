import { useNavigate } from "@tanstack/react-router";
import { CreateButton } from "@/components/actions/create-button";
import { CreateResourceDialog } from "@/components/dialogs/create-resource-dialog";
import { Can } from "@/features/auth/components/can";
import { serviceResource } from "../api/service-resource";
import { defaultServiceInput } from "../service-defaults";
import { ServiceForm } from "./service-form";

export const NewServiceButton = () => {
  const navigate = useNavigate();

  return (
    <Can permission="monitor:write">
      <CreateResourceDialog
        resource={serviceResource}
        form={ServiceForm}
        defaultValues={defaultServiceInput}
        title="New service"
        description="Group monitors and webhooks into something your users recognise."
        submitLabel="Create service"
        size="wide"
        trigger={<CreateButton label="New service" />}
        onCreated={(service) =>
          navigate({
            to: "/services/$serviceId",
            params: { serviceId: service.id },
          })
        }
      />
    </Can>
  );
};
