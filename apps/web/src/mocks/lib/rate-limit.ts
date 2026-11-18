import { errorResponse } from "./responses";

type Window = {
  count: number;
  resetAt: number;
};

export const createRateLimiter = ({
  limit,
  windowMs,
}: {
  limit: number;
  windowMs: number;
}) => {
  const windows = new Map<string, Window>();

  return (key: string) => {
    const currentTime = Date.now();
    const window = windows.get(key);
    const active =
      window && window.resetAt > currentTime
        ? window
        : { count: 0, resetAt: currentTime + windowMs };

    active.count += 1;
    windows.set(key, active);

    if (active.count > limit) {
      const retryAfterSeconds = Math.ceil(
        (active.resetAt - currentTime) / 1000,
      );

      throw errorResponse("RATE_LIMITED", "Too many attempts.", {
        headers: { "Retry-After": String(retryAfterSeconds) },
      });
    }
  };
};
