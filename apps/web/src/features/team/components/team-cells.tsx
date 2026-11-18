import { MailIcon } from "lucide-react";
import { IdentityCell } from "@/components/data/identity-cell";
import { UserAvatar } from "@/components/data/user-avatar";
import { formatDateTime, formatRelativeTime } from "@/lib/format/date";
import type { TeamRow } from "../team-rows";
import { InvitationActions } from "./invitation-actions";
import { MemberActionsCell, MemberRoleCell } from "./member-cells";
import { RoleBadge } from "./role-badge";
import { TeamStatusBadge } from "./team-status-badge";

type TeamCellProps = { row: TeamRow };

const InvitationMedia = () => (
  <span className="flex size-8 items-center justify-center rounded-lg border border-dashed text-muted-foreground">
    <MailIcon className="size-4" />
  </span>
);

export const TeamIdentityCell = ({ row }: TeamCellProps) =>
  row.kind === "member" ? (
    <IdentityCell
      media={<UserAvatar name={row.member.name} />}
      title={row.member.name}
      subtitle={row.member.email}
    />
  ) : (
    <IdentityCell
      media={<InvitationMedia />}
      title={row.invitation.email}
      subtitle={`Invited by ${row.invitation.invitedBy.name}`}
    />
  );

export const TeamRoleCell = ({ row }: TeamCellProps) =>
  row.kind === "member" ? (
    <MemberRoleCell member={row.member} />
  ) : (
    <RoleBadge value={row.invitation.role} />
  );

export const TeamStatusCell = ({ row }: TeamCellProps) => (
  <div className="flex flex-col items-start gap-1">
    <TeamStatusBadge value={row.kind} />
    {row.kind === "invitation" ? (
      <span className="text-xs text-muted-foreground">
        Expires {formatRelativeTime(row.invitation.expiresAt)}
      </span>
    ) : null}
  </div>
);

export const TeamDateCell = ({ row }: TeamCellProps) =>
  formatDateTime(
    row.kind === "member" ? row.member.createdAt : row.invitation.createdAt,
  );

export const TeamActionsCell = ({ row }: TeamCellProps) =>
  row.kind === "member" ? (
    <MemberActionsCell member={row.member} />
  ) : (
    <InvitationActions invitation={row.invitation} />
  );
