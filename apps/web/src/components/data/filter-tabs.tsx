import { Tabs, TabsList, TabsTrigger } from "@pulse/ui/components/tabs";
import { findOption } from "@/lib/options";
import { ALL_FILTER_VALUE, type FilterProps } from "./filter-options";

export const FilterTabs = <TValue extends string>({
  label,
  value,
  options,
  onChange,
}: FilterProps<TValue>) => (
  <Tabs
    value={value ?? ALL_FILTER_VALUE}
    onValueChange={(nextValue) =>
      onChange(findOption(options, nextValue)?.value)
    }
  >
    <TabsList aria-label={label}>
      <TabsTrigger value={ALL_FILTER_VALUE}>All</TabsTrigger>
      {options.map((option) => (
        <TabsTrigger key={option.value} value={option.value}>
          {option.label}
        </TabsTrigger>
      ))}
    </TabsList>
  </Tabs>
);
