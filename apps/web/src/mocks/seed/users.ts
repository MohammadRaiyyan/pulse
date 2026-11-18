import type { User } from "@pulse/contracts";
import { DEMO_ACCOUNTS, DEMO_PASSWORD } from "../demo-accounts";
import { seedId } from "../lib/ids";
import { minutesAgo } from "../lib/time";

const USER_NAMESPACE = 1;
const DAYS_IN_MINUTES = 1_440;

export const seedUsers = () =>
  DEMO_ACCOUNTS.map((account, index): User => ({
    id: seedId(USER_NAMESPACE, index + 1),
    name: account.name,
    email: account.email,
    role: account.role,
    createdAt: minutesAgo(
      (DEMO_ACCOUNTS.length - index) * 30 * DAYS_IN_MINUTES,
    ),
  }));

export const seedPasswords = (users: readonly User[]) =>
  new Map(users.map((user) => [user.id, DEMO_PASSWORD]));
