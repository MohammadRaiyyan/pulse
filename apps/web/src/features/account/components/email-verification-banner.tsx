import { Button } from "@pulse/ui/components/button";
import { MailWarningIcon } from "lucide-react";
import { useCurrentUser } from "@/features/auth/hooks/use-current-user";
import { useResendEmailVerification } from "../hooks/use-account-mutations";

export const EmailVerificationBanner = () => {
  const { email, emailVerifiedAt } = useCurrentUser();
  const resend = useResendEmailVerification();

  if (emailVerifiedAt) {
    return null;
  }

  return (
    <section
      aria-label="Email verification"
      className="flex flex-wrap items-center justify-between gap-3 border-b bg-muted/40 px-4 py-2 text-sm md:px-6"
    >
      <p className="flex items-center gap-2">
        <MailWarningIcon className="size-4 shrink-0 text-muted-foreground" />
        <span>
          Verify your email address. We sent a link to{" "}
          <span className="font-medium">{email}</span>.
        </span>
      </p>
      <Button
        size="sm"
        variant="outline"
        disabled={resend.isPending || resend.isSuccess}
        onClick={() => resend.mutate()}
      >
        {resend.isSuccess ? "Email sent" : "Resend email"}
      </Button>
    </section>
  );
};
