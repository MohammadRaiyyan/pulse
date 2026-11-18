import {
  INVITATION_TTL_DAYS,
  type Invitation,
  type User,
} from "@pulse/contracts";
import { inviteUrlFor } from "../lib/app-url";
import { seedId } from "../lib/ids";
import { daysFromNow, minutesAgo } from "../lib/time";

const INVITATION_NAMESPACE = 30;
const DEMO_INVITE_TOKEN = "demo-invite-sam";

export const seedInvitations = (inviter: User | undefined): Invitation[] =>
  inviter
    ? [
        {
          id: seedId(INVITATION_NAMESPACE, 1),
          email: "sam@pulse.dev",
          role: "member",
          status: "pending",
          inviteUrl: inviteUrlFor(DEMO_INVITE_TOKEN),
          invitedBy: { id: inviter.id, name: inviter.name },
          expiresAt: daysFromNow(INVITATION_TTL_DAYS - 1),
          createdAt: minutesAgo(1_440),
        },
      ]
    : [];
