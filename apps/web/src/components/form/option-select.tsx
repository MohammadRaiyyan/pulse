import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@pulse/ui/components/select";
import type { ComponentProps } from "react";
import { type Option, findOption } from "@/lib/options";
import { OptionLabel } from "./option-label";

type OptionSelectProps<TValue extends string> = Omit<
  ComponentProps<typeof SelectTrigger>,
  "onChange"
> & {
  value: string | undefined;
  options: readonly Option<TValue>[];
  onChange: (value: TValue) => void;
  name?: string;
  placeholder?: string;
  disabled?: boolean;
};

export const OptionSelect = <TValue extends string>({
  value,
  options,
  onChange,
  name,
  placeholder,
  disabled,
  ...triggerProps
}: OptionSelectProps<TValue>) => {
  const handleChange = (nextValue: string) => {
    const option = findOption(options, nextValue);

    if (option) {
      onChange(option.value);
    }
  };

  return (
    <Select
      name={name}
      value={value}
      onValueChange={handleChange}
      disabled={disabled}
    >
      <SelectTrigger {...triggerProps}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            <OptionLabel option={option} />
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};
