import { getHono } from "../utils/hono";
import { getAuth } from "@hono/clerk-auth";
import { connectDb } from "../features/db/connect";
import { getPullRequestEventsForUser } from "../features/pullRequestEvent";
import { getRepositoriesForUser, getRepositoryIdsForUser } from "../features/repository";

export const eventsEndpoint = getHono();

/**
 * Get pull request events for the authenticated user
 * GET /events/pull-requests
 */
eventsEndpoint.get("/pull-requests", async (c) => {
  const auth = getAuth(c);
  if (!auth?.userId) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  try {
    const db = connectDb({ env: c.env });

    // Get repository IDs accessible by the user
    const repositoryIds = await getRepositoryIdsForUser({
      db,
      userId: auth.userId,
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
  } catch (error: any) {
    console.error("Failed to fetch pull request events:", error);
    return c.json(
      {
        error: "Failed to fetch pull request events",
        details: error.message,
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
  const auth = getAuth(c);
  if (!auth?.userId) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  try {
    const db = connectDb({ env: c.env });

    const repositories = await getRepositoriesForUser({
      db,
      userId: auth.userId,
    });

    return c.json({
      ok: true,
      data: repositories,
      count: repositories.length,
    });
  } catch (error: any) {
    console.error("Failed to fetch repositories:", error);
    return c.json(
      {
        error: "Failed to fetch repositories",
        details: error.message,
      },
      500
    );
  }
});
