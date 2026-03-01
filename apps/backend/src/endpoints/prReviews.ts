import { getHono } from "../utils/hono";
import { connectDb } from "../features/db/connect";
import { PullRequestEventTable } from "../features/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { getRepositoryIdsForUser } from "../features/repository";
import { createLogger, generateCorrelationId } from "../utils/logger";
import { ErrorCodes, getErrorMessage } from "../utils/error";
import { requireSession } from "../features/auth/session";
import { createFixPromptForInlineComment } from "../features/prReview";

const PullRequestEventSelectInfo = {
  review: {
    reviewStatus: PullRequestEventTable.reviewStatus,
    updatedAt: PullRequestEventTable.updatedAt,
  },
} as const;

export const prReviewsEndpoint = getHono();

prReviewsEndpoint.use("*", requireSession());

/**
 * GET /api/v1/pr-reviews/:repositoryId/:prNumber
 * Get review status for a specific PR
 */
prReviewsEndpoint.get("/:repositoryId/:prNumber", async (c) => {
  const logger = createLogger({
    correlationId: generateCorrelationId(),
    operation: "pr_reviews_status",
  });

  try {
    const authUser = c.get("authUser");
    const repositoryId = c.req.param("repositoryId");
    const prNumber = c.req.param("prNumber");

    if (!repositoryId || !prNumber) {
      return c.json({ error: "Repository ID and PR number required" }, 400);
    }

    const db = connectDb({ env: c.env });
    const repositoryIds = await getRepositoryIdsForUser({
      db,
      userId: authUser.id,
    });

    if (!repositoryIds.includes(repositoryId)) {
      return c.json({ error: "PR not found" }, 404);
    }

    // Get PR event
    const events = await db
      .select(PullRequestEventSelectInfo.review)
      .from(PullRequestEventTable)
      .where(and(
        eq(PullRequestEventTable.repositoryId, repositoryId),
        eq(PullRequestEventTable.prNumber, prNumber)
      ))
      .orderBy(desc(PullRequestEventTable.receivedAt))
      .limit(1);

    if (events.length === 0) {
      return c.json({ error: "PR not found" }, 404);
    }

    const prEvent = events[0];

    return c.json({
      repositoryId,
      prNumber,
      reviewStatus: prEvent.reviewStatus,
      lastUpdated: prEvent.updatedAt?.toISOString(),
    });

  } catch (error) {
    logger.error(
      "PR review status fetch error",
      error instanceof Error ? error : null
    );
    return c.json(
      {
        error: "Internal server error",
        details: getErrorMessage(error instanceof Error ? error : null),
      },
      500
    );
  }
});

prReviewsEndpoint.post("/comments/:commentId/fix-prompt", async (c) => {
  const logger = createLogger({
    correlationId: generateCorrelationId(),
    operation: "pr_reviews_fix_prompt",
  });

  try {
    const authUser = c.get("authUser");
    const commentId = c.req.param("commentId");

    if (!commentId) {
      return c.json(
        {
          ok: false,
          errorCode: ErrorCodes.PR_REVIEW_COMMENT_NOT_FOUND,
          error: "Comment ID is required",
        } as const,
        400
      );
    }

    const db = connectDb({ env: c.env });
    const promptResult = await createFixPromptForInlineComment({
      db,
      env: c.env,
      commentId,
      userId: authUser.id,
    });

    if (!promptResult.ok) {
      const status = promptResult.errorCode === ErrorCodes.PR_REVIEW_COMMENT_NOT_FOUND ? 404 : 500;
      return c.json(
        {
          ok: false,
          errorCode: promptResult.errorCode,
          error: promptResult.error,
        } as const,
        status
      );
    }

    return c.json({
      ok: true,
      data: promptResult.data,
    } as const);
  } catch (error) {
    logger.error(
      "PR review fix prompt error",
      error instanceof Error ? error : null
    );
    return c.json(
      {
        ok: false,
        errorCode: ErrorCodes.PR_REVIEW_FIX_PROMPT_FAILED,
        error: getErrorMessage(error instanceof Error ? error : null),
      } as const,
      500
    );
  }
});
