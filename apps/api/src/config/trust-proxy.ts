import { isIP } from "node:net";

export type TrustProxySetting = false | number | string[];

const PRESETS = new Set(["loopback", "linklocal", "uniquelocal"]);

const isAddressOrRange = (entry: string) => {
  if (PRESETS.has(entry)) {
    return true;
  }

  const [address = "", prefix, ...rest] = entry.split("/");
  const version = isIP(address);

  if (version === 0 || rest.length > 0) {
    return false;
  }

  if (prefix === undefined) {
    return true;
  }

  const maxPrefix = version === 4 ? 32 : 128;

  return /^\d{1,3}$/.test(prefix) && Number(prefix) <= maxPrefix;
};

export const parseTrustProxy = (value: string): TrustProxySetting | Error => {
  const trimmed = value.trim().toLowerCase();

  if (trimmed === "false") {
    return false;
  }

  if (/^\d+$/.test(trimmed)) {
    return Number(trimmed);
  }

  const entries = trimmed
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);

  if (entries.length === 0) {
    return new Error("TRUST_PROXY must not be empty");
  }

  const invalid = entries.filter((entry) => !isAddressOrRange(entry));

  if (invalid.length > 0) {
    return new Error(
      `TRUST_PROXY must be false, a hop count, or a comma-separated list of IP addresses, CIDR ranges, loopback, linklocal or uniquelocal (invalid: ${invalid.join(", ")})`,
    );
  }

  return entries;
};
