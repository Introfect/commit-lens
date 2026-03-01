import { and, eq } from "drizzle-orm";
import {
  FixPromptRequest,
  PRReviewResponse,
  generateFixPrompt,
  reviewPullRequest,
} from "../services/gemini";
import {
  fetchPullRequestDetails,
  fetchPullRequestFiles,
  postPullRequestReview,
} from "../services/github";
import { ErrorCodes, Result, getErrorMessage } from "../utils/error";
import { createLogger, Logger, generateCorrelationId } from "../utils/logger";
import { resolveInlineCommentAnchor, parsePullRequestFileAnchors } from "../utils/diffParser";
import { WithDb, WithDbAndEnv } from "../utils/commonTypes";
import { buildFocusedProjectContext, formatProjectContextForPrompt } from "./prContext";
import {
  createInlineCommentArtifacts,
  createReviewArtifact,
  getInlineCommentForUser,
  markFixPromptGenerated,
  markInlineCommentPostingFailed,
  PendingInlineCommentArtifact,
  updateReviewArtifactPosting,
} from "./reviewArtifact";
import { PullRequestEventTable, RepositoryTable } from "./db/schema";
import { sendToQueue } from "../services/queue";
import { fetchRepositoryTextContent } from "../services/github";

const RepositorySelectInfo = {
  review: {
    id: RepositoryTable.id,
    installationId: RepositoryTable.installationId,
    name: RepositoryTable.name,
    fullName: RepositoryTable.fullName,
    owner: RepositoryTable.owner,
    defaultBranch: RepositoryTable.defaultBranch,
    isActive: RepositoryTable.isActive,
  },
} as const;

const PullRequestEventSelectInfo = {
  review: {
    id: PullRequestEventTable.id,
    title: PullRequestEventTable.title,
    body: PullRequestEventTable.body,
    headSha: PullRequestEventTable.headSha,
  },
} as const;

export type PRReviewJobData = {
  repositoryId: string;
  prNumber: string;
  eventId: string;
};

type ReviewResult = Result<null>;

type GitHubReviewCommentDraft = {
  commentId: string;
  path: string;
  body: string;
  line: number;
  side: "LEFT" | "RIGHT";
  startLine?: number;
  startSide?: "LEFT" | "RIGHT";
};

function selectReviewEvent(review: PRReviewResponse): "COMMENT" | "APPROVE" | "REQUEST_CHANGES" {
  const hasBlockingInlineComments = review.inlineComments.some(
    (comment) => comment.severity === "error" || comment.severity === "warning"
  );

  if (hasBlockingInlineComments || review.generalFeedback.risks.length > 0) {
    return "REQUEST_CHANGES";
  }

  return "COMMENT";
}

function buildFrontendCommentUrl(env: Env, reviewArtifactId: string, commentId: string): string {
  const url = new URL(env.FRONTEND_URL);
  url.pathname = `/dashboard/reviews/${reviewArtifactId}/comments/${commentId}/fix`;
  return url.toString();
}

function buildOverallReviewBody(review: PRReviewResponse): string {
  let body = `## Summary\n${review.prSummary}\n\n`;
  body += `## Confidence\n**${review.confidenceScore}/10**\n${review.confidenceReason}\n\n`;

  if (review.generalFeedback.strengths.length > 0) {
    body += `## Strengths\n`;
    for (const strength of review.generalFeedback.strengths) {
      body += `- ${strength}\n`;
    }
    body += `\n`;
  }

  if (review.generalFeedback.risks.length > 0) {
    body += `## Risks\n`;
    for (const risk of review.generalFeedback.risks) {
      body += `- ${risk}\n`;
    }
    body += `\n`;
  }

  if (review.generalFeedback.recommendations.length > 0) {
    body += `## Recommendations\n`;
    for (const recommendation of review.generalFeedback.recommendations) {
      body += `- ${recommendation}\n`;
    }
    body += `\n`;
  }

  body += `---\nAI-powered review. Validate the feedback and test changes carefully.`;
  return body;
}

function prepareInlineCommentArtifacts({
  review,
  parsedFiles,
  logger,
}: {
  review: PRReviewResponse;
  parsedFiles: ReturnType<typeof parsePullRequestFileAnchors>;
  logger: Logger;
}): PendingInlineCommentArtifact[] {
  return review.inlineComments.map((comment) => {
    const anchor = resolveInlineCommentAnchor({
      parsedFiles,
      filePath: comment.file,
      line: comment.line,
      side: comment.side,
      startLine: comment.startLine,
      startSide: comment.startSide,
    });

    if (!anchor) {
      logger.debug("Inline comment could not be anchored", {
        file: comment.file,
        line: comment.line,
        side: comment.side,
      });

      return {
        path: comment.file,
        title: comment.title,
        body: comment.body,
        severity: comment.severity,
        line: comment.line,
        side: comment.side,
        startLine: comment.startLine ?? null,
        startSide: comment.startSide ?? null,
        subjectType: "line",
        anchorStatus: "unanchored",
        anchorFailureReason: "Line could not be matched to a changed patch line.",
      };
    }

    return {
      path: anchor.path,
      title: comment.title,
      body: comment.body,
      severity: comment.severity,
      line: anchor.line,
      side: anchor.side,
      startLine: anchor.startLine ?? null,
      startSide: anchor.startSide ?? null,
      subjectType: "line",
      anchorStatus: "anchored",
      anchorFailureReason: null,
    };
  });
}

function buildGitHubReviewCommentBody({
  env,
  reviewArtifactId,
  commentId,
  severity,
  title,
  body,
}: {
  env: Env;
  reviewArtifactId: string;
  commentId: string;
  severity: "error" | "warning" | "info";
  title: string;
  body: string;
}): string {
  const fixPromptUrl = buildFrontendCommentUrl(env, reviewArtifactId, commentId);

  return [
    `**${severity.toUpperCase()}**`,
    title,
    "",
    body,
    "",
    `[Generate Prompt to Fix This](${fixPromptUrl})`,
  ].join("\n");
}

function buildGitHubReviewCommentDrafts({
  env,
  reviewArtifactId,
  comments,
}: {
  env: Env;
  reviewArtifactId: string;
  comments: Awaited<ReturnType<typeof createInlineCommentArtifacts>>;
}): GitHubReviewCommentDraft[] {
  return comments.flatMap((comment) => {
    if (comment.anchorStatus !== "anchored" || comment.line === null || comment.side === null) {
      return [];
    }

    return [
      {
        commentId: comment.id,
        path: comment.path,
        body: buildGitHubReviewCommentBody({
          env,
          reviewArtifactId,
          commentId: comment.id,
          severity: comment.severity,
          title: comment.title,
          body: comment.body,
        }),
        line: comment.line,
        side: comment.side,
        startLine: comment.startLine ?? undefined,
        startSide: comment.startSide ?? undefined,
      },
    ];
  });
}

async function markReviewStatus({
  db,
  eventId,
  reviewStatus,
}: WithDb<{
  eventId: string;
  reviewStatus: "reviewing" | "reviewed" | "failed";
}>): Promise<void> {
  await db
    .update(PullRequestEventTable)
    .set({ reviewStatus })
    .where(eq(PullRequestEventTable.id, eventId));
}

export async function queuePullRequestReview({
  db,
  env,
  repositoryId,
  prNumber,
  eventId,
}: WithDbAndEnv<{
  repositoryId: string;
  prNumber: string;
  eventId: string;
}>): Promise<Result<{ correlationId: string }>> {
  const correlationId = generateCorrelationId();
  const logger = createLogger({
    correlationId,
    operation: "queue_pr_review",
    repositoryId,
    prNumber,
    eventId,
  });

  try {
    await sendToQueue(
      env,
      "pr_review",
      {
        repositoryId,
        prNumber,
        eventId,
        correlationId,
      },
      logger
    );
  } catch (error) {
    logger.error("Failed to queue PR review job", error instanceof Error ? error : null);
    return {
      ok: false,
      errorCode: ErrorCodes.PR_REVIEW_QUEUE_FAILED,
      error: getErrorMessage(error instanceof Error ? error : null),
    } as const;
  }

  return {
    ok: true,
    data: { correlationId },
  } as const;
}

export async function performPullRequestReview({
  db,
  env,
  repositoryId,
  prNumber,
  eventId,
}: WithDbAndEnv<{
  repositoryId: string;
  prNumber: string;
  eventId: string;
}>): Promise<ReviewResult> {
  const logger = createLogger({
    correlationId: generateCorrelationId(),
    operation: "pr_review",
    repositoryId,
    prNumber,
    eventId,
  });

  return performPullRequestReviewInternal({ db, env, repositoryId, prNumber, eventId }, logger);
}

export async function performPullRequestReviewInternal(
  params: WithDbAndEnv<{
    repositoryId: string;
    prNumber: string;
    eventId: string;
  }>,
  logger: Logger
): Promise<ReviewResult> {
  const { db, env, repositoryId, prNumber, eventId } = params;

  try {
    const [repositories, prEvents] = await Promise.all([
      db
        .select(RepositorySelectInfo.review)
        .from(RepositoryTable)
        .where(and(eq(RepositoryTable.id, repositoryId), eq(RepositoryTable.isActive, true)))
        .limit(1),
      db
        .select(PullRequestEventSelectInfo.review)
        .from(PullRequestEventTable)
        .where(eq(PullRequestEventTable.id, eventId))
        .limit(1),
    ]);

    if (repositories.length === 0) {
      await markReviewStatus({ db, eventId, reviewStatus: "failed" });
      return {
        ok: false,
        errorCode: ErrorCodes.REPOSITORY_NOT_FOUND,
        error: "Repository not found",
      } as const;
    }

    if (prEvents.length === 0) {
      return {
        ok: false,
        errorCode: ErrorCodes.PR_EVENT_NOT_FOUND,
        error: "PR event not found",
      } as const;
    }

    const repository = repositories[0];
    const prEvent = prEvents[0];

    await markReviewStatus({ db, eventId, reviewStatus: "reviewing" });

    const [pullRequestDetailsResult, pullRequestFilesResult] = await Promise.all([
      fetchPullRequestDetails({
        env,
        installationId: repository.installationId,
        owner: repository.owner,
        repo: repository.name,
        prNumber,
      }),
      fetchPullRequestFiles({
        env,
        installationId: repository.installationId,
        owner: repository.owner,
        repo: repository.name,
        prNumber,
      }),
    ]);

    if (!pullRequestDetailsResult.ok) {
      await markReviewStatus({ db, eventId, reviewStatus: "failed" });
      return pullRequestDetailsResult;
    }

    if (!pullRequestFilesResult.ok) {
      await markReviewStatus({ db, eventId, reviewStatus: "failed" });
      return pullRequestFilesResult;
    }

    const pullRequestDetails = pullRequestDetailsResult.data;
    const pullRequestFiles = pullRequestFilesResult.data;
    const focusedProjectContext = await buildFocusedProjectContext({
      env,
      installationId: repository.installationId,
      owner: repository.owner,
      repo: repository.name,
      ref: pullRequestDetails.head.sha,
      changedFiles: pullRequestFiles,
    });

    const reviewResult = await reviewPullRequest({
      env,
      prData: {
        title: pullRequestDetails.title,
        description: pullRequestDetails.body ?? prEvent.body ?? undefined,
        projectContext: formatProjectContextForPrompt(focusedProjectContext.documents),
        changedFiles: pullRequestFiles.map((file) => ({
          path: file.filename,
          status: file.status,
          patch: file.patch ?? null,
        })),
      },
    });

    if (!reviewResult.ok) {
      await markReviewStatus({ db, eventId, reviewStatus: "failed" });
      return reviewResult;
    }

    const review = reviewResult.data;
    const reviewEvent = selectReviewEvent(review);
    const overallBody = buildOverallReviewBody(review);
    const parsedFiles = parsePullRequestFileAnchors(pullRequestFiles);
    const preparedComments = prepareInlineCommentArtifacts({
      review,
      parsedFiles,
      logger,
    });

    const reviewArtifact = await createReviewArtifact({
      db,
      eventId,
      repositoryId: repository.id,
      prNumber,
      headSha: pullRequestDetails.head.sha,
      overallBody,
      prSummary: review.prSummary,
      confidenceScore: review.confidenceScore,
      confidenceReason: review.confidenceReason,
      reviewEvent,
    });

    const insertedComments = await createInlineCommentArtifacts({
      db,
      reviewArtifactId: reviewArtifact.id,
      comments: preparedComments,
    });
    const githubCommentDrafts = buildGitHubReviewCommentDrafts({
      env,
      reviewArtifactId: reviewArtifact.id,
      comments: insertedComments,
    });
    const anchoredCommentIds = githubCommentDrafts.map((comment) => comment.commentId);

    let reviewPostResult = await postPullRequestReview({
      env,
      installationId: repository.installationId,
      owner: repository.owner,
      repo: repository.name,
      prNumber,
      reviewData: {
        commitId: pullRequestDetails.head.sha,
        body: overallBody,
        event: reviewEvent,
        comments: githubCommentDrafts.map((comment) => ({
          path: comment.path,
          body: comment.body,
          line: comment.line,
          side: comment.side,
          startLine: comment.startLine,
          startSide: comment.startSide,
        })),
      },
    });

    let postingStatus: "posted" | "partially_posted" | "failed" = "posted";

    if (!reviewPostResult.ok && githubCommentDrafts.length > 0) {
      logger.warn("Inline review comment submission failed, retrying with summary only", {
        error: reviewPostResult.error,
      });
      await markInlineCommentPostingFailed({
        db,
        commentIds: anchoredCommentIds,
        reason: reviewPostResult.error,
      });

      reviewPostResult = await postPullRequestReview({
        env,
        installationId: repository.installationId,
        owner: repository.owner,
        repo: repository.name,
        prNumber,
        reviewData: {
          commitId: pullRequestDetails.head.sha,
          body: overallBody,
          event: reviewEvent,
        },
      });
      postingStatus = "partially_posted";
    }

    if (!reviewPostResult.ok) {
      await updateReviewArtifactPosting({
        db,
        reviewArtifactId: reviewArtifact.id,
        postingStatus: "failed",
        githubReviewId: null,
      });
      await markReviewStatus({ db, eventId, reviewStatus: "failed" });
      return reviewPostResult;
    }

    if (
      postingStatus === "posted" &&
      insertedComments.some((comment) => comment.anchorStatus !== "anchored")
    ) {
      postingStatus = "partially_posted";
    }

    await updateReviewArtifactPosting({
      db,
      reviewArtifactId: reviewArtifact.id,
      postingStatus,
      githubReviewId: reviewPostResult.data.reviewId,
    });
    await markReviewStatus({ db, eventId, reviewStatus: "reviewed" });

    return {
      ok: true,
      data: null,
    } as const;
  } catch (error) {
    logger.error("PR review failed", error instanceof Error ? error : null);
    await markReviewStatus({ db, eventId, reviewStatus: "failed" });
    return {
      ok: false,
      errorCode: ErrorCodes.PR_REVIEW_FAILED,
      error: getErrorMessage(error instanceof Error ? error : null),
    } as const;
  }
}

export async function createFixPromptForInlineComment({
  db,
  env,
  commentId,
  userId,
}: WithDbAndEnv<{
  commentId: string;
  userId: string;
}>): Promise<Result<{
  commentId: string;
  reviewArtifactId: string;
  repositoryFullName: string;
  prNumber: number;
  prSummary: string;
  confidenceScore: number;
  confidenceReason: string;
  prompt: string;
  copiedHint: string;
  comment: {
    id: string;
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
}>> {
  const inlineComment = await getInlineCommentForUser({
    db,
    commentId,
    userId,
  });

  if (!inlineComment) {
    return {
      ok: false,
      errorCode: ErrorCodes.PR_REVIEW_COMMENT_NOT_FOUND,
      error: "Review comment not found",
    } as const;
  }

  const focusedProjectContext = await buildFocusedProjectContext({
    env,
    installationId: inlineComment.installationId,
    owner: inlineComment.repositoryOwner,
    repo: inlineComment.repositoryName,
    ref: inlineComment.headSha,
    changedFiles: [],
  });
  const fileContextResult = await fetchRepositoryTextContent({
    env,
    installationId: inlineComment.installationId,
    owner: inlineComment.repositoryOwner,
    repo: inlineComment.repositoryName,
    path: inlineComment.path,
    ref: inlineComment.headSha,
  });

  const fixPromptRequest: FixPromptRequest = {
    repositoryFullName: inlineComment.repositoryFullName,
    prNumber: inlineComment.prNumber,
    prSummary: inlineComment.prSummary,
    confidenceScore: inlineComment.confidenceScore,
    confidenceReason: inlineComment.confidenceReason,
    comment: {
      path: inlineComment.path,
      title: inlineComment.title,
      body: inlineComment.body,
      severity: inlineComment.severity,
      line: inlineComment.line,
      side: inlineComment.side,
    },
    projectContext: formatProjectContextForPrompt(focusedProjectContext.documents),
    fileContext: fileContextResult.ok ? fileContextResult.data : null,
  };

  const promptResult = await generateFixPrompt({
    env,
    request: fixPromptRequest,
  });

  if (!promptResult.ok) {
    return promptResult;
  }

  await markFixPromptGenerated({
    db,
    commentId,
  });

  return {
    ok: true,
    data: {
      commentId: inlineComment.id,
      reviewArtifactId: inlineComment.artifactId,
      repositoryFullName: inlineComment.repositoryFullName,
      prNumber: parseInt(inlineComment.prNumber, 10),
      prSummary: inlineComment.prSummary,
      confidenceScore: inlineComment.confidenceScore,
      confidenceReason: inlineComment.confidenceReason,
      prompt: promptResult.data,
      copiedHint: "Prompt copied to clipboard. Paste it into your coding agent to implement the fix.",
      comment: {
        id: inlineComment.id,
        path: inlineComment.path,
        title: inlineComment.title,
        body: inlineComment.body,
        severity: inlineComment.severity,
        line: inlineComment.line,
        side: inlineComment.side,
        startLine: inlineComment.startLine,
        startSide: inlineComment.startSide,
        subjectType: inlineComment.subjectType,
        anchorStatus: inlineComment.anchorStatus,
        anchorFailureReason: inlineComment.anchorFailureReason,
        githubReviewCommentId: inlineComment.githubReviewCommentId,
      },
    },
  } as const;
}
