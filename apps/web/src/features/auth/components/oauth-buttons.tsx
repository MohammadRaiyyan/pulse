import type { OAuthProvider } from "@pulse/contracts";
import { Button } from "@pulse/ui/components/button";
import { useStartOAuth } from "../hooks/use-auth-mutations";
import { providerMeta } from "../provider-meta";

type OAuthButtonsProps = {
  providers: readonly OAuthProvider[];
  redirectTo?: string;
};

export const OAuthButtons = ({ providers, redirectTo }: OAuthButtonsProps) => {
  const startOAuth = useStartOAuth();

  return (
    <div className="grid grid-cols-2 gap-2">
      {providers.map((provider) => {
        const { label, icon: Icon } = providerMeta[provider];

        return (
          <Button
            key={provider}
            type="button"
            variant="outline"
            className={providers.length === 1 ? "col-span-2" : undefined}
            disabled={startOAuth.isPending}
            onClick={() =>
              startOAuth.mutate({
                provider,
                input: { intent: "sign-in", redirectTo },
              })
            }
          >
            <Icon className="size-4" />
            {label}
          </Button>
        );
      })}
    </div>
  );
};
