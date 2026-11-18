import { Input } from "@pulse/ui/components/input";
import { FieldShell, type FieldShellProps } from "./field-shell";

type NumberFieldProps = FieldShellProps & {
  min?: number;
  max?: number;
  placeholder?: string;
};

const toNumberOrNull = (value: string, valueAsNumber: number) =>
  value === "" ? null : valueAsNumber;

export const NumberField = ({
  min,
  max,
  placeholder,
  ...shellProps
}: NumberFieldProps) => (
  <FieldShell<number | null> {...shellProps}>
    {(control, field) => (
      <Input
        {...control}
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        placeholder={placeholder}
        value={field.state.value ?? ""}
        onChange={(event) =>
          field.handleChange(
            toNumberOrNull(event.target.value, event.target.valueAsNumber),
          )
        }
      />
    )}
  </FieldShell>
);
