import type { Role } from "@pulse/contracts";
import { cacheKeys, cached, invalidate } from "../../lib/cache.ts";
import { findUserById } from "./user.repository.ts";

const USER_CACHE_SECONDS = 60;

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
};

export const getCachedUser = (userId: string) =>
  cached<AuthUser | null>(
    cacheKeys.user(userId),
    USER_CACHE_SECONDS,
    async () => {
      const user = await findUserById(userId);
      return user
        ? { id: user.id, name: user.name, email: user.email, role: user.role }
        : null;
    },
  );

export const forgetCachedUser = (userId: string) =>
  invalidate(cacheKeys.user(userId));
