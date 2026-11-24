import { Button } from "@pulse/ui/components/button";
import { Link } from "@tanstack/react-router";
import { MailIcon } from "lucide-react";

export const InviteOnlyNotice = () => (
  <div className="flex flex-col gap-4">
    <div className="flex gap-3 rounded-lg border bg-muted/40 p-4 text-sm">
      <MailIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      <p>
        Pulse is invite-only. Ask a workspace admin to send you an invitation,
        then open the link in that email to create your account.
      </p>
    </div>
    <Button variant="outline" className="w-full" asChild>
      <Link to="/login">Back to sign in</Link>
    </Button>
  </div>
);
