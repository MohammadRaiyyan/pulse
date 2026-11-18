import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@pulse/ui/components/field";
import { useStore } from "@tanstack/react-form";
import { type ReactNode, useId } from "react";
import { useFieldContext } from "./form-context";

export type FieldShellProps = {
  label: string;
  description?: string;
};

type FieldControl = {
  id: string;
  name: string;
  onBlur: () => void;
  "aria-invalid": boolean;
};

type BoundField<TValue> = ReturnType<typeof useFieldContext<TValue>>;

type FieldShellLayoutProps<TValue> = FieldShellProps & {
  orientation?: "vertical" | "horizontal";
  children: (control: FieldControl, field: BoundField<TValue>) => ReactNode;
};

const hasMessage = (error: unknown): error is { message: string } =>
  typeof error === "object" &&
  error !== null &&
  "message" in error &&
  typeof error.message === "string";

const toErrorMessage = (error: unknown) => {
  if (typeof error === "string") {
    return { message: error };
  }

  return hasMessage(error) ? { message: error.message } : undefined;
};

export const FieldShell = <TValue,>({
  label,
  description,
  orientation = "vertical",
  children,
}: FieldShellLayoutProps<TValue>) => {
  const field = useFieldContext<TValue>();
  const id = useId();
  const hasSubmitted = useStore(
    field.form.store,
    (state) => state.submissionAttempts > 0,
  );
  const isValidated = field.state.meta.isDirty || hasSubmitted;
  const errors = isValidated ? field.state.meta.errors.map(toErrorMessage) : [];
  const invalid = errors.length > 0;
  const control = children(
    { id, name: field.name, onBlur: field.handleBlur, "aria-invalid": invalid },
    field,
  );
  const isHorizontal = orientation === "horizontal";

  return (
    <Field data-invalid={invalid} orientation={orientation}>
      {isHorizontal ? control : null}
      <FieldContent>
        <FieldLabel htmlFor={id}>{label}</FieldLabel>
        {isHorizontal ? null : control}
        {description ? (
          <FieldDescription>{description}</FieldDescription>
        ) : null}
        <FieldError errors={errors} />
      </FieldContent>
    </Field>
  );
};
