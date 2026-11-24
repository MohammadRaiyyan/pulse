import { type Service, createServiceSchema } from "@pulse/contracts";
import { DeleteResourceButton } from "@/components/actions/delete-resource-button";
import { EditButton } from "@/components/actions/edit-button";
import { EditResourceDialog } from "@/components/dialogs/edit-resource-dialog";
import { Can } from "@/features/auth/components/can";
import { serviceResource } from "../api/service-resource";
import { ServiceForm } from "./service-form";

export const ServiceActions = ({ service }: { service: Service }) => (
  <Can permission="monitor:write">
    <EditResourceDialog
      resource={serviceResource}
      item={service}
      toInput={(item) => createServiceSchema.parse(item)}
      form={ServiceForm}
      title={`Edit ${service.name}`}
      description="Members and visibility apply immediately."
      size="wide"
      trigger={<EditButton />}
    />
    <DeleteResourceButton
      resource={serviceResource}
      id={service.id}
      name={service.name}
      consequence="Its monitors and webhooks are kept and become unassigned. It disappears from the status page."
      redirectTo="/services"
    />
  </Can>
);
