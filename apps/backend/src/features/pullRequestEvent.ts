import { WithDbAndEnv } from "../utils/commonTypes";
import { RepositoryTable, PullRequestEventTable } from "./db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { PullRequestEvent, PullRequestEventResponse, RepositoryResponse } from "../types/models";
import { GitHubPullRequestWebhook } from "../types/github";

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
    .select()
    .from(PullRequestEventTable)
    .where(inArray(PullRequestEventTable.repositoryId, repositoryIds))
    .orderBy(PullRequestEventTable.receivedAt)
    .limit(limit);

  // Fetch repositories
  const uniqueRepoIds = [...new Set(events.map((e: any) => e.repositoryId))];
  const repositories = await db
    .select()
    .from(RepositoryTable)
    .where(inArray(RepositoryTable.id, uniqueRepoIds));

  // Create a map for quick lookup
  const repoMap = new Map(repositories.map((r: any) => [r.id, r]));

  // Transform to response format
  return events.map((event: any) => {
    const repo: any = repoMap.get(event.repositoryId);
    if (!repo) {
      throw new Error(`Repository ${event.repositoryId} not found`);
    }

    return {
      id: event.id,
      repository: {
        id: repo.id,
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
    .select()
    .from(PullRequestEventTable)
    .where(
      and(
        eq(PullRequestEventTable.repositoryId, repositoryId),
        eq(PullRequestEventTable.prNumber, prNumber)
      )
    )
    .orderBy(PullRequestEventTable.receivedAt)
    .limit(1);

  return events[0] || null;
}
