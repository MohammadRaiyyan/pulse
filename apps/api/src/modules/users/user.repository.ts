import type { Role } from "@pulse/contracts";
import { and, count, desc, eq, ne, sql } from "drizzle-orm";
import { db } from "../../db/client.ts";
import { users } from "../../models/index.ts";

export const userColumns = {
  id: users.id,
  name: users.name,
  email: users.email,
  role: users.role,
  createdAt: users.createdAt,
};

export type UserRecord = {
  id: string;
  name: string;
  email: string;
  role: Role;
  createdAt: Date;
};

type NewUser = {
  name: string;
  email: string;
  role: Role;
  passwordHash: string | null;
};

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

export const countUsers = async () => {
  const [result] = await db.select({ total: count() }).from(users);
  return result?.total ?? 0;
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

export const updateUser = async (id: string, changes: Partial<NewUser>) => {
  const [user] = await db
    .update(users)
    .set(changes)
    .where(eq(users.id, id))
    .returning(userColumns);
  return user;
};

export const updateRoleUnlessOwner = async (id: string, role: Role) => {
  const [user] = await db
    .update(users)
    .set({ role })
    .where(and(eq(users.id, id), ne(users.role, "owner")))
    .returning(userColumns);
  return user;
};

export const deleteUserUnlessOwner = async (id: string) => {
  const [user] = await db
    .delete(users)
    .where(and(eq(users.id, id), ne(users.role, "owner")))
    .returning({ id: users.id });
  return user;
};
