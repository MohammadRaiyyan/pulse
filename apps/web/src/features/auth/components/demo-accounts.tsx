import type { LoginInput } from "@pulse/contracts";
import { ArrowRightIcon } from "lucide-react";
import { env } from "@/config/env";
import { RoleBadge } from "@/features/team/components/role-badge";
import { DEMO_ACCOUNTS, DEMO_PASSWORD } from "@/mocks/demo-accounts";

type DemoAccountsProps = {
  onSelect: (credentials: LoginInput) => void;
};

export const DemoAccounts = ({ onSelect }: DemoAccountsProps) => {
  if (!env.isApiMockingEnabled) {
    return null;
  }

  return (
    <div className="flex flex-col gap-2 border-t pt-4">
      <p className="font-mono text-xs text-muted-foreground">
        Demo accounts · mock API
      </p>
      <ul className="flex flex-col">
        {DEMO_ACCOUNTS.map((account) => (
          <li key={account.email}>
            <button
              type="button"
              onClick={() =>
                onSelect({ email: account.email, password: DEMO_PASSWORD })
              }
              className="group flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-accent"
            >
              <span className="flex items-center gap-2">
                <RoleBadge value={account.role} />
                <span className="font-mono text-xs text-muted-foreground">
                  {account.email}
                </span>
              </span>
              <ArrowRightIcon className="size-3.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
};
