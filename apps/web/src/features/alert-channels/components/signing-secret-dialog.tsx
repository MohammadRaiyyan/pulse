import type { AlertChannel } from "@pulse/contracts";
import { Button } from "@pulse/ui/components/button";
import { useQuery } from "@tanstack/react-query";
import { KeyRoundIcon } from "lucide-react";
import { IconButton } from "@/components/actions/icon-button";
import { CopyButton } from "@/components/data/copy-button";
import { ConfirmDialog } from "@/components/dialogs/confirm-dialog";
import { Modal } from "@/components/dialogs/modal";
import { SpinnerFallback } from "@/components/feedback/spinner-fallback";
import {
  signingSecretQuery,
  useRotateSigningSecret,
} from "../api/alert-channel-resource";

const SigningSecret = ({ id }: { id: string }) => {
  const { data } = useQuery(signingSecretQuery(id));
  const rotate = useRotateSigningSecret();

  if (!data) {
    return <SpinnerFallback />;
  }

  return (
    <div className="flex flex-col gap-4 text-sm">
      <span className="flex min-w-0 items-center gap-1 rounded-xl bg-muted p-3">
        <code
          className="truncate font-mono text-xs"
          aria-label="Signing secret"
        >
          {data.signingSecret}
        </code>
        <CopyButton value={data.signingSecret} label="Signing secret" />
      </span>
      <p className="text-muted-foreground">
        Every request carries an <code>X-Pulse-Timestamp</code> header (Unix
        seconds) and an <code>X-Pulse-Signature</code> header of the form{" "}
        <code>v1=&lt;hex&gt;</code>: the HMAC-SHA256 of{" "}
        <code>timestamp.body</code> keyed with this secret.
      </p>
      <div className="flex justify-end">
        <ConfirmDialog
          trigger={<Button variant="outline">Rotate secret</Button>}
          title="Rotate signing secret"
          description="The current secret stops working immediately. Update your receiver with the new one."
          confirmLabel="Rotate"
          isPending={rotate.isPending}
          onConfirm={(close) => rotate.mutate({ id }, { onSuccess: close })}
        />
      </div>
    </div>
  );
};

export const SigningSecretDialog = ({ channel }: { channel: AlertChannel }) => (
  <Modal
    title={`Signing secret for ${channel.name}`}
    description="Use it to verify that webhook requests come from Pulse."
    trigger={
      <IconButton label={`Signing secret for ${channel.name}`}>
        <KeyRoundIcon />
      </IconButton>
    }
  >
    <SigningSecret id={channel.id} />
  </Modal>
);
