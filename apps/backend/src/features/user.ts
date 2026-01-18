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
    avatarUrl: UserTable.avatarUrl,
  },
};
export async function createUser({
  email,
  name,
  db,
  avatarUrl,
  id,
}: WithDb<{
  email: string;
  name: string;
  avatarUrl: string | null;
  id?: string;
}>) {
  const user = await db
    .insert(UserTable)
    .values({
      id,
      email,
      name,
      avatarUrl,
    })
    .onConflictDoNothing({
      target: [UserTable.email],
    })
    .returning();

  if (user.length === 0) {
    // This can happen if the user already exists. We should fetch the user in that case.
    const existingUser = await getUserByEmail({ email, db });
    if (existingUser) {
      return { ok: true, user: existingUser } as const;
    }
    return {
      ok: false,
      errorCode: ErrorCodes.EMAIL_ALREADY_IN_USE, // Or a more generic error
      error: `Something went wrong during user creation.`,
    } as const;
  }

  return { ok: true, user: user[0] } as const;
}

/**
 * Sync a user from Clerk to our database
 * Uses Clerk's userId as our primary key
 */
export async function syncClerkUser({
  userId,
  db,
  env,
}: WithDb<{
  userId: string;
  env: any;
}>) {
  // Check if user already exists
  const existingUser = await getUserById({ id: userId, db });
  if (existingUser) {
    return { ok: true, user: existingUser } as const;
  }

  // Fetch user from Clerk
  const { createClerkClient } = await import("@clerk/backend");
  const clerk = createClerkClient({ secretKey: env.CLERK_SECRET_KEY });
  
  try {
    const clerkUser = await clerk.users.getUser(userId);
    
    // Create user in our database with Clerk's userId
    const result = await createUser({
      id: userId, // Use Clerk's userId as our primary key
      email: clerkUser.emailAddresses[0]?.emailAddress || "",
      name: `${clerkUser.firstName || ""} ${clerkUser.lastName || ""}`.trim() || clerkUser.username || "User",
      avatarUrl: clerkUser.imageUrl || null,
      db,
    });
    
    return result;
  } catch (error: any) {
    return {
      ok: false,
      errorCode: ErrorCodes.EMAIL_ALREADY_IN_USE,
      error: `Failed to sync Clerk user: ${error.message}`,
    } as const;
  }
}

export async function getUserByEmail({
  email,
  db,
}: WithDb<{ email: string }>) {
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
