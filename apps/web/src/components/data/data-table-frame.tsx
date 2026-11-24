import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@pulse/ui/components/table";
import { cn } from "@pulse/ui/lib/utils";
import type { ReactNode } from "react";

export type DataTableColumn<TRow> = {
  id: string;
  header: ReactNode;
  cell: (row: TRow) => ReactNode;
  skeleton?: ReactNode;
  className?: string;
  hidden?: boolean;
};

type DataTableFrameProps<TRow> = {
  columns: readonly DataTableColumn<TRow>[];
  children: ReactNode;
};

export const DataTableFrame = <TRow,>({
  columns,
  children,
}: DataTableFrameProps<TRow>) => (
  <div className="[&_th:first-child]:rounded-tl-md [&_th:last-child]:rounded-tr-md [&_thead_tr]:border-b [&_thead_tr]:border-card">
    <Table>
      <TableHeader className="[&_th]:bg-muted/60">
        <TableRow>
          {columns.map((column) => (
            <TableHead
              key={column.id}
              className={cn(
                "h-9 text-xs font-medium text-muted-foreground",
                column.className,
              )}
            >
              {column.header}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>{children}</TableBody>
    </Table>
  </div>
);
