import type { Role } from "@pulse/contracts";

type DemoAccount = {
  role: Role;
  name: string;
  email: string;
};

export const DEMO_PASSWORD = "password123";

export const DEMO_ACCOUNTS = [
  { role: "owner", name: "Olivia Owner", email: "owner@pulse.dev" },
  { role: "admin", name: "Adam Admin", email: "admin@pulse.dev" },
  { role: "member", name: "Maya Member", email: "member@pulse.dev" },
  { role: "viewer", name: "Victor Viewer", email: "viewer@pulse.dev" },
] as const satisfies readonly DemoAccount[];
