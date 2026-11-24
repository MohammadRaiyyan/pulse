import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { env } from "../config/env.ts";

const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12;
const TAG_BYTES = 16;
const SEPARATOR = ":";

export class SecretDecryptionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SecretDecryptionError";
  }
}

export type SecretBox = {
  encrypt: (plaintext: string) => string;
  decrypt: (stored: string) => string;
};

export type SecretBoxKeys = {
  current: string;
  keys: Record<string, Buffer>;
};

export const createSecretBox = ({
  current,
  keys,
}: SecretBoxKeys): SecretBox => {
  const keyFor = (version: string) => {
    const key = keys[version];

    if (!key) {
      throw new SecretDecryptionError(
        `Unknown encryption key version ${version}`,
      );
    }

    return key;
  };

  const encrypt = (plaintext: string) => {
    const iv = randomBytes(IV_BYTES);
    const cipher = createCipheriv(ALGORITHM, keyFor(current), iv);
    const ciphertext = Buffer.concat([
      cipher.update(plaintext, "utf8"),
      cipher.final(),
    ]);
    const payload = Buffer.concat([iv, cipher.getAuthTag(), ciphertext]);

    return `${current}${SEPARATOR}${payload.toString("base64url")}`;
  };

  const decrypt = (stored: string) => {
    const separatorIndex = stored.indexOf(SEPARATOR);

    if (separatorIndex === -1) {
      throw new SecretDecryptionError("Encrypted value has no key version");
    }

    const key = keyFor(stored.slice(0, separatorIndex));
    const payload = Buffer.from(stored.slice(separatorIndex + 1), "base64url");

    if (payload.length < IV_BYTES + TAG_BYTES) {
      throw new SecretDecryptionError("Encrypted value is too short");
    }

    const decipher = createDecipheriv(
      ALGORITHM,
      key,
      payload.subarray(0, IV_BYTES),
    );
    decipher.setAuthTag(payload.subarray(IV_BYTES, IV_BYTES + TAG_BYTES));

    try {
      return Buffer.concat([
        decipher.update(payload.subarray(IV_BYTES + TAG_BYTES)),
        decipher.final(),
      ]).toString("utf8");
    } catch {
      throw new SecretDecryptionError("Encrypted value failed authentication");
    }
  };

  return { encrypt, decrypt };
};

export const secretBox = createSecretBox({
  current: "v1",
  keys: { v1: Buffer.from(env.ENCRYPTION_KEY, "base64") },
});
