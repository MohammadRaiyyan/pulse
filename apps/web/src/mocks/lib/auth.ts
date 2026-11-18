import { type Permission, type User, hasPermission } from "@pulse/contracts";
import { db } from "../db";
import { errorResponse } from "./responses";

const ACCESS_TOKEN_PREFIX = "mock-access";
const ACCESS_TOKEN_TTL_MS = 60_000;

const readBearerToken = (request: Request) =>
  request.headers.get("Authorization")?.replace(/^Bearer\s+/i, "") ?? "";

const unauthorized = (message: string) =>
  errorResponse("UNAUTHORIZED", message);

export const issueAccessToken = (userId: string) =>
  [ACCESS_TOKEN_PREFIX, userId, Date.now() + ACCESS_TOKEN_TTL_MS].join(".");

export const authenticate = (request: Request) => {
  const [prefix, userId = "", expiresAt] = readBearerToken(request).split(".");

  if (prefix !== ACCESS_TOKEN_PREFIX || Number(expiresAt) < Date.now()) {
    throw unauthorized("Access token is missing or expired");
  }

  const user = db.users.get(userId);

  if (!user) {
    throw unauthorized("User no longer exists");
  }

  return user;
};

export const assertPermission = (user: User, permission: Permission) => {
  if (!hasPermission(user.role, permission)) {
    throw errorResponse(
      "FORBIDDEN",
      `Your role is not allowed to perform ${permission}`,
    );
  }
};
