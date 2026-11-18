import type { LucideIcon } from "lucide-react";

export type Option<TValue extends string = string> = {
  value: TValue;
  label: string;
  icon?: LucideIcon;
};

type OptionMeta = Pick<Option, "label" | "icon">;

export const metaOptions = <TValue extends string>(
  values: readonly TValue[],
  meta: Record<TValue, OptionMeta>,
): Option<TValue>[] =>
  values.map((value) => ({
    value,
    label: meta[value].label,
    icon: meta[value].icon,
  }));

export const valueOptions = <TValue extends string>(
  values: readonly TValue[],
): Option<TValue>[] => values.map((value) => ({ value, label: value }));

export const findOption = <TValue extends string>(
  options: readonly Option<TValue>[],
  value: string,
) => options.find((option) => option.value === value);
