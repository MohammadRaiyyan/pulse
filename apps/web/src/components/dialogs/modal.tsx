import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@pulse/ui/components/dialog";
import { cn } from "@pulse/ui/lib/utils";
import type { ReactNode } from "react";
import { ModalCloseButton } from "./modal-close-button";
import {
  ModalHeader,
  modalDescriptionClassName,
  modalTitleClassName,
} from "./modal-header";

export type ModalSize = "default" | "wide";

const sizeClassNames: Record<ModalSize, string> = {
  default: "sm:max-w-md",
  wide: "sm:max-w-2xl",
};

type ModalProps = {
  title: string;
  description?: string;
  trigger: ReactNode;
  size?: ModalSize;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: ReactNode;
};

export const Modal = ({
  title,
  description,
  trigger,
  size = "default",
  open,
  onOpenChange,
  children,
}: ModalProps) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogTrigger asChild>{trigger}</DialogTrigger>
    <DialogContent
      showCloseButton={false}
      className={cn("gap-0 overflow-hidden p-0", sizeClassNames[size])}
    >
      <ModalHeader
        title={
          <DialogTitle className={modalTitleClassName}>{title}</DialogTitle>
        }
        description={
          description ? (
            <DialogDescription className={modalDescriptionClassName}>
              {description}
            </DialogDescription>
          ) : null
        }
        close={
          <DialogClose asChild>
            <ModalCloseButton />
          </DialogClose>
        }
      />
      <div className="max-h-[75svh] overflow-y-auto p-5">{children}</div>
    </DialogContent>
  </Dialog>
);
