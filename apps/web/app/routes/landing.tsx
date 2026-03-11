import { redirect } from 'react-router';
import type { Route } from './+types/landing';
import { api } from '../core/api/client';
import { fetchBackendJson } from '../core/api/server';
import { LoginShell } from '../features/auth';
import type { ApiResponse, AuthStatusResponse } from '../types';

type LandingLoaderData = {
  errorMessage: string | null;
  redirectTo: string | null;
};

const ERROR_MESSAGES: Record<string, string> = {
  'github-auth-config':
    'GitHub login is not configured yet. Verify GITHUB_OAUTH_CLIENT_ID, GITHUB_OAUTH_CLIENT_SECRET, and GITHUB_OAUTH_REDIRECT_URI in backend env.',
  'github-auth-denied': 'GitHub sign-in was canceled before the session was created.',
  'github-auth-failed': 'GitHub sign-in failed. Start the login flow again.',
  'github-auth-missing-code': 'GitHub did not return a valid authorization code.',
  'github-auth-start':
    'GitHub sign-in could not be started from the backend. Check /api/v1/auth/config-check for local OAuth diagnostics.',
  'github-auth-state': 'The GitHub login state expired or was invalid.',
  'github-auth-token': 'GitHub returned an invalid OAuth token response.',
  'github-auth-user': 'GitHub user data could not be loaded.',
  'github-auth-user-save': 'The signed-in GitHub user could not be persisted locally.',
};

export async function loader(args: Route.LoaderArgs): Promise<LandingLoaderData> {
  const authResponse = await fetchBackendJson<ApiResponse<AuthStatusResponse>>({
    request: args.request,
    env: args.context.cloudflare.env,
    endpoint: '/auth/me',
  });

  if (authResponse.status === 200 && authResponse.payload?.ok) {
    throw redirect('/dashboard');
  }

  const currentUrl = new URL(args.request.url);
  const errorCode = currentUrl.searchParams.get('error');

  return {
    errorMessage: errorCode ? ERROR_MESSAGES[errorCode] ?? 'Authentication failed.' : null,
    redirectTo: currentUrl.searchParams.get('redirectTo'),
  };
}

export default function Landing({ loaderData }: Route.ComponentProps) {
  return (
    <LoginShell
      errorMessage={loaderData.errorMessage}
      onContinue={() => api.startGitHubLogin(loaderData.redirectTo ?? undefined)}
    />
  );
}
