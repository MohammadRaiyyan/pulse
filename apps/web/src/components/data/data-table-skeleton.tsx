import { TableCell, TableRow } from "@pulse/ui/components/table";
import { TextSkeleton } from "@/components/skeleton/text-skeleton";
import { type DataTableColumn, DataTableFrame } from "./data-table-frame";
import { visibleColumns } from "./visible-columns";

const DEFAULT_ROWS = 5;

type DataTableSkeletonProps<TRow> = {
  columns: readonly DataTableColumn<TRow>[];
  rows?: number;
};

export const DataTableSkeleton = <TRow,>({
  columns,
  rows = DEFAULT_ROWS,
}: DataTableSkeletonProps<TRow>) => {
  const shownColumns = visibleColumns(columns);

  return (
    <DataTableFrame columns={shownColumns}>
      {Array.from({ length: rows }, (_, index) => (
        <TableRow key={index} aria-hidden>
          {shownColumns.map((column) => (
            <TableCell key={column.id} className={column.className}>
              {column.skeleton ?? (column.header ? <TextSkeleton /> : null)}
            </TableCell>
          ))}
        </TableRow>
      ))}
    </DataTableFrame>
  );
};
