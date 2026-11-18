import { type LinkProps, useNavigate } from "@tanstack/react-router";
import { type LucideIcon, Trash2Icon } from "lucide-react";
import { ConfirmDialog } from "@/components/dialogs/confirm-dialog";
import type { AnyResource } from "@/lib/query/resource";
import { useDeleteResource } from "@/lib/query/use-resource-mutations";
import { ActionButton } from "./action-button";
import { IconButton } from "./icon-button";

type DeleteResourceButtonProps = {
  resource: AnyResource;
  id: string;
  name: string;
  consequence: string;
  verb?: string;
  icon?: LucideIcon;
  successMessage?: string;
  redirectTo?: LinkProps["to"];
  iconOnly?: boolean;
};

export const DeleteResourceButton = ({
  resource,
  id,
  name,
  consequence,
  verb = "Delete",
  icon: Icon = Trash2Icon,
  successMessage,
  redirectTo,
  iconOnly = false,
}: DeleteResourceButtonProps) => {
  const deleteResource = useDeleteResource(resource, { successMessage });
  const navigate = useNavigate();

  const confirmDelete = (close: () => void) =>
    deleteResource.mutate(id, {
      onSuccess: async () => {
        close();

        if (redirectTo) {
          await navigate({ to: redirectTo });
        }
      },
    });

  return (
    <ConfirmDialog
      title={`${verb} ${name}?`}
      description={consequence}
      confirmLabel={`${verb} ${resource.label.toLowerCase()}`}
      isPending={deleteResource.isPending}
      onConfirm={confirmDelete}
      trigger={
        iconOnly ? (
          <IconButton label={`${verb} ${name}`}>
            <Icon />
          </IconButton>
        ) : (
          <ActionButton variant="destructive" icon={Icon} label={verb} />
        )
      }
    />
  );
};
