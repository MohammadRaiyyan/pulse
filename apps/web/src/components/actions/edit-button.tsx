import { PencilIcon } from "lucide-react";
import { ActionButton, type ActionButtonProps } from "./action-button";

type EditButtonProps = Omit<ActionButtonProps, "icon" | "variant" | "label"> & {
  label?: string;
};

export const EditButton = ({ label = "Edit", ...props }: EditButtonProps) => (
  <ActionButton variant="outline" icon={PencilIcon} label={label} {...props} />
);
