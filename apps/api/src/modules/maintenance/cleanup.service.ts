import { daysAgo } from "../../lib/dates.ts";
import { logger } from "../../lib/logger.ts";
import { deleteUsedOrExpiredEmailVerificationTokens } from "../auth/email-verification.repository.ts";
import { deleteUsedOrExpiredResetTokens } from "../auth/password-reset.repository.ts";
import { deleteStaleSessions } from "../auth/session.repository.ts";
import { deleteChecksOlderThan } from "../monitors/monitor.repository.ts";

const CHECK_RETENTION_DAYS = 30;
const REVOKED_SESSION_RETENTION_DAYS = 7;

export const cleanUpOldData = async () => {
  await deleteChecksOlderThan(daysAgo(CHECK_RETENTION_DAYS));
  await deleteStaleSessions(daysAgo(REVOKED_SESSION_RETENTION_DAYS));
  await deleteUsedOrExpiredResetTokens();
  await deleteUsedOrExpiredEmailVerificationTokens();

  logger.info("Old data cleaned up");
};
