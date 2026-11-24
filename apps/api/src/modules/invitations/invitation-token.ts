import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "../../config/env.ts";

const sign = (invitationId: string) =>
  createHmac("sha256", env.INVITE_SECRET)
    .update(invitationId)
    .digest("base64url");

export const createInvitationToken = (invitationId: string) =>
  `${invitationId}.${sign(invitationId)}`;

export const readInvitationToken = (token: string) => {
  const [invitationId, signature] = token.split(".");

  if (!invitationId || !signature) {
    return null;
  }

  const expected = Buffer.from(sign(invitationId));
  const received = Buffer.from(signature);

  if (
    expected.length !== received.length ||
    !timingSafeEqual(expected, received)
  ) {
    return null;
  }

  return invitationId;
};
