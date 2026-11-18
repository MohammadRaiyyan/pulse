import type { ReactNode } from "react";

export type PageHeaderProps = {
  title: ReactNode;
  badge?: ReactNode;
  actions?: ReactNode;
};

export const PageHeader = ({ title, badge, actions }: PageHeaderProps) => (
  <div className="flex min-h-9 flex-wrap items-center justify-between gap-4">
    <h1 className="text-[26px] leading-tight font-semibold tracking-[-0.02em]">
      {badge ? (
        <span className="flex items-center gap-3">
          {title}
          {badge}
        </span>
      ) : (
        title
      )}
    </h1>
    {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
  </div>
);
