import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Page } from "@/components/layout/page";
import { guard } from "@/features/auth/guards";
import { reportQuery } from "@/features/reports/api/report-api";
import { ExportCsvButton } from "@/features/reports/components/export-csv-button";
import { ReportControls } from "@/features/reports/components/report-controls";
import { ReportView } from "@/features/reports/components/report-view";
import {
  type ReportSearch,
  reportSearchSchema,
  toReportQuery,
} from "@/features/reports/report-search";

const ReportsPage = () => {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const query = toReportQuery(search);

  const changeSearch = (changes: Partial<ReportSearch>) =>
    navigate({ search: (previous) => ({ ...previous, ...changes }) });

  return (
    <Page title="Reports" actions={<ExportCsvButton query={query} />}>
      <ReportControls search={search} onChange={changeSearch} />
      <ReportView query={query} />
    </Page>
  );
};

export const Route = createFileRoute("/_app/reports")({
  validateSearch: reportSearchSchema,
  beforeLoad: guard("monitor:read"),
  loaderDeps: ({ search }) => search,
  loader: ({ context, deps }) => {
    void context.queryClient.prefetchQuery(reportQuery(toReportQuery(deps)));
  },
  component: ReportsPage,
});
