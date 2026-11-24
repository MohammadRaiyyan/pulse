import { endpoints, idSchema, timestampSchema } from "@pulse/contracts";
import { z } from "zod";
import { db } from "../db";
import { resetUrlFor } from "../lib/app-url";
import { createRateLimiter } from "../lib/rate-limit";
import { errorResponse, noContent } from "../lib/responses";
import { route } from "../lib/route";
import { decodeToken, encodeToken } from "../lib/stateless-token";
import { minutesFromNow, now } from "../lib/time";
import { findUserByEmail, setPassword } from "../lib/users";

const RESET_TOKEN_TTL_MINUTES = 30;

const resetTokenSchema = z.object({
  userId: idSchema,
  expiresAt: timestampSchema,
});

const limitResetRequests = createRateLimiter({ limit: 3, windowMs: 60_000 });

const issueResetToken = (userId: string) =>
  encodeToken({ userId, expiresAt: minutesFromNow(RESET_TOKEN_TTL_MINUTES) });

const forgotPassword = route(endpoints.forgotPassword, ({ body }) => {
  limitResetRequests(body.email);
  const user = findUserByEmail(body.email);

  if (user) {
    console.info(
      `[mock api] Password reset link for ${body.email}: ${resetUrlFor(issueResetToken(user.id))}`,
    );
  }

  return noContent();
});

const resetPassword = route(endpoints.resetPassword, ({ body }) => {
  const payload = decodeToken(body.token, resetTokenSchema);
  const user = payload ? db.users.get(payload.userId) : undefined;

  if (!payload || !user || payload.expiresAt < now()) {
    return errorResponse(
      "NOT_FOUND",
      "This reset link is invalid or has expired",
    );
  }

  setPassword(user.id, body.password);
  db.linkedAccounts.delete(user.id);

  return noContent();
});

export const passwordHandlers = [forgotPassword, resetPassword];
