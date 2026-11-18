import { z } from "zod";
import {
  idSchema,
  paginationQuerySchema,
  timestampSchema,
  tokenSchema,
} from "../common/index.ts";
import { registerSchema } from "../auth/index.ts";
import { assignableRoleSchema } from "../rbac/index.ts";
import { emailSchema, userRefSchema } from "../users/index.ts";

export const INVITATION_TTL_DAYS = 7;

export const invitationStatusSchema = z.enum([
  "pending",
  "accepted",
  "revoked",
  "expired",
]);

export type InvitationStatus = z.infer<typeof invitationStatusSchema>;

export const createInvitationSchema = z.object({
  email: emailSchema,
  role: assignableRoleSchema,
});

export type CreateInvitationInput = z.infer<typeof createInvitationSchema>;

export const invitationSchema = createInvitationSchema.extend({
  id: idSchema,
  status: invitationStatusSchema,
  inviteUrl: z.url(),
  invitedBy: userRefSchema,
  expiresAt: timestampSchema,
  createdAt: timestampSchema,
});

export type Invitation = z.infer<typeof invitationSchema>;

export const invitationListQuerySchema = paginationQuerySchema.extend({
  status: invitationStatusSchema.optional(),
});

export type InvitationListQuery = z.infer<typeof invitationListQuerySchema>;

export const invitationPreviewSchema = invitationSchema.pick({
  email: true,
  role: true,
  invitedBy: true,
  expiresAt: true,
});

export type InvitationPreview = z.infer<typeof invitationPreviewSchema>;

export const acceptInvitationSchema = registerSchema
  .omit({ email: true })
  .extend({ token: tokenSchema });

export type AcceptInvitationInput = z.infer<typeof acceptInvitationSchema>;

export const resolveInvitationStatus = (
  invitation: Pick<Invitation, "status" | "expiresAt">,
  now: string,
): InvitationStatus =>
  invitation.status === "pending" && invitation.expiresAt <= now
    ? "expired"
    : invitation.status;
