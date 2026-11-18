import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@pulse/ui/components/empty";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

type EmptyStateProps = {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: ReactNode;
};

export const EmptyState = ({
  icon: Icon,
  title,
  description,
  action,
}: EmptyStateProps) => (
  <Empty className="border border-dashed bg-card/60">
    <EmptyHeader>
      <EmptyMedia variant="icon" className="bg-accent text-accent-foreground">
        <Icon />
      </EmptyMedia>
      <EmptyTitle>{title}</EmptyTitle>
      <EmptyDescription>{description}</EmptyDescription>
    </EmptyHeader>
    {action ? <EmptyContent>{action}</EmptyContent> : null}
  </Empty>
);
