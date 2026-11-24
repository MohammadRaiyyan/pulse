import { ArrowDownIcon, ArrowUpDownIcon, ArrowUpIcon } from "lucide-react";
import type { SortDirection, SortState } from "../report-sort";

type SortableHeaderProps<TKey extends string> = {
  label: string;
  sortKey: TKey;
  sort: SortState<TKey>;
  onSort: (sort: SortState<TKey>) => void;
};

const directionIcons = {
  asc: ArrowUpIcon,
  desc: ArrowDownIcon,
};

export const SortableHeader = <TKey extends string>({
  label,
  sortKey,
  sort,
  onSort,
}: SortableHeaderProps<TKey>) => {
  const isActive = sort.key === sortKey;
  const Icon = isActive ? directionIcons[sort.direction] : ArrowUpDownIcon;
  const nextDirection: SortDirection =
    isActive && sort.direction === "asc" ? "desc" : "asc";

  return (
    <button
      type="button"
      className="inline-flex items-center gap-1 hover:text-foreground"
      aria-label={`Sort by ${label}, ${nextDirection === "asc" ? "ascending" : "descending"}`}
      onClick={() => onSort({ key: sortKey, direction: nextDirection })}
    >
      {label}
      <Icon className={isActive ? "size-3.5" : "size-3.5 opacity-40"} />
    </button>
  );
};
