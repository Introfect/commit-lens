import { GitHub } from "arctic";
import type { WithEnv } from "../../utils/commonTypes";
import { ErrorCodes, type Result } from "../../utils/error";
import { z } from "zod";
import {
  GitHubEmailSchema,
  GitHubOAuthUserSchema,
  type GitHubOAuthUser,
} from "../../types/github";
import { createLogger, generateCorrelationId } from "../../utils/logger";

const GITHUB_OAUTH_SCOPES = ["read:user", "user:email"] as const;

function logGithubApiRequestStarted({
  operation,
  endpoint,
}: {
  operation: string;
  endpoint: string;
}) {
  const logger = createLogger({
    correlationId: generateCorrelationId(),
    operation,
  });

  logger.info("GitHub API request started", { endpoint });
  return {
    logger,
    startedAt: Date.now(),
  };
}

export function hasGitHubOauthConfiguration({ env }: WithEnv<{}>): boolean {
  return (
    env.GITHUB_OAUTH_CLIENT_ID.trim().length > 0 &&
    env.GITHUB_OAUTH_CLIENT_ID !== "WIP" &&
    env.GITHUB_OAUTH_CLIENT_SECRET.trim().length > 0 &&
    env.GITHUB_OAUTH_CLIENT_SECRET !== "WIP" &&
    env.GITHUB_OAUTH_REDIRECT_URI.trim().length > 0
  );
}

export function hasGitHubAppConfiguration({ env }: WithEnv<{}>): boolean {
  return (
    env.GITHUB_APP_SLUG.trim().length > 0 &&
    env.GITHUB_APP_SLUG !== "WIP" &&
    env.GITHUB_APP_ID.trim().length > 0 &&
    env.GITHUB_APP_ID !== "WIP" &&
    env.GITHUB_APP_PRIVATE_KEY.trim().length > 0 &&
    env.GITHUB_APP_PRIVATE_KEY !== "WIP"
  );
}

export function getGitHubOauthClient({ env }: WithEnv<{}>) {
  return new GitHub(
    env.GITHUB_OAUTH_CLIENT_ID,
    env.GITHUB_OAUTH_CLIENT_SECRET,
    env.GITHUB_OAUTH_REDIRECT_URI
  );
}

export function getGitHubOauthAuthorizationUrl({
  env,
  state,
}: WithEnv<{
  state: string;
}>): string {
  const client = getGitHubOauthClient({ env });
  const authorizationUrl = client
    .createAuthorizationURL(state, [...GITHUB_OAUTH_SCOPES])
    .toString();

  const logger = createLogger({
    correlationId: generateCorrelationId(),
    operation: "github_oauth_authorization_url",
  });
  const parsedAuthorizationUrl = new URL(authorizationUrl);

  logger.info("Generated GitHub OAuth authorization URL", {
    authorizationHost: parsedAuthorizationUrl.host,
    authorizationPath: parsedAuthorizationUrl.pathname,
    hasRedirectUri: parsedAuthorizationUrl.searchParams.has("redirect_uri"),
    hasState: parsedAuthorizationUrl.searchParams.has("state"),
    scope: parsedAuthorizationUrl.searchParams.get("scope"),
  });

  return authorizationUrl;
}

export async function exchangeGitHubAuthorizationCode({
  env,
  code,
}: WithEnv<{
  code: string;
}>): Promise<Result<{ accessToken: string }>> {
  const logger = createLogger({
    correlationId: generateCorrelationId(),
    operation: "github_oauth_exchange_code",
  });
  const startedAt = Date.now();

  logger.info("Exchanging GitHub authorization code", {
    hasCode: code.trim().length > 0,
  });

  try {
    const client = getGitHubOauthClient({ env });
    const tokens = await client.validateAuthorizationCode(code);

    logger.info("GitHub authorization code exchanged successfully", {
      durationMs: Date.now() - startedAt,
    });

    return {
      ok: true,
      data: {
        accessToken: tokens.accessToken(),
      },
    } as const;
  } catch (error) {
    logger.error("Failed to exchange GitHub authorization code", error instanceof Error ? error : null, {
      durationMs: Date.now() - startedAt,
    });

    return {
      ok: false,
      errorCode: ErrorCodes.GITHUB_OAUTH_FAILED,
      error:
        error instanceof Error
          ? error.message
          : "Failed to validate GitHub authorization code",
    } as const;
  }
}

export async function getGitHubOAuthUser({
  accessToken,
}: {
  accessToken: string;
}): Promise<Result<GitHubOAuthUser>> {
  const { logger, startedAt } = logGithubApiRequestStarted({
    operation: "github_oauth_get_user",
    endpoint: "/user",
  });

  try {
    const response = await fetch("https://api.github.com/user", {
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${accessToken}`,
        "User-Agent": "commit-lens",
      },
    });

    logger.info("GitHub API request completed", {
      endpoint: "/user",
      status: response.status,
      durationMs: Date.now() - startedAt,
    });

    if (!response.ok) {
      return {
        ok: false,
        errorCode: ErrorCodes.GITHUB_USER_FETCH_FAILED,
        error: `Failed to fetch GitHub user (${response.status})`,
      } as const;
    }

    const parsed = GitHubOAuthUserSchema.safeParse(await response.json());

    if (!parsed.success) {
      return {
        ok: false,
        errorCode: ErrorCodes.GITHUB_USER_FETCH_FAILED,
        error: parsed.error.message,
      } as const;
    }

    return {
      ok: true,
      data: parsed.data,
    } as const;
  } catch (error) {
    logger.error("GitHub API request failed", error instanceof Error ? error : null, {
      endpoint: "/user",
      durationMs: Date.now() - startedAt,
    });

    return {
      ok: false,
      errorCode: ErrorCodes.GITHUB_USER_FETCH_FAILED,
      error:
        error instanceof Error
          ? error.message
          : "Failed to fetch GitHub user",
    } as const;
  }
}

export async function getGitHubPrimaryEmail({
  accessToken,
}: {
  accessToken: string;
}): Promise<Result<string | null>> {
  const { logger, startedAt } = logGithubApiRequestStarted({
    operation: "github_oauth_get_primary_email",
    endpoint: "/user/emails",
  });

  try {
    const response = await fetch("https://api.github.com/user/emails", {
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${accessToken}`,
        "User-Agent": "commit-lens",
      },
    });

    logger.info("GitHub API request completed", {
      endpoint: "/user/emails",
      status: response.status,
      durationMs: Date.now() - startedAt,
    });

    if (!response.ok) {
      return {
        ok: false,
        errorCode: ErrorCodes.GITHUB_USER_FETCH_FAILED,
        error: `Failed to fetch GitHub emails (${response.status})`,
      } as const;
    }

    const parsed = z.array(GitHubEmailSchema).safeParse(await response.json());

    if (!parsed.success) {
      return {
        ok: false,
        errorCode: ErrorCodes.GITHUB_USER_FETCH_FAILED,
        error: parsed.error.message,
      } as const;
    }

    const primaryVerifiedEmail =
      parsed.data.find((email) => email.primary && email.verified) ??
      parsed.data.find((email) => email.verified) ??
      null;

    return {
      ok: true,
      data: primaryVerifiedEmail?.email ?? null,
    } as const;
  } catch (error) {
    logger.error("GitHub API request failed", error instanceof Error ? error : null, {
      endpoint: "/user/emails",
      durationMs: Date.now() - startedAt,
    });

    return {
      ok: false,
      errorCode: ErrorCodes.GITHUB_USER_FETCH_FAILED,
      error:
        error instanceof Error
          ? error.message
          : "Failed to fetch GitHub emails",
    } as const;
  }
}

export function getGitHubAppNewInstallationUrl({
  appSlug,
  state,
}: {
  appSlug: string;
  state: string;
}): string {
  return `https://github.com/apps/${encodeURIComponent(appSlug)}/installations/new?state=${encodeURIComponent(state)}`;
}

export function getGitHubAppManageInstallationUrl({
  installationId,
}: {
  installationId: string;
}): string {
  return `https://github.com/settings/installations/${encodeURIComponent(installationId)}`;
}
