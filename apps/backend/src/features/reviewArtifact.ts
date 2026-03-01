import { and, eq, inArray } from "drizzle-orm";
import { WithDb } from "../utils/commonTypes";
import {
  PullRequestInlineCommentTable,
  PullRequestReviewArtifactTable,
  RepositoryInstallationTable,
  RepositoryTable,
} from "./db/schema";

const PullRequestReviewArtifactSelectInfo = {
  insert: {
    id: PullRequestReviewArtifactTable.id,
    repositoryId: PullRequestReviewArtifactTable.repositoryId,
    prNumber: PullRequestReviewArtifactTable.prNumber,
    headSha: PullRequestReviewArtifactTable.headSha,
    prSummary: PullRequestReviewArtifactTable.prSummary,
    confidenceScore: PullRequestReviewArtifactTable.confidenceScore,
    confidenceReason: PullRequestReviewArtifactTable.confidenceReason,
    overallBody: PullRequestReviewArtifactTable.overallBody,
    reviewEvent: PullRequestReviewArtifactTable.reviewEvent,
    postingStatus: PullRequestReviewArtifactTable.postingStatus,
  },
} as const;

const PullRequestInlineCommentSelectInfo = {
  insert: {
    id: PullRequestInlineCommentTable.id,
    reviewArtifactId: PullRequestInlineCommentTable.reviewArtifactId,
    path: PullRequestInlineCommentTable.path,
    title: PullRequestInlineCommentTable.title,
    body: PullRequestInlineCommentTable.body,
    severity: PullRequestInlineCommentTable.severity,
    line: PullRequestInlineCommentTable.line,
    side: PullRequestInlineCommentTable.side,
    startLine: PullRequestInlineCommentTable.startLine,
    startSide: PullRequestInlineCommentTable.startSide,
    subjectType: PullRequestInlineCommentTable.subjectType,
    anchorStatus: PullRequestInlineCommentTable.anchorStatus,
    anchorFailureReason: PullRequestInlineCommentTable.anchorFailureReason,
    githubReviewCommentId: PullRequestInlineCommentTable.githubReviewCommentId,
  },
  fixPrompt: {
    id: PullRequestInlineCommentTable.id,
    reviewArtifactId: PullRequestInlineCommentTable.reviewArtifactId,
    path: PullRequestInlineCommentTable.path,
    title: PullRequestInlineCommentTable.title,
    body: PullRequestInlineCommentTable.body,
    severity: PullRequestInlineCommentTable.severity,
    line: PullRequestInlineCommentTable.line,
    side: PullRequestInlineCommentTable.side,
    startLine: PullRequestInlineCommentTable.startLine,
    startSide: PullRequestInlineCommentTable.startSide,
    subjectType: PullRequestInlineCommentTable.subjectType,
    anchorStatus: PullRequestInlineCommentTable.anchorStatus,
    anchorFailureReason: PullRequestInlineCommentTable.anchorFailureReason,
    githubReviewCommentId: PullRequestInlineCommentTable.githubReviewCommentId,
    artifactId: PullRequestReviewArtifactTable.id,
    repositoryId: PullRequestReviewArtifactTable.repositoryId,
    prNumber: PullRequestReviewArtifactTable.prNumber,
    headSha: PullRequestReviewArtifactTable.headSha,
    prSummary: PullRequestReviewArtifactTable.prSummary,
    confidenceScore: PullRequestReviewArtifactTable.confidenceScore,
    confidenceReason: PullRequestReviewArtifactTable.confidenceReason,
    repositoryFullName: RepositoryTable.fullName,
    repositoryOwner: RepositoryTable.owner,
    repositoryName: RepositoryTable.name,
    installationId: RepositoryTable.installationId,
  },
} as const;

export type PendingInlineCommentArtifact = {
  path: string;
  title: string;
  body: string;
  severity: "error" | "warning" | "info";
  line: number | null;
  side: "LEFT" | "RIGHT" | null;
  startLine: number | null;
  startSide: "LEFT" | "RIGHT" | null;
  subjectType: "line" | "file";
  anchorStatus: "anchored" | "file_level" | "unanchored" | "failed";
  anchorFailureReason: string | null;
};

export type InlineCommentArtifactRecord = {
  id: string;
  reviewArtifactId: string;
  path: string;
  title: string;
  body: string;
  severity: "error" | "warning" | "info";
  line: number | null;
  side: "LEFT" | "RIGHT" | null;
  startLine: number | null;
  startSide: "LEFT" | "RIGHT" | null;
  subjectType: "line" | "file";
  anchorStatus: "anchored" | "file_level" | "unanchored" | "failed";
  anchorFailureReason: string | null;
  githubReviewCommentId: string | null;
};

export async function createReviewArtifact({
  db,
  eventId,
  repositoryId,
  prNumber,
  headSha,
  overallBody,
  prSummary,
  confidenceScore,
  confidenceReason,
  reviewEvent,
}: WithDb<{
  eventId: string;
  repositoryId: string;
  prNumber: string;
  headSha: string;
  overallBody: string;
  prSummary: string;
  confidenceScore: number;
  confidenceReason: string;
  reviewEvent: "COMMENT" | "APPROVE" | "REQUEST_CHANGES";
}>) {
  const insertedArtifacts = await db
    .insert(PullRequestReviewArtifactTable)
    .values({
      eventId,
      repositoryId,
      prNumber,
      headSha,
      overallBody,
      prSummary,
      confidenceScore,
      confidenceReason,
      reviewEvent,
      postingStatus: "pending",
      updatedAt: new Date(),
    })
    .returning(PullRequestReviewArtifactSelectInfo.insert);

  return insertedArtifacts[0];
}

export async function createInlineCommentArtifacts({
  db,
  reviewArtifactId,
  comments,
}: WithDb<{
  reviewArtifactId: string;
  comments: PendingInlineCommentArtifact[];
}>): Promise<InlineCommentArtifactRecord[]> {
  if (comments.length === 0) {
    return [];
  }

  return db
    .insert(PullRequestInlineCommentTable)
    .values(
      comments.map((comment) => ({
        reviewArtifactId,
        path: comment.path,
        title: comment.title,
        body: comment.body,
        severity: comment.severity,
        line: comment.line,
        side: comment.side,
        startLine: comment.startLine,
        startSide: comment.startSide,
        subjectType: comment.subjectType,
        anchorStatus: comment.anchorStatus,
        anchorFailureReason: comment.anchorFailureReason,
        updatedAt: new Date(),
      }))
    )
    .returning(PullRequestInlineCommentSelectInfo.insert);
}

export async function updateReviewArtifactPosting({
  db,
  reviewArtifactId,
  postingStatus,
  githubReviewId,
}: WithDb<{
  reviewArtifactId: string;
  postingStatus: "pending" | "posted" | "partially_posted" | "failed";
  githubReviewId: string | null;
}>) {
  await db
    .update(PullRequestReviewArtifactTable)
    .set({
      postingStatus,
      githubReviewId,
      updatedAt: new Date(),
    })
    .where(eq(PullRequestReviewArtifactTable.id, reviewArtifactId));
}

export async function markInlineCommentPostingFailed({
  db,
  commentIds,
  reason,
}: WithDb<{
  commentIds: string[];
  reason: string;
}>) {
  if (commentIds.length === 0) {
    return;
  }

  await db
    .update(PullRequestInlineCommentTable)
    .set({
      anchorStatus: "failed",
      anchorFailureReason: reason,
      updatedAt: new Date(),
    })
    .where(inArray(PullRequestInlineCommentTable.id, commentIds));
}

export async function markFixPromptGenerated({
  db,
  commentId,
}: WithDb<{
  commentId: string;
}>) {
  await db
    .update(PullRequestInlineCommentTable)
    .set({
      fixPromptStatus: "generated",
      updatedAt: new Date(),
    })
    .where(eq(PullRequestInlineCommentTable.id, commentId));
}

export async function getInlineCommentForUser({
  db,
  commentId,
  userId,
}: WithDb<{
  commentId: string;
  userId: string;
}>) {
  const rows = await db
    .select(PullRequestInlineCommentSelectInfo.fixPrompt)
    .from(PullRequestInlineCommentTable)
    .innerJoin(
      PullRequestReviewArtifactTable,
      eq(PullRequestInlineCommentTable.reviewArtifactId, PullRequestReviewArtifactTable.id)
    )
    .innerJoin(
      RepositoryTable,
      eq(PullRequestReviewArtifactTable.repositoryId, RepositoryTable.id)
    )
    .innerJoin(
      RepositoryInstallationTable,
      eq(RepositoryTable.installationId, RepositoryInstallationTable.installationId)
    )
    .where(
      and(
        eq(PullRequestInlineCommentTable.id, commentId),
        eq(RepositoryInstallationTable.userId, userId),
        eq(RepositoryInstallationTable.isActive, true),
        eq(RepositoryTable.isActive, true)
      )
    )
    .limit(1);

  return rows[0] ?? null;
}
