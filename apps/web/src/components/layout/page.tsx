import type { ReactNode } from "react";
import { PageHeader, type PageHeaderProps } from "./page-header";

type PageProps = PageHeaderProps & {
  summary?: ReactNode;
  children: ReactNode;
};

export const Page = ({ summary, children, ...headerProps }: PageProps) => (
  <div className="flex w-full flex-col gap-4">
    <PageHeader {...headerProps} />
    {summary}
    {children}
  </div>
);
