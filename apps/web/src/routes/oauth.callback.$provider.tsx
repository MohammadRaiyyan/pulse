import { oauthCallbackSchema, oauthProviderSchema } from "@pulse/contracts";
import { Button } from "@pulse/ui/components/button";
import {
  type ErrorComponentProps,
  Link,
  createFileRoute,
  redirect,
} from "@tanstack/react-router";
import { z } from "zod";
import { AuthErrorPage } from "@/app/shell/auth-error-page";
import { accountKeys } from "@/features/account/api/account-api";
import { authApi } from "@/features/auth/api/auth-api";
import { toSafeRedirect } from "@/features/auth/auth-search";
import { setSessionUser } from "@/features/auth/session";
import { ApiError } from "@/lib/api/api-error";

const callbackSearchSchema = oauthCallbackSchema.partial().extend({
  error: z.string().optional(),
});

const cancelledError = new ApiError({
  status: 401,
  code: "UNAUTHORIZED",
  message:
    "Sign-in with the provider was cancelled or failed. Please try again.",
});

const OAuthErrorPage = ({ error }: ErrorComponentProps) => (
  <AuthErrorPage error={error}>
    <Button variant="ghost-accent" asChild>
      <Link to="/login">Back to sign in</Link>
    </Button>
  </AuthErrorPage>
);

export const Route = createFileRoute("/oauth/callback/$provider")({
  validateSearch: callbackSearchSchema,
  loaderDeps: ({ search }) => search,
  loader: async ({ context: { queryClient }, params, deps }) => {
    const provider = oauthProviderSchema.safeParse(params.provider);

    if (!provider.success || deps.error || !deps.code || !deps.state) {
      throw cancelledError;
    }

    const { user, redirectTo } = await authApi.completeOAuth(provider.data, {
      code: deps.code,
      state: deps.state,
    });
    setSessionUser(queryClient, user);
    await queryClient.invalidateQueries({ queryKey: accountKeys.all });

    throw redirect({ href: toSafeRedirect(redirectTo) });
  },
  errorComponent: OAuthErrorPage,
});
