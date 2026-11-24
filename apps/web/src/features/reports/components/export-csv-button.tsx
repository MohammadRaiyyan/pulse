import type { ReportQuery } from "@pulse/contracts";
import { useMutation } from "@tanstack/react-query";
import { DownloadIcon } from "lucide-react";
import { ActionButton } from "@/components/actions/action-button";
import { downloadReportCsv } from "../api/report-api";

export const ExportCsvButton = ({ query }: { query: ReportQuery }) => {
  const exportCsv = useMutation({ mutationFn: downloadReportCsv });

  return (
    <ActionButton
      variant="outline"
      icon={DownloadIcon}
      label={exportCsv.isPending ? "Exporting…" : "Export CSV"}
      disabled={exportCsv.isPending}
      onClick={() => exportCsv.mutate(query)}
    />
  );
};
