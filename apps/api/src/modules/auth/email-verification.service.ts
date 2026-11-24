import { env } from "../../config/env.ts";
import { minutesFromNow } from "../../lib/dates.ts";
import { AppError, conflict, notFound } from "../../lib/errors.ts";
import { logger } from "../../lib/logger.ts";
import { sendEmail } from "../../lib/mailer.ts";
import { generateToken, hashToken } from "../../security/tokens.ts";
import { findUserById } from "../users/user.repository.ts";
import type { AuthUser } from "../users/user.service.ts";
import {
  consumeEmailVerificationToken,
  insertEmailVerificationToken,
} from "./email-verification.repository.ts";

const VERIFICATION_TOKEN_TTL_HOURS = 24;

type VerifiableUser = {
  id: string;
  name: string;
  email: string;
};

const verificationEmailText = (user: VerifiableUser, verifyUrl: string) =>
  [
    `Hi ${user.name},`,
    "",
    `Confirm that ${user.email} is your email address for Pulse by opening this link:`,
    "",
    verifyUrl,
    "",
    `The link expires in ${VERIFICATION_TOKEN_TTL_HOURS} hours. If you did not expect this email, you can ignore it.`,
  ].join("\n");

export const sendVerificationEmail = async (user: VerifiableUser) => {
  const token = generateToken();

  await insertEmailVerificationToken({
    userId: user.id,
    email: user.email,
    tokenHash: hashToken(token),
    expiresAt: minutesFromNow(VERIFICATION_TOKEN_TTL_HOURS * 60),
  });

  const verifyUrl = new URL("/verify-email", env.APP_URL);
  verifyUrl.searchParams.set("token", token);

  await sendEmail({
    to: user.email,
    subject: "Verify your email for Pulse",
    text: verificationEmailText(user, verifyUrl.href),
  });
};

export const trySendVerificationEmail = async (user: VerifiableUser) => {
  try {
    await sendVerificationEmail(user);
  } catch (error) {
    logger.error(
      { err: error, userId: user.id },
      "Could not send the verification email",
    );
  }
};

export const verifyEmail = async (token: string) => {
  const user = await consumeEmailVerificationToken(hashToken(token));

  if (!user) {
    throw new AppError(
      "NOT_FOUND",
      "This verification link is invalid or has expired",
    );
  }

  return user;
};

export const resendVerificationEmail = async (authUser: AuthUser) => {
  const user = await findUserById(authUser.id);

  if (!user) {
    throw notFound("User");
  }

  if (user.emailVerifiedAt) {
    throw conflict("Your email is already verified");
  }

  await sendVerificationEmail(user);
};
