import type { DataTableColumn } from "./data-table-frame";

export const visibleColumns = <TRow>(
  columns: readonly DataTableColumn<TRow>[],
) => columns.filter((column) => !column.hidden);
