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
    githubLogin: UserTable.githubLogin,
    email: UserTable.email,
    name: UserTable.name,
    avatarUrl: UserTable.avatarUrl,
  },
} as const;

export async function upsertGitHubUser({
  id,
  githubLogin,
  email,
  name,
  avatarUrl,
  db,
}: WithDb<{
  id: string;
  githubLogin: string;
  email: string | null;
  name: string;
  avatarUrl: string | null;
}>) {
  const users = await db
    .insert(UserTable)
    .values({
      id,
      githubLogin,
      email,
      name,
      avatarUrl,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: UserTable.id,
      set: {
        githubLogin,
        email,
        name,
        avatarUrl,
        updatedAt: new Date(),
      },
    })
    .returning(UserSelectInfo.info);

  const user = users[0] ?? null;

  if (!user) {
    return {
      ok: false,
      errorCode: ErrorCodes.INTERNAL_ERROR,
      error: "Failed to upsert GitHub user",
    } as const;
  }

  return { ok: true, user } as const;
}

export async function getUserByEmail({
  email,
  db,
}: WithDb<{ email: string | null }>) {
  if (email === null) {
    return null;
  }

  const user = await db
    .select(UserSelectInfo.info)
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
