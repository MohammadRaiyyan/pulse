import { SignJWT, jwtVerify } from "jose";
import { env } from "../config/env.ts";

const secret = new TextEncoder().encode(env.JWT_SECRET);
const ALGORITHM = "HS256";
const ISSUER = "pulse-api";
const ACCESS_TOKEN_TTL = "15m";

export const signAccessToken = (userId: string) =>
  new SignJWT()
    .setProtectedHeader({ alg: ALGORITHM })
    .setSubject(userId)
    .setIssuer(ISSUER)
    .setIssuedAt()
    .setExpirationTime(ACCESS_TOKEN_TTL)
    .sign(secret);

export const verifyAccessToken = async (token: string) => {
  try {
    const { payload } = await jwtVerify(token, secret, {
      algorithms: [ALGORITHM],
      issuer: ISSUER,
    });
    return payload.sub ?? null;
  } catch {
    return null;
  }
};
