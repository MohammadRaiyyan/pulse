import type { LinkedAccount, User } from "@pulse/contracts";

export const seedLinkedAccounts = (owner: User | undefined) =>
  new Map<string, LinkedAccount[]>(
    owner
      ? [
          [
            owner.id,
            [
              {
                provider: "github",
                email: owner.email,
                linkedAt: owner.createdAt,
              },
            ],
          ],
        ]
      : [],
  );
