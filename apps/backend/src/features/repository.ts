import { WithDbAndEnv, WithDb } from "../utils/commonTypes";
import { RepositoryInstallationTable, RepositoryTable } from "./db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { getInstallationRepositories } from "../services/github";
import { RepositoryResponse } from "../types/models";

export async function getInstallationsForUser({
  userId,
  db,
}: WithDb<{ userId: string }>) {
  const installations = await db
    .select()
    .from(RepositoryInstallationTable)
    .where(eq(RepositoryInstallationTable.userId, userId));

  return installations;
}

export async function deleteInstallation({
  installationId,
  userId,
  db,
}: WithDbAndEnv<{
  installationId: string;
  userId: string;
}>) {
  const result = await db
    .delete(RepositoryInstallationTable)
    .where(
      and(
        eq(RepositoryInstallationTable.installationId, installationId),
        eq(RepositoryInstallationTable.userId, userId)
      )
    )
    .returning();

  return result.length > 0;
}

/**
 * Sync repositories from GitHub for a given installation
 */
export async function syncRepositoriesForInstallation({
  db,
  env,
  installationId,
}: WithDbAndEnv<{ installationId: string }>) {
  // Fetch repositories from GitHub
  const githubRepos = await getInstallationRepositories({ env, installationId });

  // Upsert each repository
  const syncedRepos = [];
  for (const repo of githubRepos) {
    const repoData = {
      id: repo.id.toString(),
      installationId,
      name: repo.name,
      fullName: repo.full_name,
      owner: repo.owner.login,
      description: repo.description,
      isPrivate: repo.private ? "true" : "false" as "true" | "false",
      defaultBranch: repo.default_branch,
      htmlUrl: repo.html_url,
      updatedAt: new Date(),
    };

    // Try to insert, or update if already exists
    const existing = await db
      .select()
      .from(RepositoryTable)
      .where(eq(RepositoryTable.id, repoData.id))
      .limit(1);

    if (existing.length > 0) {
      await db
        .update(RepositoryTable)
        .set(repoData)
        .where(eq(RepositoryTable.id, repoData.id));
    } else {
      await db.insert(RepositoryTable).values(repoData);
    }

    syncedRepos.push(repoData);
  }

  return syncedRepos;
}

/**
 * Get repositories for a user across all their installations
 */
export async function getRepositoriesForUser({
  db,
  userId,
}: WithDb<{ userId: string }>): Promise<RepositoryResponse[]> {
  // Get user's installations
  const installations = await getInstallationsForUser({ db, userId });
  const installationIds = installations.map((i: any) => i.installationId);

  if (installationIds.length === 0) {
    return [];
  }

  // Get repositories for all installations
  const repositories = await db
    .select()
    .from(RepositoryTable)
    .where(
      inArray(RepositoryTable.installationId, installationIds)
    );

  // Transform to response format
  return repositories.map((repo: any) => ({
    id: repo.id,
    name: repo.name,
    fullName: repo.fullName,
    owner: repo.owner,
    description: repo.description,
    isPrivate: repo.isPrivate === "true",
    defaultBranch: repo.defaultBranch,
    htmlUrl: repo.htmlUrl,
  }));
}

/**
 * Get repository IDs accessible by a user
 */
export async function getRepositoryIdsForUser({
  db,
  userId,
}: WithDb<{ userId: string }>): Promise<string[]> {
  const installations = await getInstallationsForUser({ db, userId });
  const installationIds = installations.map((i: any) => i.installationId);

  if (installationIds.length === 0) {
    return [];
  }

  const repositories = await db
    .select({ id: RepositoryTable.id })
    .from(RepositoryTable)
    .where(
      inArray(RepositoryTable.installationId, installationIds)
    );

  return repositories.map((r: any) => r.id);
}
