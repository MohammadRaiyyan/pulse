import { Input } from "@pulse/ui/components/input";
import type { ComponentProps } from "react";
import { FieldShell, type FieldShellProps } from "./field-shell";

export type TextFieldProps = FieldShellProps &
  Pick<ComponentProps<typeof Input>, "type" | "placeholder" | "autoComplete">;

export const TextField = ({
  type = "text",
  placeholder,
  autoComplete,
  ...shellProps
}: TextFieldProps) => (
  <FieldShell<string> {...shellProps}>
    {(control, field) => (
      <Input
        {...control}
        type={type}
        placeholder={placeholder}
        autoComplete={autoComplete}
        value={field.state.value}
        onChange={(event) => field.handleChange(event.target.value)}
      />
    )}
  </FieldShell>
);
