import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@pulse/ui/components/alert-dialog";
import { Spinner } from "@pulse/ui/components/spinner";
import { type MouseEvent, type ReactNode, useState } from "react";
import { ModalCloseButton } from "./modal-close-button";
import {
  ModalHeader,
  modalDescriptionClassName,
  modalTitleClassName,
} from "./modal-header";

type ConfirmDialogProps = {
  trigger: ReactNode;
  title: string;
  description: string;
  confirmLabel: string;
  isPending: boolean;
  onConfirm: (close: () => void) => void;
};

export const ConfirmDialog = ({
  trigger,
  title,
  description,
  confirmLabel,
  isPending,
  onConfirm,
}: ConfirmDialogProps) => {
  const [isOpen, setIsOpen] = useState(false);

  const handleOpenChange = (open: boolean) => {
    if (!isPending) {
      setIsOpen(open);
    }
  };

  const handleConfirm = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    onConfirm(() => setIsOpen(false));
  };

  return (
    <AlertDialog open={isOpen} onOpenChange={handleOpenChange}>
      <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>
      <AlertDialogContent className="gap-0 overflow-hidden p-0 sm:max-w-md">
        <ModalHeader
          title={
            <AlertDialogTitle className={modalTitleClassName}>
              {title}
            </AlertDialogTitle>
          }
          description={
            <AlertDialogDescription className={modalDescriptionClassName}>
              {description}
            </AlertDialogDescription>
          }
          close={
            <AlertDialogCancel variant="ghost" size="icon" asChild>
              <ModalCloseButton disabled={isPending} />
            </AlertDialogCancel>
          }
        />
        <AlertDialogFooter className="m-0 border-t-0 bg-transparent px-5 py-4">
          <AlertDialogCancel variant="ghost" disabled={isPending}>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={isPending}
            onClick={handleConfirm}
          >
            {isPending ? <Spinner /> : null}
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
