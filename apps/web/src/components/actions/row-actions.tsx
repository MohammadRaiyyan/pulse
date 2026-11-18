import type { ReactNode } from "react";

export const RowActions = ({ children }: { children: ReactNode }) => (
  <div className="flex justify-end gap-1">{children}</div>
);
