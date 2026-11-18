import { Button } from "@pulse/ui/components/button";
import { useNavigate } from "@tanstack/react-router";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { formatCount } from "@/lib/format/number";

type PaginationControlsProps = {
  page: number;
  pageSize: number;
  total: number;
};

export const PaginationControls = ({
  page,
  pageSize,
  total,
}: PaginationControlsProps) => {
  const navigate = useNavigate();
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const firstItem = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const lastItem = Math.min(page * pageSize, total);

  const goToPage = (nextPage: number) =>
    navigate({
      to: ".",
      search: (previous) => ({ ...previous, page: nextPage }),
    });

  if (pageCount === 1) {
    return null;
  }

  return (
    <div className="flex items-center justify-between gap-4 text-sm text-muted-foreground">
      <p>
        Showing {formatCount(firstItem)}–{formatCount(lastItem)} of{" "}
        {formatCount(total)}
      </p>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          disabled={page <= 1}
          onClick={() => goToPage(page - 1)}
        >
          <ChevronLeftIcon data-icon="inline-start" />
          Previous
        </Button>
        <Button
          variant="outline"
          disabled={page >= pageCount}
          onClick={() => goToPage(page + 1)}
        >
          Next
          <ChevronRightIcon data-icon="inline-end" />
        </Button>
      </div>
    </div>
  );
};
