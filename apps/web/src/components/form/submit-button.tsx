import { Button } from "@pulse/ui/components/button";
import { Spinner } from "@pulse/ui/components/spinner";
import { useStore } from "@tanstack/react-form";
import type { ReactNode } from "react";
import { useFormContext } from "./form-context";

type SubmitButtonProps = {
  children: ReactNode;
  className?: string;
};

export const SubmitButton = ({ children, className }: SubmitButtonProps) => {
  const form = useFormContext();
  const isSubmitting = useStore(form.store, (state) => state.isSubmitting);

  return (
    <Button
      type="submit"
      variant="brand"
      disabled={isSubmitting}
      className={className}
    >
      {isSubmitting ? <Spinner /> : null}
      {children}
    </Button>
  );
};
