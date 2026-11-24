import { parseArgs } from "node:util";
import { emailSchema, nameSchema, passwordSchema } from "@pulse/contracts";
import { z } from "zod";
import { env } from "../config/env.ts";
import { sql } from "../db/client.ts";
import { insertFirstUserAsOwner } from "../modules/users/user.repository.ts";
import { hashPassword } from "../security/passwords.ts";

const USAGE =
  "Usage: OWNER_PASSWORD=<password> pnpm --filter api user:create-owner --email <email> --name <name>";

const inputSchema = z.object({
  email: emailSchema,
  name: nameSchema,
  password: passwordSchema,
});

const readInput = () => {
  const { values } = parseArgs({
    options: {
      email: { type: "string" },
      name: { type: "string" },
    },
  });

  return inputSchema.safeParse({
    email: values.email,
    name: values.name,
    password: process.env.OWNER_PASSWORD,
  });
};

const createOwner = async () => {
  const input = readInput();

  if (!input.success) {
    return {
      isCreated: false,
      message: `${z.prettifyError(input.error)}\n\n${USAGE}`,
    };
  }

  const owner = await insertFirstUserAsOwner({
    name: input.data.name,
    email: input.data.email,
    passwordHash: await hashPassword(input.data.password),
    emailVerifiedAt: new Date(),
  });

  return owner
    ? {
        isCreated: true,
        message: `Created the owner account ${owner.email}. Sign in at ${env.APP_URL}.`,
      }
    : {
        isCreated: false,
        message:
          "This workspace already has users. Invite people from the Team page instead.",
      };
};

const result = await createOwner();
await sql.end();

if (result.isCreated) {
  console.log(result.message);
} else {
  console.error(result.message);
  process.exitCode = 1;
}
