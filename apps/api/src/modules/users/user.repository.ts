import type { Role } from "@pulse/contracts";
import { and, count, desc, eq, ne, notInArray, sql } from "drizzle-orm";
import { db } from "../../db/client.ts";
import { users } from "../../models/index.ts";

export const userColumns = {
  id: users.id,
  name: users.name,
  email: users.email,
  role: users.role,
  emailVerifiedAt: users.emailVerifiedAt,
  createdAt: users.createdAt,
};

export type UserRecord = {
  id: string;
  name: string;
  email: string;
  role: Role;
  emailVerifiedAt: Date | null;
  createdAt: Date;
};

type NewUser = {
  name: string;
  email: string;
  role: Role;
  passwordHash: string | null;
  emailVerifiedAt?: Date | null;
};

type NewOwner = Omit<NewUser, "role">;

const OWNER_BOOTSTRAP_LOCK = 7_301_001;

const byEmail = (email: string) =>
  sql`lower(${users.email}) = ${email.toLowerCase()}`;

export const findUserById = async (id: string) => {
  const [user] = await db
    .select(userColumns)
    .from(users)
    .where(eq(users.id, id));
  return user;
};

export const findUserByEmail = async (email: string) => {
  const [user] = await db.select(userColumns).from(users).where(byEmail(email));
  return user;
};

export const findUserWithPasswordByEmail = async (email: string) => {
  const [user] = await db.select().from(users).where(byEmail(email));
  return user;
};

export const findPasswordHash = async (id: string) => {
  const [user] = await db
    .select({ passwordHash: users.passwordHash })
    .from(users)
    .where(eq(users.id, id));
  return user?.passwordHash ?? null;
};

export const hasAnyUser = async () => {
  const [user] = await db.select({ id: users.id }).from(users).limit(1);
  return Boolean(user);
};

export const listUsers = async (limit: number, offset: number) => {
  const [rows, [totalRow]] = await Promise.all([
    db
      .select(userColumns)
      .from(users)
      .orderBy(desc(users.createdAt))
      .limit(limit)
      .offset(offset),
    db.select({ total: count() }).from(users),
  ]);

  return { rows, total: totalRow?.total ?? 0 };
};

export const insertUser = async (values: NewUser) => {
  const [user] = await db.insert(users).values(values).returning(userColumns);

  if (!user) {
    throw new Error("Failed to insert user");
  }

  return user;
};

export const insertFirstUserAsOwner = (values: NewOwner) =>
  db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(${OWNER_BOOTSTRAP_LOCK})`);

    const [existing] = await tx.select({ id: users.id }).from(users).limit(1);

    if (existing) {
      return undefined;
    }

    const [user] = await tx
      .insert(users)
      .values({ ...values, role: "owner" })
      .returning(userColumns);

    return user;
  });

export const updateUser = async (id: string, changes: Partial<NewUser>) => {
  const [user] = await db
    .update(users)
    .set(changes)
    .where(eq(users.id, id))
    .returning(userColumns);
  return user;
};

const changeableBy = (actorRole: Role) =>
  actorRole === "owner"
    ? ne(users.role, "owner")
    : notInArray(users.role, ["owner", "admin"]);

export const updateMemberRole = async (
  id: string,
  role: Role,
  actorRole: Role,
) => {
  const [user] = await db
    .update(users)
    .set({ role })
    .where(and(eq(users.id, id), changeableBy(actorRole)))
    .returning(userColumns);
  return user;
};

export const deleteMember = async (id: string, actorRole: Role) => {
  const [user] = await db
    .delete(users)
    .where(and(eq(users.id, id), changeableBy(actorRole)))
    .returning({ id: users.id });
  return user;
};
