import { type ReactNode, createContext, use, useState } from "react";
import { createPortal } from "react-dom";

const SectionActionsSlotContext = createContext<HTMLElement | null>(null);

type ContentSectionProps = {
  title: string;
  description: string;
  children: ReactNode;
};

export const ContentSection = ({
  title,
  description,
  children,
}: ContentSectionProps) => {
  const [actionsSlot, setActionsSlot] = useState<HTMLElement | null>(null);

  return (
    <section className="flex flex-col gap-4 rounded-xl border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-0.5">
          <h2 className="text-base font-semibold tracking-tight">{title}</h2>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        <div
          ref={setActionsSlot}
          className="flex items-center gap-2 empty:hidden"
        />
      </div>
      <SectionActionsSlotContext value={actionsSlot}>
        {children}
      </SectionActionsSlotContext>
    </section>
  );
};

export const SectionActions = ({ children }: { children: ReactNode }) => {
  const slot = use(SectionActionsSlotContext);

  return slot ? createPortal(children, slot) : null;
};
