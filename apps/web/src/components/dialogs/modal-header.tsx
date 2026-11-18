import type { ReactNode } from "react";

export const modalTitleClassName =
  "font-heading text-lg leading-snug font-semibold tracking-tight";

export const modalDescriptionClassName =
  "text-sm leading-snug text-muted-foreground";

type ModalHeaderProps = {
  title: ReactNode;
  description?: ReactNode;
  close: ReactNode;
};

export const ModalHeader = ({
  title,
  description,
  close,
}: ModalHeaderProps) => (
  <div className="flex items-start justify-between gap-4 border-b px-5 py-4">
    <div className="flex min-w-0 flex-col gap-0.5 text-left">
      {title}
      {description}
    </div>
    <div className="-mt-1 -mr-2 shrink-0">{close}</div>
  </div>
);
