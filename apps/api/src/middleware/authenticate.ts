import { type Permission, hasPermission } from "@pulse/contracts";
import type { Request, RequestHandler } from "express";
import { forbidden, unauthorized } from "../lib/errors.ts";
import { verifyAccessToken } from "../security/access-token.ts";
import { isAccessTokenRevoked } from "../security/session-revocation.ts";
import { getCachedUser } from "../modules/users/user.service.ts";

const BEARER_PREFIX = "Bearer ";

export const readBearerToken = (req: Request) => {
  const header = req.get("authorization");

  if (!header || !header.startsWith(BEARER_PREFIX)) {
    return null;
  }

  return header.slice(BEARER_PREFIX.length);
};

export const authenticateRequest = async (req: Request) => {
  const token = readBearerToken(req);
  const claims = token ? await verifyAccessToken(token) : null;
  const isRevoked = claims ? await isAccessTokenRevoked(claims) : true;
  const user = claims && !isRevoked ? await getCachedUser(claims.userId) : null;

  if (!user) {
    throw unauthorized("Access token is missing or expired");
  }

  req.user = user;

  return user;
};

export const requireAuth: RequestHandler = async (req, _res, next) => {
  await authenticateRequest(req);
  next();
};

export const requirePermission = (permission: Permission): RequestHandler => {
  return (req, _res, next) => {
    if (!req.user) {
      throw unauthorized("Sign in to continue");
    }

    if (!hasPermission(req.user.role, permission)) {
      throw forbidden(`Your role is not allowed to perform ${permission}`);
    }

    next();
  };
};

export const currentUser = (req: Request) => {
  if (!req.user) {
    throw unauthorized("Sign in to continue");
  }

  return req.user;
};
