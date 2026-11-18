import { useRouterState } from "@tanstack/react-router";

export const NavigationProgress = () => {
  const isNavigating = useRouterState({
    select: (state) => state.status === "pending",
  });

  if (!isNavigating) {
    return null;
  }

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-x-0 top-0 z-50 h-0.5 overflow-hidden"
    >
      <div className="h-full w-2/5 animate-route-progress bg-brand shadow-[0_0_8px_var(--brand)]" />
    </div>
  );
};
