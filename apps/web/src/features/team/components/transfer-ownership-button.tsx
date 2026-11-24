import type { User } from "@pulse/contracts";
import { Button } from "@pulse/ui/components/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@pulse/ui/components/tooltip";
import { CrownIcon } from "lucide-react";
import { IconButton } from "@/components/actions/icon-button";
import { FormDialog } from "@/components/dialogs/form-dialog";
import { useTransferOwnership } from "../hooks/use-transfer-ownership";
import { TransferOwnershipForm } from "./transfer-ownership-form";

type TransferOwnershipButtonProps = { member: User };

const UnverifiedMemberButton = ({ member }: TransferOwnershipButtonProps) => (
  <Tooltip>
    <TooltipTrigger asChild>
      <Button
        variant="ghost"
        size="icon"
        aria-disabled
        aria-label={`Transfer ownership to ${member.name}`}
        className="cursor-not-allowed opacity-50"
      >
        <CrownIcon />
      </Button>
    </TooltipTrigger>
    <TooltipContent>
      {member.name} must verify their email before they can become the owner
    </TooltipContent>
  </Tooltip>
);

export const TransferOwnershipButton = ({
  member,
}: TransferOwnershipButtonProps) => {
  const transferOwnership = useTransferOwnership();

  if (!member.emailVerifiedAt) {
    return <UnverifiedMemberButton member={member} />;
  }

  return (
    <FormDialog
      title={`Transfer ownership to ${member.name}?`}
      description="This takes effect immediately. Only the new owner can transfer it back."
      trigger={
        <IconButton label={`Transfer ownership to ${member.name}`}>
          <CrownIcon />
        </IconButton>
      }
    >
      {({ close, closeAfter }) => (
        <TransferOwnershipForm
          member={member}
          onCancel={close}
          onSubmit={closeAfter((input) =>
            transferOwnership.mutateAsync({ id: member.id, input }),
          )}
        />
      )}
    </FormDialog>
  );
};
