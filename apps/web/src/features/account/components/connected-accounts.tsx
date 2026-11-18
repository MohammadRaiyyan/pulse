import {
  type LinkedAccount,
  type OAuthProvider,
  oauthProviderSchema,
} from "@pulse/contracts";
import { Button } from "@pulse/ui/components/button";
import { useSuspenseQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { IdentityCell } from "@/components/data/identity-cell";
import { ControlSkeleton } from "@/components/skeleton/control-skeleton";
import { TextSkeleton } from "@/components/skeleton/text-skeleton";
import { ConfirmDialog } from "@/components/dialogs/confirm-dialog";
import { useStartOAuth } from "@/features/auth/hooks/use-auth-mutations";
import { providerMeta } from "@/features/auth/provider-meta";
import { formatDateTime } from "@/lib/format/date";
import { connectionsQuery } from "../api/account-api";
import { useDisconnectProvider } from "../hooks/use-account-mutations";

const SETTINGS_PATH = "/settings";

type ProviderRowProps = {
  provider: OAuthProvider;
  account: LinkedAccount | undefined;
};

const ConnectButton = ({ provider }: { provider: OAuthProvider }) => {
  const startOAuth = useStartOAuth();

  return (
    <Button
      variant="outline"
      disabled={startOAuth.isPending}
      onClick={() =>
        startOAuth.mutate({
          provider,
          input: { intent: "link", redirectTo: SETTINGS_PATH },
        })
      }
    >
      Connect
    </Button>
  );
};

const DisconnectButton = ({ provider }: { provider: OAuthProvider }) => {
  const disconnect = useDisconnectProvider();
  const { label } = providerMeta[provider];

  return (
    <ConfirmDialog
      title={`Disconnect ${label}?`}
      description={`You will no longer be able to sign in with ${label}.`}
      confirmLabel="Disconnect"
      isPending={disconnect.isPending}
      onConfirm={(close) => disconnect.mutate(provider, { onSuccess: close })}
      trigger={<Button variant="ghost">Disconnect</Button>}
    />
  );
};

type ProviderRowLayoutProps = {
  provider: OAuthProvider;
  subtitle: ReactNode;
  action: ReactNode;
};

const ProviderRowLayout = ({
  provider,
  subtitle,
  action,
}: ProviderRowLayoutProps) => {
  const { label, icon: Icon } = providerMeta[provider];

  return (
    <li className="flex items-center justify-between gap-4 py-3">
      <IdentityCell
        media={
          <span className="flex size-9 items-center justify-center rounded-md border bg-card">
            <Icon className="size-4" />
          </span>
        }
        title={label}
        subtitle={subtitle}
      />
      {action}
    </li>
  );
};

const ProviderRow = ({ provider, account }: ProviderRowProps) => (
  <ProviderRowLayout
    provider={provider}
    subtitle={
      account
        ? `${account.email} · since ${formatDateTime(account.linkedAt)}`
        : "Not connected"
    }
    action={
      account ? (
        <DisconnectButton provider={provider} />
      ) : (
        <ConnectButton provider={provider} />
      )
    }
  />
);

const ProviderList = ({ children }: { children: ReactNode }) => (
  <ul className="flex flex-col divide-y">{children}</ul>
);

export const ConnectedAccounts = () => {
  const { data: accounts } = useSuspenseQuery(connectionsQuery);

  return (
    <ProviderList>
      {oauthProviderSchema.options.map((provider) => (
        <ProviderRow
          key={provider}
          provider={provider}
          account={accounts.find((account) => account.provider === provider)}
        />
      ))}
    </ProviderList>
  );
};

export const ConnectedAccountsSkeleton = () => (
  <ProviderList>
    {oauthProviderSchema.options.map((provider) => (
      <ProviderRowLayout
        key={provider}
        provider={provider}
        subtitle={<TextSkeleton className="h-3 w-48" />}
        action={<ControlSkeleton className="w-24" />}
      />
    ))}
  </ProviderList>
);
