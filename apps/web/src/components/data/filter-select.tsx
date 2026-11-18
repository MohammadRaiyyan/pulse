import { OptionSelect } from "@/components/form/option-select";
import { ALL_FILTER_VALUE, type FilterProps } from "./filter-options";

export const FilterSelect = <TValue extends string>({
  label,
  value,
  options,
  onChange,
}: FilterProps<TValue>) => (
  <OptionSelect<TValue | typeof ALL_FILTER_VALUE>
    value={value ?? ALL_FILTER_VALUE}
    options={[
      { value: ALL_FILTER_VALUE, label: `All ${label.toLowerCase()}` },
      ...options,
    ]}
    onChange={(nextValue) =>
      onChange(nextValue === ALL_FILTER_VALUE ? undefined : nextValue)
    }
    className="w-44"
    aria-label={label}
  />
);
