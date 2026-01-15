import bcrypt from "bcryptjs";
import { WithDb } from "../utils/commonTypes";
import { UserTable } from "./db/schema";
import { eq } from "drizzle-orm";
import { ErrorCodes } from "../utils/error";

const UserSelectInfo = {
  basic: {
    id: UserTable.id,
  },
  info: {
    id: UserTable.id,
    email: UserTable.email,
    name: UserTable.name,
    company: UserTable.company,
  },
  withPassword: {
    id: UserTable.id,
    passwordHash: UserTable.passwordHash,
  },
};
export async function createUser({
  company,
  email,
  name,
  plainTextPassword,
  db,
}: WithDb<{
  email: string;
  company: string;
  name: string;
  plainTextPassword: string;
}>) {
  const hashedPassword = await bcrypt.hash(plainTextPassword, 10);

  const user = await db
    .insert(UserTable)
    .values({
      company,
      email,
      name,
      passwordHash: hashedPassword,
    })
    .onConflictDoNothing({
      target: [UserTable.email],
      where: eq(UserTable.isActive, true),
    })
    .returning();

  if (user.length === 0) {
    return {
      ok: false,
      errorCode: ErrorCodes.EMAIL_ALREADY_IN_USE,
      error: `Email already in use. Use another email or login.`,
    } as const;
  }

  return { ok: true, user: user[0] } as const;
}

export async function getUserByEmail({
  email,
  db,
}: WithDb<{ email: string; selectInfo?: typeof UserSelectInfo }>) {
  const user = await db
    .select(UserSelectInfo.withPassword)
    .from(UserTable)
    .where(eq(UserTable.email, email));

  if (user.length === 0) {
    return null;
  }

  return user[0];
}

export async function getUserById({
  id,
  db,
}: WithDb<{ id: string; selectInfo?: typeof UserSelectInfo }>) {
  const user = await db
    .select(UserSelectInfo.info)
    .from(UserTable)
    .where(eq(UserTable.id, id));

  if (user.length === 0) {
    return null;
  }

  return user[0];
}
