import { type LookupAddress, lookup as dnsLookup } from "node:dns";
import { isIP } from "node:net";
import ipaddr from "ipaddr.js";
import { Agent, type Response, fetch } from "undici";
import { env } from "../config/env.ts";

export type SafeFetchOptions = {
  method: string;
  headers?: Record<string, string>;
  body?: string;
  timeoutMs: number;
};

export type SafeFetch = (
  url: string,
  options: SafeFetchOptions,
) => Promise<Response>;

type LookupOptions = { family?: number | string; all?: boolean };

type LookupCallback = (
  error: NodeJS.ErrnoException | null,
  address: string | LookupAddress[],
  family?: number,
) => void;

type Resolver = (
  hostname: string,
  callback: (
    error: NodeJS.ErrnoException | null,
    addresses: LookupAddress[],
  ) => void,
) => void;

type OutboundRequest = {
  method: string;
  headers?: Record<string, string>;
  body?: string;
};

export type OutboundPolicy = {
  isAllowedAddress: (address: string) => boolean;
  resolve?: Resolver;
};

export class OutboundRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OutboundRequestError";
  }
}

export const BLOCKED_ADDRESS_MESSAGE = "Blocked: private network address";

const MAX_REDIRECTS = 5;
const MAX_RESPONSE_BYTES = 1024 * 1024;
const ALLOWED_PROTOCOLS = new Set(["http:", "https:"]);
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

const BLOCKED_RANGES = [
  "0.0.0.0/8",
  "10.0.0.0/8",
  "100.64.0.0/10",
  "127.0.0.0/8",
  "169.254.0.0/16",
  "172.16.0.0/12",
  "192.0.0.0/24",
  "192.0.2.0/24",
  "192.88.99.0/24",
  "192.168.0.0/16",
  "198.18.0.0/15",
  "198.51.100.0/24",
  "203.0.113.0/24",
  "224.0.0.0/4",
  "240.0.0.0/4",
  "255.255.255.255/32",
  "::/96",
  "::1/128",
  "::ffff:0:0:0/96",
  "64:ff9b::/96",
  "64:ff9b:1::/48",
  "100::/64",
  "2001::/23",
  "2001:db8::/32",
  "2002::/16",
  "fc00::/7",
  "fe80::/10",
  "fec0::/10",
  "ff00::/8",
].map((range) => ipaddr.parseCIDR(range));

const GLOBAL_UNICAST_IPV6 = ipaddr.parseCIDR("2000::/3");

const blocked = () => new OutboundRequestError(BLOCKED_ADDRESS_MESSAGE);

const normalizeAddress = (address: string) => {
  const parsed = ipaddr.parse(address);

  if (parsed instanceof ipaddr.IPv6 && parsed.isIPv4MappedAddress()) {
    return parsed.toIPv4Address();
  }

  return parsed;
};

export const isPublicAddress = (address: string) => {
  if (!ipaddr.isValid(address)) {
    return false;
  }

  const parsed = normalizeAddress(address);

  if (parsed.kind() === "ipv6" && !parsed.match(GLOBAL_UNICAST_IPV6)) {
    return false;
  }

  return !BLOCKED_RANGES.some(
    (range) => range[0].kind() === parsed.kind() && parsed.match(range),
  );
};

const defaultResolver: Resolver = (hostname, callback) => {
  dnsLookup(hostname, { all: true }, callback);
};

const createLookup =
  (policy: OutboundPolicy) =>
  (hostname: string, options: LookupOptions, callback: LookupCallback) => {
    const resolve = policy.resolve ?? defaultResolver;

    resolve(hostname, (error, addresses) => {
      if (error) {
        callback(error, []);
        return;
      }

      const allowed = addresses.filter(({ address }) =>
        policy.isAllowedAddress(address),
      );
      const [first] = allowed;

      if (!first) {
        callback(blocked(), []);
        return;
      }

      if (options.all) {
        callback(null, allowed);
        return;
      }

      callback(null, first.address, first.family);
    });
  };

const assertAllowedTarget = (url: URL, policy: OutboundPolicy) => {
  if (!ALLOWED_PROTOCOLS.has(url.protocol)) {
    throw new OutboundRequestError("Blocked: only http and https are allowed");
  }

  const hostname = url.hostname.replace(/^\[|\]$/g, "");

  if (isIP(hostname) !== 0 && !policy.isAllowedAddress(hostname)) {
    throw blocked();
  }
};

const nextRequest = (status: number, request: OutboundRequest) => {
  const switchesToGet =
    status === 303
      ? request.method !== "HEAD"
      : (status === 301 || status === 302) && request.method === "POST";

  if (!switchesToGet) {
    return request;
  }

  const headers = Object.fromEntries(
    Object.entries(request.headers ?? {}).filter(
      ([name]) => name.toLowerCase() !== "content-type",
    ),
  );

  return { method: "GET", headers, body: undefined };
};

const unwrapFailure = (error: unknown) => {
  if (error instanceof Error && error.cause instanceof OutboundRequestError) {
    return error.cause;
  }

  return error;
};

export const createSafeFetch = (policy: OutboundPolicy): SafeFetch => {
  const dispatcher = new Agent({
    pipelining: 0,
    maxResponseSize: MAX_RESPONSE_BYTES,
    connect: { lookup: createLookup(policy) },
  });

  return async (url, options) => {
    const signal = AbortSignal.timeout(options.timeoutMs);
    let target = new URL(url);
    let request: OutboundRequest = {
      method: options.method,
      headers: options.headers,
      body: options.body,
    };

    for (let hop = 0; ; hop += 1) {
      assertAllowedTarget(target, policy);

      const response = await fetch(target, {
        ...request,
        redirect: "manual",
        dispatcher,
        signal,
      }).catch((error: unknown) => {
        throw unwrapFailure(error);
      });

      const location = response.headers.get("location");

      if (!REDIRECT_STATUSES.has(response.status) || !location) {
        return response;
      }

      await response.body?.cancel();

      if (hop >= MAX_REDIRECTS) {
        throw new OutboundRequestError("Too many redirects");
      }

      target = new URL(location, target);
      request = nextRequest(response.status, request);
    }
  };
};

export const safeFetch = createSafeFetch({
  isAllowedAddress: env.ALLOW_PRIVATE_NETWORK_TARGETS
    ? () => true
    : isPublicAddress,
});
