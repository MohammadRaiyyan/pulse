import type { ReactNode } from "react";

type IdentityCellProps = {
  media: ReactNode;
  title: ReactNode;
  subtitle: ReactNode;
};

export const IdentityCell = ({ media, title, subtitle }: IdentityCellProps) => (
  <div className="flex items-center gap-3">
    {media}
    <div className="flex flex-col gap-0.5">
      <div className="text-sm font-medium">{title}</div>
      <div className="text-xs text-muted-foreground">{subtitle}</div>
    </div>
  </div>
);
