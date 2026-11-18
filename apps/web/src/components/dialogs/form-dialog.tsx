import { type ReactNode, Suspense, useState } from "react";
import { SpinnerFallback } from "@/components/feedback/spinner-fallback";
import { Modal, type ModalSize } from "./modal";

type CloseAfter = <TInput, TResult>(
  submit: (input: TInput) => Promise<TResult>,
  onDone?: (result: TResult) => unknown,
) => (input: TInput) => Promise<void>;

type FormDialogControls = {
  close: () => void;
  closeAfter: CloseAfter;
};

export type FormDialogProps = {
  title: string;
  description: string;
  trigger: ReactNode;
  size?: ModalSize;
};

type FormDialogLayoutProps = FormDialogProps & {
  children: (controls: FormDialogControls) => ReactNode;
};

export const FormDialog = ({
  children,
  ...modalProps
}: FormDialogLayoutProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const close = () => setIsOpen(false);

  const closeAfter: CloseAfter = (submit, onDone) => async (input) => {
    const result = await submit(input);
    close();
    await onDone?.(result);
  };

  return (
    <Modal {...modalProps} open={isOpen} onOpenChange={setIsOpen}>
      <Suspense fallback={<SpinnerFallback />}>
        {children({ close, closeAfter })}
      </Suspense>
    </Modal>
  );
};
