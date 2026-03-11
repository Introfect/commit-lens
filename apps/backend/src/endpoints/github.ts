import { getHono } from "../utils/hono";
import { connectDb } from "../features/db/connect";
import { eq } from "drizzle-orm";
import { RepositoryInstallationTable } from "../features/db/schema";
import {
  hasGitHubAppConfiguration,
  getGitHubAppManageInstallationUrl,
  getGitHubAppNewInstallationUrl,
} from "../features/auth/github";
import jwt from "@tsndr/cloudflare-worker-jwt";
import { GitHubAppStateSchema } from "../types/github";
import { createLogger, generateCorrelationId } from "../utils/logger";
import { ErrorCodes, getErrorMessage } from "../utils/error";
import { getSessionUser, requireSession } from "../features/auth/session";
import { getUserById } from "../features/user";
import { getPrimaryInstallationForUser } from "../features/repository";

export const githubEndpoint = getHono();

const RepositoryInstallationSelectInfo = {
  info: {
    installationId: RepositoryInstallationTable.installationId,
    userId: RepositoryInstallationTable.userId,
    accountLogin: RepositoryInstallationTable.accountLogin,
    accountAvatarUrl: RepositoryInstallationTable.accountAvatarUrl,
    isActive: RepositoryInstallationTable.isActive,
  },
} as const;

function buildFrontendUrl(
  env: Env,
  pathname: string,
  searchParams?: Record<string, string>
): string {
  const url = new URL(env.FRONTEND_URL || "http://localhost:5173");
  url.pathname = pathname;

  if (searchParams) {
    for (const [key, value] of Object.entries(searchParams)) {
      url.searchParams.set(key, value);
    }
  }

  return url.toString();
}

function buildDashboardRedirect(
  env: Env,
  searchParams?: Record<string, string>
): string {
  return buildFrontendUrl(env, "/dashboard", searchParams);
}

githubEndpoint.use("/redirect", requireSession());

// Redirect to GitHub App installation with state token
githubEndpoint.get("/redirect", async (c) => {
  const authUser = c.get("authUser");
  const db = connectDb({ env: c.env });

  const logger = createLogger({
    correlationId: generateCorrelationId(),
    operation: "github_redirect",
  });

  try {
    if (!hasGitHubAppConfiguration({ env: c.env })) {
      logger.warn("GitHub App redirect blocked because configuration is incomplete", {
        hasAppSlug:
          c.env.GITHUB_APP_SLUG.trim().length > 0 &&
          c.env.GITHUB_APP_SLUG !== "WIP",
        hasAppId: c.env.GITHUB_APP_ID.trim().length > 0 && c.env.GITHUB_APP_ID !== "WIP",
        hasPrivateKey:
          c.env.GITHUB_APP_PRIVATE_KEY.trim().length > 0 &&
          c.env.GITHUB_APP_PRIVATE_KEY !== "WIP",
      });

      return c.redirect(
        buildDashboardRedirect(c.env, {
          error: "github-app-config",
        })
      );
    }

    // Generate a JWT state token containing the user ID
    // This will be sent back by GitHub and allows us to identify the user
    const stateToken = await jwt.sign(
      {
        flow: "github_app_install",
        userId: authUser.id,
        timestamp: Date.now(),
        exp: Math.floor(Date.now() / 1000) + 600, // 10 minutes expiry
      },
      c.env.JWT_SECRET
    );

    const primaryInstallation = await getPrimaryInstallationForUser({
      db,
      userId: authUser.id,
    });
    const installationUrl =
      primaryInstallation !== null
        ? getGitHubAppManageInstallationUrl({
            installationId: primaryInstallation.installationId,
          })
        : getGitHubAppNewInstallationUrl({
            appSlug: c.env.GITHUB_APP_SLUG,
            state: stateToken,
          });

    return c.redirect(installationUrl);
  } catch (error) {
    logger.error(
      "GitHub redirect error",
      error instanceof Error ? error : null
    );
    return c.json(
      {
        error: "Failed to initiate GitHub App installation",
        details: getErrorMessage(error instanceof Error ? error : null),
      },
      500
    );
  }
});

// Callback from GitHub after app installation
// This endpoint receives a direct server-to-server redirect from GitHub
// We CANNOT rely on browser cookies/sessions here
githubEndpoint.get("/callback", async (c) => {
  const db = connectDb({ env: c.env });
  const logger = createLogger({
    correlationId: generateCorrelationId(),
    operation: "github_callback",
  });

  const installationId = c.req.query("installation_id");
  const setupAction = c.req.query("setup_action");
  const state = c.req.query("state");

  if (!installationId || !setupAction) {
    return c.json(
      {
        errorCode: ErrorCodes.GITHUB_CALLBACK_INVALID,
        error: "Invalid Github App Callback Parameters",
      },
      400
    );
  }

  try {
    const sessionUser = await getSessionUser(c);
    let userId: string | null = null;

    if (state) {
      const isValid = await jwt.verify(state, c.env.JWT_SECRET);
      if (!isValid) {
        return c.redirect(
          buildDashboardRedirect(c.env, {
            error: "invalid-state",
          })
        );
      }

      const decoded = jwt.decode(state);
      const payloadValidation = GitHubAppStateSchema.safeParse(decoded.payload);

      if (!payloadValidation.success) {
        return c.redirect(
          buildDashboardRedirect(c.env, {
            error: "invalid-state",
          })
        );
      }

      userId = payloadValidation.data.userId;
    } else if (sessionUser) {
      userId = sessionUser.id;
    }

    if (!userId) {
      return c.redirect(
        buildDashboardRedirect(c.env, {
          error: "installation-session",
        })
      );
    }

    const user = await getUserById({
      id: userId,
      db,
    });

    if (!user) {
      return c.redirect(
        buildFrontendUrl(c.env, "/", {
          error: "github-auth-failed",
        })
      );
    }

    // Fetch installation details from GitHub
    const { getInstallation } = await import("../services/github");
    const installation = await getInstallation({
      env: c.env,
      installationId,
    });

    if (!installation.ok) {
      return c.redirect(
        buildDashboardRedirect(c.env, {
          error: "installation-fetch-failed",
        })
      );
    }

    // Check if installation already exists
    const existingInstallationRows = await db
      .select(RepositoryInstallationSelectInfo.info)
      .from(RepositoryInstallationTable)
      .where(eq(RepositoryInstallationTable.installationId, installationId))
      .limit(1);

    const existingInstallation = existingInstallationRows[0] ?? null;

    if (!existingInstallation) {
      await db.insert(RepositoryInstallationTable).values({
        installationId: installationId,
        userId: userId,
        accountLogin: installation.data.account.login,
        accountAvatarUrl: installation.data.account.avatar_url,
      });
    } else if (existingInstallation.userId !== userId) {
      // Handle case where installation exists but belongs to a different user
      return c.redirect(
        buildDashboardRedirect(c.env, {
          error: "installation-conflict",
        })
      );
    }
    // If it exists and belongs to the same user, update it (re-installation)
    else {
      await db.update(RepositoryInstallationTable)
        .set({
          accountLogin: installation.data.account.login,
          accountAvatarUrl: installation.data.account.avatar_url,
          isActive: true,
        })
        .where(eq(RepositoryInstallationTable.installationId, installationId));
    }

    // Sync repositories for this installation
    const { syncRepositoriesForInstallation } = await import("../features/repository");
    const syncResult = await syncRepositoriesForInstallation({
      db,
      env: c.env,
      installationId,
      mode: "user_manage",
    });

    if (!syncResult.ok) {
      return c.redirect(
        buildDashboardRedirect(c.env, {
          error: "repo-sync-failed",
        })
      );
    }

    const syncState =
      syncResult.data.addedCount > 0 ||
      syncResult.data.restoredCount > 0 ||
      syncResult.data.deactivatedCount > 0
        ? "success"
        : "unchanged";
    const wasReactivated = existingInstallation?.userId === userId && !existingInstallation.isActive;

    return c.redirect(
      buildDashboardRedirect(c.env, {
        connected: "true",
        sync: syncState,
        reactivated: wasReactivated ? "true" : "false",
      })
    );
  } catch (error) {
    logger.error(
      "GitHub App callback error",
      error instanceof Error ? error : null
    );
    return c.redirect(
      buildDashboardRedirect(c.env, {
        error: "github-callback-failed",
      })
    );
  }
});
