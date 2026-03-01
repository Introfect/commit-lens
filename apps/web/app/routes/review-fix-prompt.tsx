import { redirect } from 'react-router';
import type { Route } from './+types/review-fix-prompt';
import { fetchBackendJson } from '../core/api/server';
import { DashboardFrame } from '../features/dashboard';
import { FixPromptPage } from '../features/pr-reviews';
import type { ApiResponse, AuthStatusResponse, FixPromptResponse, User } from '../types';

type ReviewFixPromptLoaderData = {
  user: User;
  fixPrompt: FixPromptResponse;
};

function buildLoginRedirectTarget(request: Request): string {
  const currentUrl = new URL(request.url);
  return `${currentUrl.pathname}${currentUrl.search}`;
}

function buildLandingRedirect(request: Request): string {
  return `/?redirectTo=${encodeURIComponent(buildLoginRedirectTarget(request))}`;
}

export async function loader(args: Route.LoaderArgs): Promise<ReviewFixPromptLoaderData> {
  const authResponse = await fetchBackendJson<ApiResponse<AuthStatusResponse>>({
    request: args.request,
    env: args.context.cloudflare.env,
    endpoint: '/auth/me',
  });

  if (authResponse.status === 401 || !authResponse.payload?.ok) {
    throw redirect(buildLandingRedirect(args.request));
  }

  const promptResponse = await fetchBackendJson<ApiResponse<FixPromptResponse>>({
    request: args.request,
    env: args.context.cloudflare.env,
    endpoint: `/pr-reviews/comments/${args.params.commentId}/fix-prompt`,
    init: {
      method: 'POST',
    },
  });

  if (promptResponse.status === 401 || !promptResponse.payload?.ok) {
    if (promptResponse.status === 401) {
      throw redirect(buildLandingRedirect(args.request));
    }

    throw new Response('Review comment not found', {
      status: promptResponse.status === 404 ? 404 : 500,
    });
  }

  const fixPrompt = promptResponse.payload.data;

  if (fixPrompt.reviewArtifactId !== args.params.reviewArtifactId) {
    throw new Response('Review comment not found', { status: 404 });
  }

  return {
    user: authResponse.payload.data.user,
    fixPrompt,
  };
}

export default function ReviewFixPromptRoute({ loaderData }: Route.ComponentProps) {
  return (
    <DashboardFrame user={loaderData.user}>
      <FixPromptPage data={loaderData.fixPrompt} />
    </DashboardFrame>
  );
}
