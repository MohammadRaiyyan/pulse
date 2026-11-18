import { XIcon } from "lucide-react";
import type { ComponentProps } from "react";
import { IconButton } from "@/components/actions/icon-button";

export const ModalCloseButton = (
  props: Omit<ComponentProps<typeof IconButton>, "label">,
) => (
  <IconButton label="Close" {...props}>
    <XIcon />
  </IconButton>
);
