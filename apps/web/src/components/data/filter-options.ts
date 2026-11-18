import type { Option } from "@/lib/options";

export const ALL_FILTER_VALUE = "all";

export type FilterProps<TValue extends string> = {
  label: string;
  value: TValue | undefined;
  options: readonly Option<TValue>[];
  onChange: (value: TValue | undefined) => void;
};
