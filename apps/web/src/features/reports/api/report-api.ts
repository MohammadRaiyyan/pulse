import { type ReportQuery, endpoints } from "@pulse/contracts";
import { queryOptions } from "@tanstack/react-query";
import { callEndpoint } from "@/lib/api/call-endpoint";
import { downloadFile } from "@/lib/api/http-client";
import { createQueryKeys } from "@/lib/query/query-keys";

const reportKeys = createQueryKeys("reports");

const CSV_TYPE = "text/csv";

export const reportQuery = (query: ReportQuery) =>
  queryOptions({
    queryKey: reportKeys.list(query),
    queryFn: () => callEndpoint(endpoints.report, { query }),
  });

const saveBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
};

export const downloadReportCsv = async (query: ReportQuery) => {
  const { blob, filename } = await downloadFile(
    endpoints.exportReport.path,
    query,
    CSV_TYPE,
  );

  saveBlob(blob, filename ?? "pulse-report.csv");
};
