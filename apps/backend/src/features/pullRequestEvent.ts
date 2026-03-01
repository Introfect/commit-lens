import { WithDbAndEnv } from "../utils/commonTypes";
import { RepositoryTable, PullRequestEventTable } from "./db/schema";
import { eq, and, inArray, desc } from "drizzle-orm";
import { PullRequestEventResponse } from "../types/models";
import { GitHubPullRequestWebhook } from "../types/github";

const RepositorySelectInfo = {
  info: {
    id: RepositoryTable.id,
    installationId: RepositoryTable.installationId,
    name: RepositoryTable.name,
    fullName: RepositoryTable.fullName,
    owner: RepositoryTable.owner,
    description: RepositoryTable.description,
    isPrivate: RepositoryTable.isPrivate,
    defaultBranch: RepositoryTable.defaultBranch,
    htmlUrl: RepositoryTable.htmlUrl,
  },
} as const;

const PullRequestEventSelectInfo = {
  info: {
    id: PullRequestEventTable.id,
    repositoryId: PullRequestEventTable.repositoryId,
    prNumber: PullRequestEventTable.prNumber,
    action: PullRequestEventTable.action,
    title: PullRequestEventTable.title,
    body: PullRequestEventTable.body,
    author: PullRequestEventTable.author,
    authorAvatarUrl: PullRequestEventTable.authorAvatarUrl,
    baseBranch: PullRequestEventTable.baseBranch,
    headBranch: PullRequestEventTable.headBranch,
    headSha: PullRequestEventTable.headSha,
    state: PullRequestEventTable.state,
    merged: PullRequestEventTable.merged,
    htmlUrl: PullRequestEventTable.htmlUrl,
    createdAt: PullRequestEventTable.createdAt,
    updatedAt: PullRequestEventTable.updatedAt,
    receivedAt: PullRequestEventTable.receivedAt,
    reviewStatus: PullRequestEventTable.reviewStatus,
  },
} as const;

/**
 * Create a pull request event from a GitHub webhook
 */
export async function createPullRequestEvent({
  db,
  env,
  webhook,
  repositoryId,
}: WithDbAndEnv<{
  webhook: GitHubPullRequestWebhook;
  repositoryId: string;
}>) {
  const pr = webhook.pull_request;

  const existingEvents = await db
    .select(PullRequestEventSelectInfo.info)
    .from(PullRequestEventTable)
    .where(
      and(
        eq(PullRequestEventTable.repositoryId, repositoryId),
        eq(PullRequestEventTable.prNumber, pr.number.toString()),
        eq(PullRequestEventTable.headSha, pr.head.sha)
      )
    )
    .limit(1);

  if (existingEvents.length > 0) {
    const updatedEvents = await db
      .update(PullRequestEventTable)
      .set({
        action: webhook.action,
        title: pr.title,
        body: pr.body,
        author: pr.user.login,
        authorAvatarUrl: pr.user.avatar_url,
        baseBranch: pr.base.ref,
        headBranch: pr.head.ref,
        state: pr.state,
        merged: pr.merged ? "true" : "false",
        htmlUrl: pr.html_url,
        updatedAt: new Date(pr.updated_at),
        receivedAt: new Date(),
        reviewStatus: "reviewing",
      })
      .where(eq(PullRequestEventTable.id, existingEvents[0].id))
      .returning();

    return updatedEvents[0];
  }

  const eventData = {
    repositoryId,
    prNumber: pr.number.toString(),
    action: webhook.action,
    title: pr.title,
    body: pr.body,
    author: pr.user.login,
    authorAvatarUrl: pr.user.avatar_url,
    baseBranch: pr.base.ref,
    headBranch: pr.head.ref,
    headSha: pr.head.sha,
    state: pr.state,
    merged: pr.merged ? "true" : "false" as "true" | "false",
    htmlUrl: pr.html_url,
    createdAt: new Date(pr.created_at),
    updatedAt: new Date(pr.updated_at),
    reviewStatus: "reviewing" as const,
  };

  const result = await db.insert(PullRequestEventTable).values(eventData).returning();
  return result[0];
}

/**
 * Get pull request events for a user's repositories
 */
export async function getPullRequestEventsForUser({
  db,
  env,
  repositoryIds,
  limit = 50,
}: WithDbAndEnv<{
  repositoryIds: string[];
  limit?: number;
}>): Promise<PullRequestEventResponse[]> {
  if (repositoryIds.length === 0) {
    return [];
  }

  // Fetch events
  const events = await db
    .select(PullRequestEventSelectInfo.info)
    .from(PullRequestEventTable)
    .where(inArray(PullRequestEventTable.repositoryId, repositoryIds))
    .orderBy(desc(PullRequestEventTable.receivedAt))
    .limit(limit);

  if (events.length === 0) {
    return [];
  }

  // Fetch repositories
  const uniqueRepoIds = [...new Set(events.map((event) => event.repositoryId))];
  const repositories = await db
    .select(RepositorySelectInfo.info)
    .from(RepositoryTable)
    .where(inArray(RepositoryTable.id, uniqueRepoIds));

  // Create a map for quick lookup
  const repoMap = new Map(repositories.map((repository) => [repository.id, repository] as const));

  // Transform to response format
  return events.map((event) => {
    const repo = repoMap.get(event.repositoryId);

    if (!repo) {
      return {
        id: event.id,
        repository: {
          id: event.repositoryId,
          installationId: "",
          name: "Unknown repository",
          fullName: "Unknown repository",
          owner: "unknown",
          description: null,
          isPrivate: false,
          defaultBranch: null,
          htmlUrl: "",
        },
        prNumber: parseInt(event.prNumber, 10),
        action: event.action,
        title: event.title,
        body: event.body,
        author: {
          username: event.author,
          avatarUrl: event.authorAvatarUrl,
        },
        baseBranch: event.baseBranch,
        headBranch: event.headBranch,
        headSha: event.headSha,
        state: event.state,
        merged: event.merged === "true",
        htmlUrl: event.htmlUrl,
        createdAt: event.createdAt.toISOString(),
        updatedAt: event.updatedAt.toISOString(),
        receivedAt: event.receivedAt.toISOString(),
        reviewStatus: event.reviewStatus,
      };
    }

    return {
      id: event.id,
      repository: {
        id: repo.id,
        installationId: repo.installationId,
        name: repo.name,
        fullName: repo.fullName,
        owner: repo.owner,
        description: repo.description,
        isPrivate: repo.isPrivate === "true",
        defaultBranch: repo.defaultBranch,
        htmlUrl: repo.htmlUrl,
      },
      prNumber: parseInt(event.prNumber),
      action: event.action,
      title: event.title,
      body: event.body,
      author: {
        username: event.author,
        avatarUrl: event.authorAvatarUrl,
      },
      baseBranch: event.baseBranch,
      headBranch: event.headBranch,
      headSha: event.headSha,
      state: event.state,
      merged: event.merged === "true",
      htmlUrl: event.htmlUrl,
      createdAt: event.createdAt.toISOString(),
      updatedAt: event.updatedAt.toISOString(),
      receivedAt: event.receivedAt.toISOString(),
      reviewStatus: event.reviewStatus,
    };
  });
}

/**
 * Get a pull request event by repository and PR number
 */
export async function getPullRequestEvent({
  db,
  repositoryId,
  prNumber,
}: WithDbAndEnv<{
  repositoryId: string;
  prNumber: string;
}>) {
  const events = await db
    .select(PullRequestEventSelectInfo.info)
    .from(PullRequestEventTable)
    .where(
      and(
        eq(PullRequestEventTable.repositoryId, repositoryId),
        eq(PullRequestEventTable.prNumber, prNumber)
      )
    )
    .orderBy(desc(PullRequestEventTable.receivedAt))
    .limit(1);

  return events[0] || null;
}
