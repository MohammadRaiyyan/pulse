import { DataTableSkeleton } from "@/components/data/data-table-skeleton";
import { StackedSkeleton } from "@/components/skeleton/stacked-skeleton";
import { ControlSkeleton } from "@/components/skeleton/control-skeleton";
import { BadgeSkeleton } from "@/components/skeleton/badge-skeleton";
import { ActionsSkeleton } from "@/components/skeleton/actions-skeleton";
import type { User } from "@pulse/contracts";
import { UsersIcon } from "lucide-react";
import { type DataTableColumn, DataTable } from "@/components/data/data-table";
import { EmptyState } from "@/components/feedback/empty-state";
import { useCan } from "@/features/auth/hooks/use-can";
import { usePendingInvitations } from "../hooks/use-pending-invitations";
import { type TeamRow, toTeamRows } from "../team-rows";
import {
  TeamActionsCell,
  TeamDateCell,
  TeamIdentityCell,
  TeamRoleCell,
  TeamStatusCell,
} from "./team-cells";

const useTeamColumns = (): DataTableColumn<TeamRow>[] => [
  {
    id: "member",
    header: "Member",
    skeleton: <StackedSkeleton withMedia />,
    cell: (row) => <TeamIdentityCell row={row} />,
  },
  {
    id: "role",
    header: "Role",
    skeleton: <ControlSkeleton className="w-32" />,
    cell: (row) => <TeamRoleCell row={row} />,
  },
  {
    id: "status",
    header: "Status",
    skeleton: <BadgeSkeleton />,
    cell: (row) => <TeamStatusCell row={row} />,
  },
  {
    id: "since",
    header: "Since",
    className: "text-muted-foreground",
    cell: (row) => <TeamDateCell row={row} />,
  },
  {
    id: "actions",
    header: "",
    skeleton: <ActionsSkeleton count={1} iconOnly />,
    className: "w-24 text-right",
    hidden: !useCan("member:manage"),
    cell: (row) => <TeamActionsCell row={row} />,
  },
];

type TeamTableProps = {
  members: readonly User[];
  includeInvitations: boolean;
};

export const TeamTable = ({ members, includeInvitations }: TeamTableProps) => {
  const columns = useTeamColumns();
  const invitations = usePendingInvitations(includeInvitations);

  return (
    <DataTable
      columns={columns}
      rows={toTeamRows(members, invitations)}
      getRowId={(row) => row.id}
      emptyState={
        <EmptyState
          icon={UsersIcon}
          title="No members yet"
          description="Invite teammates to collaborate."
        />
      }
    />
  );
};

export const TeamTableSkeleton = ({ rows }: { rows?: number }) => (
  <DataTableSkeleton columns={useTeamColumns()} rows={rows} />
);
