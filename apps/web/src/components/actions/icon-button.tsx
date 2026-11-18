import { Button } from "@pulse/ui/components/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@pulse/ui/components/tooltip";
import type { ComponentProps } from "react";

type IconButtonProps = Omit<ComponentProps<typeof Button>, "aria-label"> & {
  label: string;
};

export const IconButton = ({
  label,
  variant = "ghost",
  size = "icon",
  children,
  ...props
}: IconButtonProps) => (
  <Tooltip>
    <TooltipTrigger asChild>
      <Button variant={variant} size={size} aria-label={label} {...props}>
        {children}
      </Button>
    </TooltipTrigger>
    <TooltipContent>{label}</TooltipContent>
  </Tooltip>
);
