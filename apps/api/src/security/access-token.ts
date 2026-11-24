import { SignJWT, jwtVerify } from "jose";
import { env } from "../config/env.ts";

const secret = new TextEncoder().encode(env.JWT_SECRET);
const ALGORITHM = "HS256";
const ISSUER = "pulse-api";

export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;

export type AccessTokenClaims = {
  userId: string;
  issuedAtMs: number;
};

export const signAccessToken = (userId: string) =>
  new SignJWT({ issuedAtMs: Date.now() })
    .setProtectedHeader({ alg: ALGORITHM })
    .setSubject(userId)
    .setIssuer(ISSUER)
    .setIssuedAt()
    .setExpirationTime(`${ACCESS_TOKEN_TTL_SECONDS}s`)
    .sign(secret);

export const verifyAccessToken = async (token: string): Promise<AccessTokenClaims | null> => {
  try {
    const { payload } = await jwtVerify(token, secret, {
      algorithms: [ALGORITHM],
      issuer: ISSUER,
    });

    if (!payload.sub || typeof payload.issuedAtMs !== "number") {
      return null;
    }

    return { userId: payload.sub, issuedAtMs: payload.issuedAtMs };
  } catch {
    return null;
  }
};
