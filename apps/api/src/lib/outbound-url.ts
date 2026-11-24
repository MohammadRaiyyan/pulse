import { lookup } from "node:dns/promises";
import { BlockList, isIP } from "node:net";
import { isProduction } from "../config/env.ts";

const privateNetworks = new BlockList();
privateNetworks.addSubnet("0.0.0.0", 8, "ipv4");
privateNetworks.addSubnet("10.0.0.0", 8, "ipv4");
privateNetworks.addSubnet("100.64.0.0", 10, "ipv4");
privateNetworks.addSubnet("127.0.0.0", 8, "ipv4");
privateNetworks.addSubnet("169.254.0.0", 16, "ipv4");
privateNetworks.addSubnet("172.16.0.0", 12, "ipv4");
privateNetworks.addSubnet("192.168.0.0", 16, "ipv4");
privateNetworks.addAddress("::1", "ipv6");
privateNetworks.addSubnet("fc00::", 7, "ipv6");
privateNetworks.addSubnet("fe80::", 10, "ipv6");

const resolveAddresses = async (hostname: string) => {
  const family = isIP(hostname);

  if (family !== 0) {
    return [{ address: hostname, family }];
  }

  return lookup(hostname, { all: true });
};

export const assertPublicUrl = async (url: string) => {
  if (!isProduction) {
    return;
  }

  const hostname = new URL(url).hostname.replace(/^\[|\]$/g, "");
  const addresses = await resolveAddresses(hostname);

  for (const { address, family } of addresses) {
    if (privateNetworks.check(address, family === 6 ? "ipv6" : "ipv4")) {
      throw new Error("Refusing to call a private network address");
    }
  }
};
