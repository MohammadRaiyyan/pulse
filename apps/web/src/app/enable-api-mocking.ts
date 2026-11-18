import { env } from "@/config/env";

export const enableApiMocking = async () => {
  if (!import.meta.env.DEV || !env.isApiMockingEnabled) {
    return;
  }

  const [{ network }, { handlers }] = await Promise.all([
    import("virtual:msw"),
    import("@/mocks/handlers"),
  ]);

  network.configure({ handlers, onUnhandledFrame: "bypass" });
  await network.enable();
};
