import { Button } from "@pulse/ui/components/button";
import { Link } from "@tanstack/react-router";
import { ChartColumnIcon } from "lucide-react";

export const MonitorReportLink = ({ monitorId }: { monitorId: string }) => (
  <Button variant="outline" asChild>
    <Link to="/reports" search={{ monitorId }}>
      <ChartColumnIcon data-icon="inline-start" />
      Report
    </Link>
  </Button>
);
