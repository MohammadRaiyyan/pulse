import { Button } from "@pulse/ui/components/button";
import type { LucideIcon } from "lucide-react";
import type { ComponentProps } from "react";

export type ActionButtonProps = Omit<
  ComponentProps<typeof Button>,
  "children"
> & {
  label: string;
  icon: LucideIcon;
};

export const ActionButton = ({
  label,
  icon: Icon,
  ...props
}: ActionButtonProps) => (
  <Button {...props}>
    <Icon data-icon="inline-start" />
    {label}
  </Button>
);
