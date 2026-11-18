import { LogOutIcon } from "lucide-react";
import { ActionButton } from "@/components/actions/action-button";
import { ConfirmDialog } from "@/components/dialogs/confirm-dialog";
import { useSignOutEverywhere } from "../hooks/use-account-mutations";

export const SignOutEverywhere = () => {
  const signOutEverywhere = useSignOutEverywhere();

  return (
    <div className="flex flex-wrap items-center justify-between gap-4">
      <p className="max-w-md text-sm text-muted-foreground">
        Revokes every refresh token for your account. All devices, including
        this one, will need to sign in again.
      </p>
      <ConfirmDialog
        title="Sign out of all devices?"
        description="Every active session for your account will end immediately."
        confirmLabel="Sign out everywhere"
        isPending={signOutEverywhere.isPending}
        onConfirm={(close) =>
          signOutEverywhere.mutate(undefined, { onSuccess: close })
        }
        trigger={
          <ActionButton
            variant="outline"
            icon={LogOutIcon}
            label="Sign out everywhere"
          />
        }
      />
    </div>
  );
};
