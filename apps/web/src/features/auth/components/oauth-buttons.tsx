import { oauthProviderSchema } from "@pulse/contracts";
import { Button } from "@pulse/ui/components/button";
import { useStartOAuth } from "../hooks/use-auth-mutations";
import { providerMeta } from "../provider-meta";

export const OAuthButtons = ({ redirectTo }: { redirectTo?: string }) => {
  const startOAuth = useStartOAuth();

  return (
    <div className="grid grid-cols-2 gap-2">
      {oauthProviderSchema.options.map((provider) => {
        const { label, icon: Icon } = providerMeta[provider];

        return (
          <Button
            key={provider}
            type="button"
            variant="outline"
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
