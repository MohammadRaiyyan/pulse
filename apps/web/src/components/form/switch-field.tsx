import { Switch } from "@pulse/ui/components/switch";
import { FieldShell, type FieldShellProps } from "./field-shell";

export const SwitchField = (props: FieldShellProps) => (
  <FieldShell<boolean> {...props} orientation="horizontal">
    {(control, field) => (
      <Switch
        {...control}
        checked={field.state.value}
        onCheckedChange={field.handleChange}
      />
    )}
  </FieldShell>
);
