import { TableCell, TableRow } from "@pulse/ui/components/table";
import type { ReactNode } from "react";
import { type DataTableColumn, DataTableFrame } from "./data-table-frame";
import { visibleColumns } from "./visible-columns";

export type { DataTableColumn } from "./data-table-frame";

type DataTableProps<TRow> = {
  columns: readonly DataTableColumn<TRow>[];
  rows: readonly TRow[];
  getRowId: (row: TRow) => string;
  emptyState: ReactNode;
};

export const DataTable = <TRow,>({
  columns,
  rows,
  getRowId,
  emptyState,
}: DataTableProps<TRow>) => {
  if (rows.length === 0) {
    return emptyState;
  }

  const shownColumns = visibleColumns(columns);

  return (
    <DataTableFrame columns={shownColumns}>
      {rows.map((row) => (
        <TableRow key={getRowId(row)}>
          {shownColumns.map((column) => (
            <TableCell key={column.id} className={column.className}>
              {column.cell(row)}
            </TableCell>
          ))}
        </TableRow>
      ))}
    </DataTableFrame>
  );
};
