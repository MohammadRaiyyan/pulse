import { type LucideIcon, PlusIcon } from "lucide-react";
import { ActionButton, type ActionButtonProps } from "./action-button";

type CreateButtonProps = Omit<ActionButtonProps, "icon" | "variant"> & {
  icon?: LucideIcon;
};

export const CreateButton = ({
  icon = PlusIcon,
  ...props
}: CreateButtonProps) => (
  <ActionButton variant="brand" icon={icon} {...props} />
);
