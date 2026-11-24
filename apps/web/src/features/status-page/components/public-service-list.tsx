import type { PublicService } from "@pulse/contracts";
import { cn } from "@pulse/ui/lib/utils";
import { toneStyles } from "@/components/data/tones";
import { UptimeBars } from "@/features/services/components/uptime-bars";
import { serviceStatusMeta } from "@/features/services/service-meta";

const PublicServiceItem = ({ service }: { service: PublicService }) => {
  const { label, tone } = serviceStatusMeta[service.status];

  return (
    <li className="flex flex-col gap-3 p-4">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
        <div className="flex min-w-0 flex-col gap-0.5">
          <h3 className="font-medium">{service.name}</h3>
          {service.description ? (
            <p className="text-sm text-muted-foreground">
              {service.description}
            </p>
          ) : null}
        </div>
        <span className={cn("text-sm font-medium", toneStyles[tone].text)}>
          {label}
        </span>
      </div>
      <UptimeBars history={service} />
    </li>
  );
};

export const PublicServiceList = ({
  services,
}: {
  services: readonly PublicService[];
}) =>
  services.length === 0 ? (
    <p className="rounded-xl border bg-card p-4 text-sm text-muted-foreground">
      No services are published yet.
    </p>
  ) : (
    <ul className="divide-y rounded-xl border bg-card">
      {services.map((service) => (
        <PublicServiceItem key={service.id} service={service} />
      ))}
    </ul>
  );
