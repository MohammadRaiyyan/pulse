export const LiveDot = ({ isLive = false }: { isLive?: boolean }) => (
  <span className="relative inline-flex size-1.5 shrink-0" aria-hidden>
    {isLive ? (
      <span className="absolute inset-0 animate-signal rounded-full bg-current" />
    ) : null}
    <span className="relative size-full rounded-full bg-current" />
  </span>
);
