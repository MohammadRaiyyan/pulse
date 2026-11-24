import { assertPublicUrl } from "./outbound-url.ts";

export type SafeFetchOptions = {
  method: string;
  headers?: Record<string, string>;
  body?: string;
  timeoutMs: number;
};

export const safeFetch = async (url: string, options: SafeFetchOptions) => {
  await assertPublicUrl(url);

  return fetch(url, {
    method: options.method,
    headers: options.headers,
    body: options.body,
    redirect: "follow",
    signal: AbortSignal.timeout(options.timeoutMs),
  });
};
