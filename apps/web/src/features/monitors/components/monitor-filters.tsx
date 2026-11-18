import type { MonitorListQuery } from "@pulse/contracts";
import { FilterSelect } from "@/components/data/filter-select";
import { SearchForm } from "@/components/data/search-form";
import { monitorStatusOptions } from "../monitor-meta";

type MonitorFilterValues = Pick<MonitorListQuery, "status" | "search">;

type MonitorFiltersProps = MonitorFilterValues & {
  onChange: (filters: MonitorFilterValues) => void;
};

export const MonitorFilters = ({
  status,
  search,
  onChange,
}: MonitorFiltersProps) => (
  <div className="flex items-center gap-2">
    <SearchForm
      value={search ?? ""}
      placeholder="Search monitors"
      onSearch={(value) => onChange({ search: value || undefined })}
    />
    <FilterSelect
      label="Statuses"
      value={status}
      options={monitorStatusOptions}
      onChange={(value) => onChange({ status: value })}
    />
  </div>
);
