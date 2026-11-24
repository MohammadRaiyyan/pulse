import { PUBLIC_RECENT_INCIDENT_DAYS, type PublicStatus } from "@pulse/contracts";
import type { ReactNode } from "react";
import { formatRelativeTime } from "@/lib/format/date";
import { OverallStatusBanner } from "./overall-status-banner";
import { PublicIncidentList } from "./public-incident-list";
import { PublicServiceList } from "./public-service-list";

type PublicStatusShellProps = {
  title: string;
  description?: string;
  headerAction: ReactNode;
  children: ReactNode;
};

export const PublicStatusShell = ({
  title,
  description,
  headerAction,
  children,
}: PublicStatusShellProps) => (
  <div className="min-h-svh bg-background text-foreground">
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-8 sm:py-12">
      <header className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="font-heading text-2xl font-bold tracking-tight sm:text-3xl">
            {title}
          </h1>
          {description ? (
            <p className="text-muted-foreground">{description}</p>
          ) : null}
        </div>
        {headerAction}
      </header>
      {children}
    </main>
  </div>
);

const PublicSection = ({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) => (
  <section className="flex flex-col gap-3">
    <h2 className="text-base font-semibold tracking-tight">{title}</h2>
    {children}
  </section>
);

export const PublicStatusView = ({ status }: { status: PublicStatus }) => (
  <>
    <OverallStatusBanner status={status.overallStatus} />
    {status.activeIncidents.length > 0 ? (
      <PublicSection title="Active incidents">
        <PublicIncidentList
          incidents={status.activeIncidents}
          emptyMessage="No active incidents."
        />
      </PublicSection>
    ) : null}
    <PublicSection title="Services">
      <PublicServiceList services={status.services} />
    </PublicSection>
    <PublicSection title={`Resolved in the last ${PUBLIC_RECENT_INCIDENT_DAYS} days`}>
      <PublicIncidentList
        incidents={status.recentIncidents}
        emptyMessage="No incidents in the last week."
      />
    </PublicSection>
    <footer className="text-center text-xs text-muted-foreground">
      Updated {formatRelativeTime(status.generatedAt)}. This page refreshes
      every minute.
    </footer>
  </>
);
