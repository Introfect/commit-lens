import { useEffect } from 'react';
import { redirect, useRevalidator, useSearchParams } from 'react-router';
import type { Route } from './+types/dashboard';
import { api } from '../core/api/client';
import { fetchBackendJson } from '../core/api/server';
import {
  buildDashboardViewModel,
  DashboardFrame,
  DashboardOverview,
  getGreeting,
  parseDashboardFilters,
} from '../features/dashboard';
import type {
  ApiResponse,
  AuthStatusResponse,
  PullRequestEventResponse,
  RepositoryResponse,
  User,
} from '../types';

type DashboardLoaderData = {
  user: User;
  activeInstallationCount: number;
  installations: AuthStatusResponse['installations'];
  repos: RepositoryResponse[];
  events: PullRequestEventResponse[];
};

type DashboardNotice = {
  tone: 'success' | 'info' | 'error';
  title: string;
  description: string;
};

function getDashboardNotice(searchParams: URLSearchParams): DashboardNotice | null {
  const error = searchParams.get('error');
  const sync = searchParams.get('sync');
  const reactivated = searchParams.get('reactivated');

  if (error === 'repo-sync-failed') {
    return {
      tone: 'error',
      title: 'GitHub returned, but repository sync failed',
      description:
        'The installation flow completed, but CommitLens could not sync the selected repositories back into the workspace.',
    };
  }

  if (error === 'installation-conflict') {
    return {
      tone: 'error',
      title: 'This GitHub App installation is already linked elsewhere',
      description:
        'The selected installation is already claimed by a different CommitLens user and cannot be attached here.',
    };
  }

  if (error === 'invalid-state' || error === 'installation-session') {
    return {
      tone: 'error',
      title: 'The GitHub App update could not be verified',
      description:
        'The return from GitHub no longer matched an active CommitLens session, so repository access was not updated.',
    };
  }

  if (error === 'installation-fetch-failed' || error === 'github-callback-failed') {
    return {
      tone: 'error',
      title: 'The GitHub App callback failed',
      description:
        'GitHub redirected back to CommitLens, but the installation details could not be finalized.',
    };
  }

  if (error === 'github-app-config') {
    return {
      tone: 'error',
      title: 'GitHub App configuration is incomplete',
      description:
        'CommitLens could not start the installation flow because one or more GitHub App settings are missing.',
    };
  }

  if (sync === 'success') {
    return {
      tone: 'success',
      title: reactivated === 'true' ? 'GitHub access was restored' : 'Repositories updated successfully',
      description:
        reactivated === 'true'
          ? 'The existing GitHub App installation was reactivated and its selected repositories were synced back into this workspace.'
          : 'CommitLens synced your latest GitHub App repository selection into the workspace.',
    };
  }

  if (sync === 'unchanged') {
    return {
      tone: 'info',
      title: 'No repository changes were detected',
      description:
        'GitHub returned successfully, but the selected repository access was unchanged from the current CommitLens workspace.',
    };
  }

  return null;
}

async function loadAuthenticatedData(args: Route.LoaderArgs): Promise<DashboardLoaderData> {
  const authResponse = await fetchBackendJson<ApiResponse<AuthStatusResponse>>({
    request: args.request,
    env: args.context.cloudflare.env,
    endpoint: '/auth/me',
  });

  if (authResponse.status === 401 || !authResponse.payload?.ok) {
    throw redirect('/');
  }

  const [repositoriesResponse, eventsResponse] = await Promise.all([
    fetchBackendJson<ApiResponse<RepositoryResponse[]>>({
      request: args.request,
      env: args.context.cloudflare.env,
      endpoint: '/repositories',
    }),
    fetchBackendJson<ApiResponse<PullRequestEventResponse[]>>({
      request: args.request,
      env: args.context.cloudflare.env,
      endpoint: '/events/pull-requests',
    }),
  ]);

  if (repositoriesResponse.status === 401 || eventsResponse.status === 401) {
    throw redirect('/');
  }

  return {
    user: authResponse.payload.data.user,
    activeInstallationCount: authResponse.payload.data.activeInstallationCount,
    installations: authResponse.payload.data.installations,
    repos: repositoriesResponse.payload?.data ?? [],
    events: eventsResponse.payload?.data ?? [],
  };
}

export async function loader(args: Route.LoaderArgs): Promise<DashboardLoaderData> {
  return loadAuthenticatedData(args);
}

export default function Dashboard({ loaderData }: Route.ComponentProps) {
  const revalidator = useRevalidator();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, activeInstallationCount, installations, repos, events } = loaderData;
  const filters = parseDashboardFilters(searchParams);
  const notice = getDashboardNotice(searchParams);
  const viewModel = buildDashboardViewModel({
    repositories: repos,
    events,
    filters,
    now: new Date(),
  });
  const reviewingPrCount = events.filter((event) => event.reviewStatus === 'reviewing').length;
  const isRefreshing = revalidator.state !== 'idle';

  useEffect(() => {
    if (reviewingPrCount === 0) {
      return;
    }

    const intervalId = window.setInterval(() => {
      revalidator.revalidate();
    }, 8000);

    return () => window.clearInterval(intervalId);
  }, [reviewingPrCount, revalidator]);

  async function handleRemoveRepository(repositoryId: string) {
    if (
      !window.confirm(
        'Remove this repository from the CommitLens workspace? GitHub App access will stay enabled.'
      )
    ) {
      return;
    }

    try {
      await api.removeRepositoryFromWorkspace(repositoryId);
      revalidator.revalidate();
    } catch {
      window.alert('Failed to remove the repository from the CommitLens workspace.');
    }
  }

  async function handleDisconnectInstallation(installationId: string) {
    if (
      !window.confirm(
        'Disconnect the full GitHub App installation? This will hide every linked repository in CommitLens.'
      )
    ) {
      return;
    }

    try {
      await api.disconnectInstallation(installationId);
      revalidator.revalidate();
    } catch {
      window.alert('Failed to disconnect the GitHub App installation.');
    }
  }

  function handleFiltersChange(nextFilters: Partial<typeof filters>) {
    const mergedFilters = {
      ...filters,
      ...nextFilters,
    };

    setSearchParams({
      repo: mergedFilters.repo,
      author: mergedFilters.author,
      window: mergedFilters.window,
    });
  }

  const summary =
    activeInstallationCount === 0
      ? 'Install the GitHub App to start syncing repositories, receiving webhook events, and reviewing pull requests from one GitHub workspace.'
      : 'Track repository access, pull request intake, and review automation from one GitHub-native operations surface.';

  return (
    <DashboardFrame user={user}>
      <DashboardOverview
        greeting={getGreeting(new Date())}
        summary={summary}
        filters={filters}
        repositoryOptions={viewModel.repositoryOptions}
        authorOptions={viewModel.authorOptions}
        metrics={viewModel.metrics}
        statusSummary={viewModel.statusSummary}
        recentEvents={viewModel.filteredEvents}
        repositories={viewModel.visibleRepositories}
        installations={installations}
        activeInstallationCount={activeInstallationCount}
        isRefreshing={isRefreshing}
        notice={notice}
        onFiltersChange={handleFiltersChange}
        onPrimaryAction={() => api.manageGitHubRepositories()}
        onDisconnectInstallation={handleDisconnectInstallation}
        onRemoveRepository={handleRemoveRepository}
      />
    </DashboardFrame>
  );
}
