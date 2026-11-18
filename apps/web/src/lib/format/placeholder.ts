export const EMPTY_VALUE = "—";

export const withPlaceholder =
  <TValue>(format: (value: TValue) => string) =>
  (value: TValue | null | undefined) =>
    value === null || value === undefined ? EMPTY_VALUE : format(value);
