import { and, desc, eq, inArray } from "drizzle-orm";
import { getInstallationRepositories } from "../services/github";
import { type RepositoryResponse } from "../types/models";
import { type Result } from "../utils/error";
import { type WithDb, type WithDbAndEnv } from "../utils/commonTypes";
import {
  PullRequestEventTable,
  RepositoryInstallationTable,
  RepositoryTable,
} from "./db/schema";

const RepositoryInstallationSelectInfo = {
  info: {
    installationId: RepositoryInstallationTable.installationId,
    userId: RepositoryInstallationTable.userId,
    accountLogin: RepositoryInstallationTable.accountLogin,
    accountAvatarUrl: RepositoryInstallationTable.accountAvatarUrl,
    isActive: RepositoryInstallationTable.isActive,
    createdAt: RepositoryInstallationTable.createdAt,
  },
} as const;

const RepositorySelectInfo = {
  info: {
    id: RepositoryTable.id,
    installationId: RepositoryTable.installationId,
    name: RepositoryTable.name,
    fullName: RepositoryTable.fullName,
    owner: RepositoryTable.owner,
    description: RepositoryTable.description,
    isPrivate: RepositoryTable.isPrivate,
    isActive: RepositoryTable.isActive,
    isRemovedFromWorkspace: RepositoryTable.isRemovedFromWorkspace,
    defaultBranch: RepositoryTable.defaultBranch,
    htmlUrl: RepositoryTable.htmlUrl,
    updatedAt: RepositoryTable.updatedAt,
  },
  ownership: {
    id: RepositoryTable.id,
    installationId: RepositoryTable.installationId,
  },
} as const;

export type InstallationSummary = {
  installationId: string;
  userId: string;
  accountLogin: string;
  accountAvatarUrl: string | null;
  isActive: boolean;
  createdAt: Date;
};

export type RepositorySyncMode = "background" | "user_manage";

export type RepositorySyncSummary = {
  syncedRepositories: Array<{
    id: string;
    installationId: string;
    name: string;
    fullName: string;
    owner: string;
    description: string | null;
    isPrivate: "true" | "false";
    defaultBranch: string;
    htmlUrl: string;
    updatedAt: Date;
  }>;
  addedCount: number;
  restoredCount: number;
  deactivatedCount: number;
  hiddenCount: number;
};

export async function getInstallationsForUser({
  userId,
  db,
  includeInactive = false,
}: WithDb<{
  userId: string;
  includeInactive?: boolean;
}>): Promise<InstallationSummary[]> {
  const installations = await db
    .select(RepositoryInstallationSelectInfo.info)
    .from(RepositoryInstallationTable)
    .where(
      includeInactive
        ? eq(RepositoryInstallationTable.userId, userId)
        : and(
            eq(RepositoryInstallationTable.userId, userId),
            eq(RepositoryInstallationTable.isActive, true)
          )
    )
    .orderBy(desc(RepositoryInstallationTable.createdAt));

  return installations;
}

export async function getPrimaryInstallationForUser({
  userId,
  db,
}: WithDb<{
  userId: string;
}>): Promise<InstallationSummary | null> {
  const activeInstallations = await getInstallationsForUser({
    userId,
    db,
  });

  if (activeInstallations.length > 0) {
    return activeInstallations[0];
  }

  const knownInstallations = await getInstallationsForUser({
    userId,
    db,
    includeInactive: true,
  });

  return knownInstallations[0] ?? null;
}

export async function removeRepositoryFromWorkspace({
  repositoryId,
  userId,
  db,
}: WithDb<{
  repositoryId: string;
  userId: string;
}>): Promise<boolean> {
  const repositories = await db
    .select(RepositorySelectInfo.ownership)
    .from(RepositoryTable)
    .innerJoin(
      RepositoryInstallationTable,
      eq(RepositoryTable.installationId, RepositoryInstallationTable.installationId)
    )
    .where(
      and(
        eq(RepositoryTable.id, repositoryId),
        eq(RepositoryInstallationTable.userId, userId),
        eq(RepositoryInstallationTable.isActive, true)
      )
    )
    .limit(1);

  if (repositories.length === 0) {
    return false;
  }

  await db.transaction(async (tx) => {
    await tx
      .update(RepositoryTable)
      .set({
        isRemovedFromWorkspace: true,
        updatedAt: new Date(),
      })
      .where(eq(RepositoryTable.id, repositoryId));

    await tx
      .update(PullRequestEventTable)
      .set({ isActive: false })
      .where(eq(PullRequestEventTable.repositoryId, repositoryId));
  });

  return true;
}

export async function disconnectInstallation({
  installationId,
  userId,
  db,
}: WithDb<{
  installationId: string;
  userId: string;
}>): Promise<boolean> {
  const result = await db.transaction(async (tx) => {
    const installation = await tx
      .select({ installationId: RepositoryInstallationTable.installationId })
      .from(RepositoryInstallationTable)
      .where(
        and(
          eq(RepositoryInstallationTable.installationId, installationId),
          eq(RepositoryInstallationTable.userId, userId)
        )
      )
      .limit(1);

    if (installation.length === 0) {
      return [];
    }

    const repositories = await tx
      .select({ id: RepositoryTable.id })
      .from(RepositoryTable)
      .where(eq(RepositoryTable.installationId, installationId));

    const repositoryIds = repositories.map((repository) => repository.id);

    if (repositoryIds.length > 0) {
      await tx
        .update(PullRequestEventTable)
        .set({ isActive: false })
        .where(inArray(PullRequestEventTable.repositoryId, repositoryIds));

      await tx
        .update(RepositoryTable)
        .set({ isActive: false, updatedAt: new Date() })
        .where(eq(RepositoryTable.installationId, installationId));
    }

    return tx
      .update(RepositoryInstallationTable)
      .set({ isActive: false })
      .where(
        and(
          eq(RepositoryInstallationTable.installationId, installationId),
          eq(RepositoryInstallationTable.userId, userId)
        )
      )
      .returning({ installationId: RepositoryInstallationTable.installationId });
  });

  return result.length > 0;
}

export async function syncRepositoriesForInstallation({
  db,
  env,
  installationId,
  mode = "background",
}: WithDbAndEnv<{
  installationId: string;
  mode?: RepositorySyncMode;
}>): Promise<Result<RepositorySyncSummary>> {
  const githubReposResult = await getInstallationRepositories({ env, installationId });

  if (!githubReposResult.ok) {
    return githubReposResult;
  }

  const existingRepositories = await db
    .select(RepositorySelectInfo.info)
    .from(RepositoryTable)
    .where(eq(RepositoryTable.installationId, installationId));

  const existingRepositoriesById = new Map(
    existingRepositories.map((repository) => [repository.id, repository] as const)
  );

  const syncedRepositories: RepositorySyncSummary["syncedRepositories"] = [];
  let addedCount = 0;
  let restoredCount = 0;
  let hiddenCount = 0;
  const restoredRepositoryIds: string[] = [];

  for (const repo of githubReposResult.data) {
    const repositoryId = repo.id.toString();
    const existingRepository = existingRepositoriesById.get(repositoryId) ?? null;
    const nextIsRemovedFromWorkspace =
      mode === "user_manage"
        ? false
        : existingRepository?.isRemovedFromWorkspace ?? false;
    const repoData = {
      id: repositoryId,
      installationId,
      name: repo.name,
      fullName: repo.full_name,
      owner: repo.owner.login,
      description: repo.description,
      isPrivate: (repo.private ? "true" : "false") as "true" | "false",
      isActive: true,
      isRemovedFromWorkspace: nextIsRemovedFromWorkspace,
      defaultBranch: repo.default_branch,
      htmlUrl: repo.html_url,
      updatedAt: new Date(),
    };

    if (existingRepository) {
      const wasVisible =
        existingRepository.isActive && !existingRepository.isRemovedFromWorkspace;
      const isVisible = repoData.isActive && !repoData.isRemovedFromWorkspace;

      await db
        .update(RepositoryTable)
        .set(repoData)
        .where(eq(RepositoryTable.id, repositoryId));

      if (!wasVisible && isVisible) {
        restoredCount += 1;
        restoredRepositoryIds.push(repositoryId);
      }

      if (!isVisible) {
        hiddenCount += 1;
      }
    } else {
      await db.insert(RepositoryTable).values(repoData);
      addedCount += 1;
    }

    syncedRepositories.push({
      id: repoData.id,
      installationId: repoData.installationId,
      name: repoData.name,
      fullName: repoData.fullName,
      owner: repoData.owner,
      description: repoData.description,
      isPrivate: repoData.isPrivate,
      defaultBranch: repoData.defaultBranch,
      htmlUrl: repoData.htmlUrl,
      updatedAt: repoData.updatedAt,
    });
  }

  const syncedRepositoryIds = syncedRepositories.map((repository) => repository.id);
  const repositoriesToDeactivate = existingRepositories
    .filter((repository) => !syncedRepositoryIds.includes(repository.id))
    .map((repository) => repository.id);

  if (repositoriesToDeactivate.length > 0) {
    await db
      .update(RepositoryTable)
      .set({
        isActive: false,
        updatedAt: new Date(),
      })
      .where(inArray(RepositoryTable.id, repositoriesToDeactivate));

    await db
      .update(PullRequestEventTable)
      .set({ isActive: false })
      .where(inArray(PullRequestEventTable.repositoryId, repositoriesToDeactivate));
  }

  if (restoredRepositoryIds.length > 0) {
    await db
      .update(PullRequestEventTable)
      .set({ isActive: true })
      .where(inArray(PullRequestEventTable.repositoryId, restoredRepositoryIds));
  }

  return {
    ok: true,
    data: {
      syncedRepositories,
      addedCount,
      restoredCount,
      deactivatedCount: repositoriesToDeactivate.length,
      hiddenCount,
    },
  } as const;
}

export async function getRepositoriesForUser({
  db,
  userId,
}: WithDb<{
  userId: string;
}>): Promise<RepositoryResponse[]> {
  const installations = await getInstallationsForUser({ db, userId });
  const installationIds = installations.map((installation) => installation.installationId);

  if (installationIds.length === 0) {
    return [];
  }

  const repositories = await db
    .select(RepositorySelectInfo.info)
    .from(RepositoryTable)
    .where(
      and(
        inArray(RepositoryTable.installationId, installationIds),
        eq(RepositoryTable.isActive, true),
        eq(RepositoryTable.isRemovedFromWorkspace, false)
      )
    )
    .orderBy(desc(RepositoryTable.updatedAt));

  return repositories.map((repo) => ({
    id: repo.id,
    installationId: repo.installationId,
    name: repo.name,
    fullName: repo.fullName,
    owner: repo.owner,
    description: repo.description,
    isPrivate: repo.isPrivate === "true",
    defaultBranch: repo.defaultBranch,
    htmlUrl: repo.htmlUrl,
  }));
}

export async function getRepositoryIdsForUser({
  db,
  userId,
}: WithDb<{
  userId: string;
}>): Promise<string[]> {
  const installations = await getInstallationsForUser({ db, userId });
  const installationIds = installations.map((installation) => installation.installationId);

  if (installationIds.length === 0) {
    return [];
  }

  const repositories = await db
    .select({ id: RepositoryTable.id })
    .from(RepositoryTable)
    .where(
      and(
        inArray(RepositoryTable.installationId, installationIds),
        eq(RepositoryTable.isActive, true),
        eq(RepositoryTable.isRemovedFromWorkspace, false)
      )
    );

  return repositories.map((repository) => repository.id);
}
