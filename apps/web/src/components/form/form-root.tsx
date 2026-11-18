import { FieldError, FieldGroup } from "@pulse/ui/components/field";
import { useStore } from "@tanstack/react-form";
import type { FormEvent, ReactNode } from "react";
import { useFormContext } from "./form-context";

export const FormRoot = ({ children }: { children: ReactNode }) => {
  const form = useFormContext();
  const submitError = useStore(form.store, (state) => state.errorMap.onSubmit);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    event.stopPropagation();
    void form.handleSubmit();
  };

  return (
    <form onSubmit={handleSubmit} noValidate>
      <FieldGroup>
        {typeof submitError === "string" ? (
          <FieldError>{submitError}</FieldError>
        ) : null}
        {children}
      </FieldGroup>
    </form>
  );
};
