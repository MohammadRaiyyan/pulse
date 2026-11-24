import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  SecretDecryptionError,
  createSecretBox,
  secretBox,
} from "./secret-box.ts";

const flipCharacter = (value: string, index: number) =>
  `${value.slice(0, index)}${value[index] === "A" ? "B" : "A"}${value.slice(index + 1)}`;

describe("secret box", () => {
  it("round trips values with a key version prefix and a fresh IV", () => {
    const first = secretBox.encrypt("Bearer abc123");
    const second = secretBox.encrypt("Bearer abc123");

    expect(first).toMatch(/^v1:[A-Za-z0-9_-]+$/);
    expect(first).not.toContain("abc123");
    expect(first).not.toBe(second);
    expect(secretBox.decrypt(first)).toBe("Bearer abc123");
    expect(secretBox.decrypt(secretBox.encrypt(""))).toBe("");
  });

  it("detects tampered ciphertext", () => {
    const stored = secretBox.encrypt("Bearer abc123");

    expect(() =>
      secretBox.decrypt(flipCharacter(stored, stored.length - 2)),
    ).toThrow(SecretDecryptionError);
    expect(() => secretBox.decrypt(flipCharacter(stored, 5))).toThrow(
      SecretDecryptionError,
    );
    expect(() => secretBox.decrypt("v1:short")).toThrow(SecretDecryptionError);
    expect(() => secretBox.decrypt("no-version")).toThrow(
      SecretDecryptionError,
    );
  });

  it("refuses unknown key versions and the wrong key", () => {
    const stored = secretBox.encrypt("value");
    const otherKey = createSecretBox({
      current: "v1",
      keys: { v1: randomBytes(32) },
    });

    expect(() => secretBox.decrypt(stored.replace(/^v1:/, "v9:"))).toThrow(
      "Unknown encryption key version v9",
    );
    expect(() => otherKey.decrypt(stored)).toThrow(SecretDecryptionError);
  });

  it("decrypts values written with an older key after rotation", () => {
    const oldKey = randomBytes(32);
    const before = createSecretBox({ current: "v1", keys: { v1: oldKey } });
    const after = createSecretBox({
      current: "v2",
      keys: { v1: oldKey, v2: randomBytes(32) },
    });
    const stored = before.encrypt("rotated");

    expect(after.decrypt(stored)).toBe("rotated");
    expect(after.encrypt("new")).toMatch(/^v2:/);
  });
});
