import { Input } from "@pulse/ui/components/input";
import type { ChangeEvent, ComponentProps } from "react";
import { FieldShell, type FieldShellProps } from "./field-shell";
import { PasswordInput } from "./password-input";

export type TextFieldProps = FieldShellProps &
  Pick<ComponentProps<typeof Input>, "type" | "placeholder" | "autoComplete">;

export const TextField = ({
  type = "text",
  placeholder,
  autoComplete,
  ...shellProps
}: TextFieldProps) => (
  <FieldShell<string> {...shellProps}>
    {(control, field) => {
      const inputProps = {
        ...control,
        placeholder,
        autoComplete,
        value: field.state.value,
        onChange: (event: ChangeEvent<HTMLInputElement>) =>
          field.handleChange(event.target.value),
      };

      return type === "password" ? (
        <PasswordInput {...inputProps} />
      ) : (
        <Input {...inputProps} type={type} />
      );
    }}
  </FieldShell>
);
