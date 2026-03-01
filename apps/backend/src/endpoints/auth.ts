import * as jwt from "@tsndr/cloudflare-worker-jwt";
import { connectDb } from "../features/db/connect";
import {
  exchangeGitHubAuthorizationCode,
  getGitHubOauthAuthorizationUrl,
  getGitHubOAuthUser,
  getGitHubPrimaryEmail,
  hasGitHubOauthConfiguration,
} from "../features/auth/github";
import {
  clearSessionCookie,
  createSessionToken,
  requireSession,
} from "../features/auth/session";
import { getInstallationsForUser } from "../features/repository";
import { getUserById, upsertGitHubUser } from "../features/user";
import { GitHubOAuthStateSchema } from "../types/github";
import { ErrorCodes } from "../utils/error";
import { getHono } from "../utils/hono";
import { createLogger, generateCorrelationId } from "../utils/logger";
import { setSessionCookie } from "../features/auth/session";

export const authEndpoint = getHono();

function buildFrontendUrl(
  env: Env,
  pathname: string,
  searchParams?: Record<string, string>
): string {
  const url = new URL(pathname, env.FRONTEND_URL);

  if (searchParams) {
    for (const [key, value] of Object.entries(searchParams)) {
      url.searchParams.set(key, value);
    }
  }

  return url.toString();
}

function getSafeRedirectPath(redirectTo: string | null | undefined): string | null {
  if (!redirectTo) {
    return null;
  }

  if (!redirectTo.startsWith("/") || redirectTo.startsWith("//")) {
    return null;
  }

  return redirectTo;
}

authEndpoint.use("/me", requireSession());

authEndpoint.get("/github/start", async (c) => {
  const logger = createLogger({
    correlationId: generateCorrelationId(),
    operation: "auth_github_start",
  });

  if (!hasGitHubOauthConfiguration({ env: c.env })) {
    logger.warn("GitHub OAuth start blocked because configuration is incomplete", {
      hasClientId: c.env.GITHUB_CLIENT_ID !== "WIP",
      hasClientSecret: c.env.GITHUB_CLIENT_SECRET !== "WIP",
      hasRedirectUri: c.env.GITHUB_OAUTH_REDIRECT_URI.trim().length > 0,
    });

    return c.redirect(
      buildFrontendUrl(c.env, "/", {
        error: "github-auth-config",
      })
    );
  }

  try {
    const redirectTo = getSafeRedirectPath(c.req.query("redirectTo"));
    const stateToken = await jwt.sign(
      {
        flow: "github_oauth",
        timestamp: Date.now(),
        exp: Math.floor(Date.now() / 1000) + 600,
        redirectTo: redirectTo ?? undefined,
      },
      c.env.JWT_SECRET
    );

    return c.redirect(
      getGitHubOauthAuthorizationUrl({
        env: c.env,
        state: stateToken,
      })
    );
  } catch (error) {
    logger.error("Failed to start GitHub OAuth", error instanceof Error ? error : null);
    return c.redirect(
      buildFrontendUrl(c.env, "/", {
        error: "github-auth-start",
      })
    );
  }
});

authEndpoint.get("/github/callback", async (c) => {
  const logger = createLogger({
    correlationId: generateCorrelationId(),
    operation: "auth_github_callback",
  });

  if (!hasGitHubOauthConfiguration({ env: c.env })) {
    logger.warn("GitHub OAuth callback blocked because configuration is incomplete");
    return c.redirect(
      buildFrontendUrl(c.env, "/", {
        error: "github-auth-config",
      })
    );
  }

  const oauthError = c.req.query("error");
  const code = c.req.query("code");
  const state = c.req.query("state");

  if (oauthError) {
    return c.redirect(
      buildFrontendUrl(c.env, "/", {
        error: "github-auth-denied",
      })
    );
  }

  if (!code || !state) {
    return c.redirect(
      buildFrontendUrl(c.env, "/", {
        error: "github-auth-missing-code",
      })
    );
  }

  try {
    const isValidState = await jwt.verify(state, c.env.JWT_SECRET);

    if (!isValidState) {
      return c.redirect(
        buildFrontendUrl(c.env, "/", {
          error: "github-auth-state",
        })
      );
    }

    const decoded = jwt.decode(state);
    const stateValidation = GitHubOAuthStateSchema.safeParse(decoded.payload);

    if (!stateValidation.success) {
      return c.redirect(
        buildFrontendUrl(c.env, "/", {
          error: "github-auth-state",
        })
      );
    }

    const tokenResult = await exchangeGitHubAuthorizationCode({
      env: c.env,
      code,
    });

    if (!tokenResult.ok) {
      logger.error("Failed to exchange GitHub auth code", {
        errorCode: tokenResult.errorCode,
        error: tokenResult.error,
      });

      return c.redirect(
        buildFrontendUrl(c.env, "/", {
          error: "github-auth-token",
        })
      );
    }

    const userResult = await getGitHubOAuthUser({
      accessToken: tokenResult.data.accessToken,
    });

    if (!userResult.ok) {
      logger.error("Failed to fetch GitHub user", {
        errorCode: userResult.errorCode,
        error: userResult.error,
      });

      return c.redirect(
        buildFrontendUrl(c.env, "/", {
          error: "github-auth-user",
        })
      );
    }

    const db = connectDb({ env: c.env });
    const githubUser = userResult.data;
    const emailResult = githubUser.email
      ? { ok: true, data: githubUser.email } as const
      : await getGitHubPrimaryEmail({
          accessToken: tokenResult.data.accessToken,
        });

    if (!emailResult.ok) {
      logger.warn("Failed to fetch GitHub primary email", {
        errorCode: emailResult.errorCode,
        error: emailResult.error,
      });
    }

    const savedUser = await upsertGitHubUser({
      db,
      id: githubUser.id.toString(),
      githubLogin: githubUser.login,
      email: emailResult.ok ? emailResult.data : null,
      name: githubUser.name ?? githubUser.login,
      avatarUrl: githubUser.avatar_url,
    });

    if (!savedUser.ok) {
      logger.error("Failed to upsert GitHub user", {
        errorCode: savedUser.errorCode,
        error: savedUser.error,
      });

      return c.redirect(
        buildFrontendUrl(c.env, "/", {
          error: "github-auth-user-save",
        })
      );
    }

    const sessionToken = await createSessionToken({
      env: c.env,
      userId: savedUser.user.id,
      githubLogin: savedUser.user.githubLogin,
    });

    setSessionCookie(c, sessionToken);
    const redirectPath = getSafeRedirectPath(stateValidation.data.redirectTo) ?? "/dashboard";

    return c.redirect(buildFrontendUrl(c.env, redirectPath));
  } catch (error) {
    logger.error(
      "GitHub OAuth callback failed",
      error instanceof Error ? error : null
    );
    return c.redirect(
      buildFrontendUrl(c.env, "/", {
        error: "github-auth-failed",
      })
    );
  }
});

authEndpoint.get("/me", async (c) => {
  const authUser = c.get("authUser");
  const db = connectDb({ env: c.env });
  const user = await getUserById({
    db,
    id: authUser.id,
  });

  if (!user) {
    clearSessionCookie(c);
    return c.json(
      {
        ok: false,
        errorCode: ErrorCodes.AUTH_SESSION_INVALID,
        error: "Unauthorized",
      } as const,
      401
    );
  }

  const activeInstallations = await getInstallationsForUser({
    db,
    userId: user.id,
  });

  return c.json({
    ok: true,
    data: {
      user,
      activeInstallationCount: activeInstallations.length,
      installations: activeInstallations.map((installation) => ({
        installationId: installation.installationId,
        accountLogin: installation.accountLogin,
        accountAvatarUrl: installation.accountAvatarUrl,
      })),
    },
  } as const);
});

authEndpoint.post("/logout", async (c) => {
  clearSessionCookie(c);

  return c.json({
    ok: true,
    data: {
      message: "Logged out",
    },
  } as const);
});

authEndpoint.get("/logout", async (c) => {
  clearSessionCookie(c);
  return c.redirect(buildFrontendUrl(c.env, "/"));
});
