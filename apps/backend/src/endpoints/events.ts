import { getHono } from "../utils/hono";
import { connectDb } from "../features/db/connect";
import { getPullRequestEventsForUser } from "../features/pullRequestEvent";
import { getRepositoriesForUser, getRepositoryIdsForUser } from "../features/repository";
import { createLogger, generateCorrelationId } from "../utils/logger";
import { getErrorMessage } from "../utils/error";
import { requireSession } from "../features/auth/session";

export const eventsEndpoint = getHono();

eventsEndpoint.use("*", requireSession());

/**
 * Get pull request events for the authenticated user
 * GET /events/pull-requests
 */
eventsEndpoint.get("/pull-requests", async (c) => {
  const authUser = c.get("authUser");

  const logger = createLogger({
    correlationId: generateCorrelationId(),
    operation: "events_pull_requests",
  });

  try {
    const db = connectDb({ env: c.env });

    // Get repository IDs accessible by the user
    const repositoryIds = await getRepositoryIdsForUser({
      db,
      userId: authUser.id,
    });

    if (repositoryIds.length === 0) {
      return c.json({
        ok: true,
        data: [],
        message: "No repositories connected",
      });
    }

    // Get pull request events for those repositories
    const events = await getPullRequestEventsForUser({
      db,
      env: c.env,
      repositoryIds,
      limit: 50, // Default limit
    });

    return c.json({
      ok: true,
      data: events,
      count: events.length,
    });
  } catch (error) {
    logger.error(
      "Failed to fetch pull request events",
      error instanceof Error ? error : null
    );
    return c.json(
      {
        error: "Failed to fetch pull request events",
        details: getErrorMessage(error instanceof Error ? error : null),
      },
      500
    );
  }
});

/**
 * Get repositories for the authenticated user
 * GET /events/repositories
 */
eventsEndpoint.get("/repositories", async (c) => {
  const authUser = c.get("authUser");

  const logger = createLogger({
    correlationId: generateCorrelationId(),
    operation: "events_repositories",
  });

  try {
    const db = connectDb({ env: c.env });

    const repositories = await getRepositoriesForUser({
      db,
      userId: authUser.id,
    });

    return c.json({
      ok: true,
      data: repositories,
      count: repositories.length,
    });
  } catch (error) {
    logger.error(
      "Failed to fetch repositories",
      error instanceof Error ? error : null
    );
    return c.json(
      {
        error: "Failed to fetch repositories",
        details: getErrorMessage(error instanceof Error ? error : null),
      },
      500
    );
  }
});
