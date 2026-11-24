export type SortDirection = "asc" | "desc";

export type SortState<TKey extends string> = {
  key: TKey;
  direction: SortDirection;
};

export const compareValues = (
  left: string | number | null,
  right: string | number | null,
  direction: SortDirection,
) => {
  if (left === right) {
    return 0;
  }

  if (left === null) {
    return 1;
  }

  if (right === null) {
    return -1;
  }

  const order =
    typeof left === "string" && typeof right === "string"
      ? left.localeCompare(right)
      : Number(left) - Number(right);

  return direction === "asc" ? order : -order;
};
