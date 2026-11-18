import type { Option } from "@/lib/options";
import { FieldShell, type FieldShellProps } from "./field-shell";
import { OptionSelect } from "./option-select";

type SelectFieldProps = FieldShellProps & {
  options: readonly Option[];
  placeholder?: string;
};

export const SelectField = ({
  options,
  placeholder,
  ...shellProps
}: SelectFieldProps) => (
  <FieldShell<string> {...shellProps}>
    {({ name, ...control }, field) => (
      <OptionSelect
        {...control}
        name={name}
        value={field.state.value}
        options={options}
        onChange={field.handleChange}
        placeholder={placeholder}
        className="w-full"
      />
    )}
  </FieldShell>
);
