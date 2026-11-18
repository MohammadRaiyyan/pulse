import type { Invitation, User } from "@pulse/contracts";
import type { StatusMeta } from "@/components/data/tones";

export type TeamRow =
  | { kind: "member"; id: string; member: User }
  | { kind: "invitation"; id: string; invitation: Invitation };

export const toTeamRows = (
  members: readonly User[],
  invitations: readonly Invitation[],
): TeamRow[] => [
  ...invitations.map((invitation): TeamRow => ({
    kind: "invitation",
    id: invitation.id,
    invitation,
  })),
  ...members.map((member): TeamRow => ({
    kind: "member",
    id: member.id,
    member,
  })),
];

export const teamStatusMeta: Record<TeamRow["kind"], StatusMeta> = {
  member: { label: "Active", tone: "success" },
  invitation: { label: "Invited", tone: "warning" },
};
