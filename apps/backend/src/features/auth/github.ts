import { GitHub } from "arctic";
import type { WithEnv } from "../../utils/commonTypes";
import { ErrorCodes, type Result } from "../../utils/error";
import { z } from "zod";
import {
  GitHubEmailSchema,
  GitHubOAuthUserSchema,
  type GitHubOAuthUser,
} from "../../types/github";

const GITHUB_OAUTH_SCOPES = ["read:user", "user:email"] as const;

export function hasGitHubOauthConfiguration({ env }: WithEnv<{}>): boolean {
  return (
    env.GITHUB_CLIENT_ID.trim().length > 0 &&
    env.GITHUB_CLIENT_ID !== "WIP" &&
    env.GITHUB_CLIENT_SECRET.trim().length > 0 &&
    env.GITHUB_CLIENT_SECRET !== "WIP" &&
    env.GITHUB_OAUTH_REDIRECT_URI.trim().length > 0
  );
}

export function getGitHubOauthClient({ env }: WithEnv<{}>) {
  return new GitHub(
    env.GITHUB_CLIENT_ID,
    env.GITHUB_CLIENT_SECRET,
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
  return client.createAuthorizationURL(state, [...GITHUB_OAUTH_SCOPES]).toString();
}

export async function exchangeGitHubAuthorizationCode({
  env,
  code,
}: WithEnv<{
  code: string;
}>): Promise<Result<{ accessToken: string }>> {
  try {
    const client = getGitHubOauthClient({ env });
    const tokens = await client.validateAuthorizationCode(code);

    return {
      ok: true,
      data: {
        accessToken: tokens.accessToken(),
      },
    } as const;
  } catch (error) {
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
  try {
    const response = await fetch("https://api.github.com/user", {
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${accessToken}`,
        "User-Agent": "commit-lens",
      },
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
  try {
    const response = await fetch("https://api.github.com/user/emails", {
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${accessToken}`,
        "User-Agent": "commit-lens",
      },
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
  state,
}: {
  state: string;
}): string {
  return `https://github.com/apps/commit-lens/installations/new?state=${encodeURIComponent(state)}`;
}

export function getGitHubAppManageInstallationUrl({
  installationId,
}: {
  installationId: string;
}): string {
  return `https://github.com/settings/installations/${encodeURIComponent(installationId)}`;
}
