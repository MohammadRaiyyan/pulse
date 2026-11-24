import type { Service } from "@pulse/contracts";
import {
  type DetailDefinition,
  DetailList,
  DetailListSkeleton,
} from "@/components/data/detail-list";
import { formatCount } from "@/lib/format/number";
import { describeMembers } from "../service-members";
import { VisibilityBadge } from "./visibility-badge";

const serviceDetails: readonly DetailDefinition<Service>[] = [
  {
    label: "Description",
    value: (service) => service.description || "No description",
  },
  {
    label: "Status page",
    value: (service) => <VisibilityBadge isPublic={service.isPublic} />,
  },
  { label: "Members", value: describeMembers },
  {
    label: "Active incidents",
    value: (service) => formatCount(service.activeIncidentCount),
  },
  {
    label: "Display order",
    value: (service) => formatCount(service.position),
  },
];

export const ServiceDetails = ({ service }: { service: Service }) => (
  <DetailList definitions={serviceDetails} data={service} />
);

export const ServiceDetailsSkeleton = () => (
  <DetailListSkeleton definitions={serviceDetails} />
);
