import { redis } from "../lib/redis.ts";
import { ACCESS_TOKEN_TTL_SECONDS, type AccessTokenClaims } from "./access-token.ts";

const revokedAtKey = (userId: string) => `auth:sessions-revoked-at:${userId}`;

export const rejectAccessTokensIssuedBeforeNow = async (userId: string) => {
  await redis.set(revokedAtKey(userId), String(Date.now()), "EX", ACCESS_TOKEN_TTL_SECONDS);
};

export const isAccessTokenRevoked = async (claims: AccessTokenClaims) => {
  const revokedAt = await redis.get(revokedAtKey(claims.userId));
  return revokedAt !== null && claims.issuedAtMs < Number(revokedAt);
};
