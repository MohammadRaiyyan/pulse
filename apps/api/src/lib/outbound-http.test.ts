import type { LookupAddress } from "node:dns";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  BLOCKED_ADDRESS_MESSAGE,
  type OutboundPolicy,
  createSafeFetch,
  isPublicAddress,
} from "./outbound-http.ts";

let port = 0;
const hits: string[] = [];

const target = createServer((req, res) => {
  hits.push(req.url ?? "");
  const redirects: Record<string, string> = {
    "/to-metadata": "http://169.254.169.254/latest/meta-data/",
    "/to-mapped": `http://[::ffff:127.0.0.1]:${port}/ok`,
    "/to-internal-name": `http://internal.test:${port}/ok`,
    "/to-ok": "/ok",
    "/to-ftp": "ftp://files.test/data",
  };
  const location = redirects[req.url ?? ""];

  if (location) {
    res.writeHead(302, { Location: location });
    res.end();
    return;
  }

  if (req.url?.startsWith("/loop")) {
    const step = Number(req.url.split("/")[2] ?? 0);
    res.writeHead(302, { Location: `/loop/${step + 1}` });
    res.end();
    return;
  }

  res.end("ok");
});

const stubbedHosts: Record<string, LookupAddress[]> = {
  "public.test": [{ address: "127.0.0.1", family: 4 }],
  "internal.test": [{ address: "10.0.0.5", family: 4 }],
};

const stubbedResolve: OutboundPolicy["resolve"] = (hostname, callback) => {
  const addresses = stubbedHosts[hostname];

  if (!addresses) {
    callback(Object.assign(new Error("not found"), { code: "ENOTFOUND" }), []);
    return;
  }

  callback(null, addresses);
};

const strictFetch = createSafeFetch({ isAllowedAddress: isPublicAddress });

const stubbedFetch = createSafeFetch({
  isAllowedAddress: (address) => address === "127.0.0.1",
  resolve: stubbedResolve,
});

const permissiveFetch = createSafeFetch({ isAllowedAddress: () => true });

const request = { method: "GET", timeoutMs: 2000 };

beforeAll(() => {
  target.listen(0);
  port = (target.address() as AddressInfo).port;
});

afterAll(() => {
  target.close();
});

describe("isPublicAddress", () => {
  it.each([
    "0.0.0.0",
    "10.1.2.3",
    "100.64.0.1",
    "127.0.0.1",
    "169.254.169.254",
    "172.16.0.1",
    "192.0.0.8",
    "192.0.2.1",
    "192.168.1.1",
    "198.18.0.1",
    "198.51.100.1",
    "203.0.113.1",
    "224.0.0.1",
    "240.0.0.1",
    "255.255.255.255",
    "::",
    "::1",
    "fc00::1",
    "fd12:3456::1",
    "fe80::1",
    "ff02::1",
    "64:ff9b::a00:1",
    "::ffff:127.0.0.1",
    "::ffff:7f00:1",
    "::ffff:169.254.169.254",
    "::ffff:10.0.0.1",
    "2001:db8::1",
    "not-an-ip",
  ])("blocks %s", (address) => {
    expect(isPublicAddress(address)).toBe(false);
  });

  it.each([
    "8.8.8.8",
    "1.1.1.1",
    "93.184.215.14",
    "2606:4700:4700::1111",
    "::ffff:8.8.8.8",
  ])("allows %s", (address) => {
    expect(isPublicAddress(address)).toBe(true);
  });
});

describe("safeFetch", () => {
  it("blocks private IP literals before connecting", async () => {
    hits.length = 0;
    await expect(
      strictFetch(`http://127.0.0.1:${port}/ok`, request),
    ).rejects.toThrow(BLOCKED_ADDRESS_MESSAGE);
    expect(hits).toEqual([]);
  });

  it("blocks IPv4-mapped IPv6 literals", async () => {
    await expect(
      strictFetch(`http://[::ffff:127.0.0.1]:${port}/ok`, request),
    ).rejects.toThrow(BLOCKED_ADDRESS_MESSAGE);
  });

  it("blocks hostnames that resolve to private addresses", async () => {
    await expect(
      strictFetch(`http://localhost:${port}/ok`, request),
    ).rejects.toThrow(BLOCKED_ADDRESS_MESSAGE);
    await expect(
      stubbedFetch(`http://internal.test:${port}/ok`, request),
    ).rejects.toThrow(BLOCKED_ADDRESS_MESSAGE);
  });

  it("rejects schemes other than http and https", async () => {
    await expect(strictFetch("file:///etc/passwd", request)).rejects.toThrow(
      "Blocked: only http and https are allowed",
    );
  });

  it("allows targets that pass the address policy", async () => {
    const response = await stubbedFetch(
      `http://public.test:${port}/ok`,
      request,
    );
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("ok");
  });

  it("follows redirects to allowed targets", async () => {
    const response = await stubbedFetch(
      `http://public.test:${port}/to-ok`,
      request,
    );
    expect(response.status).toBe(200);
  });

  it.each(["/to-metadata", "/to-mapped", "/to-internal-name"])(
    "blocks a redirect from %s to a private address",
    async (path) => {
      await expect(
        stubbedFetch(`http://public.test:${port}${path}`, request),
      ).rejects.toThrow(BLOCKED_ADDRESS_MESSAGE);
    },
  );

  it("blocks a redirect to a non-http scheme", async () => {
    await expect(
      stubbedFetch(`http://public.test:${port}/to-ftp`, request),
    ).rejects.toThrow("Blocked: only http and https are allowed");
  });

  it("stops after five redirects", async () => {
    await expect(
      permissiveFetch(`http://localhost:${port}/loop/0`, request),
    ).rejects.toThrow("Too many redirects");
  });

  it("reaches private targets when private networks are allowed", async () => {
    const response = await permissiveFetch(
      `http://localhost:${port}/ok`,
      request,
    );
    expect(response.status).toBe(200);
  });
});
