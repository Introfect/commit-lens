import { AlertCircle, FolderGit2, GitPullRequest, LoaderCircle, ShieldCheck } from 'lucide-react';
import type { DashboardMetrics, DashboardSelectOption, DashboardStatusSummary } from '../lib/dashboard-metrics';
import type { DashboardFilters } from '../schemas/dashboard-filter-schema';
import type { AuthStatusResponse, PullRequestEventResponse, RepositoryResponse } from '../../../types';
import { DashboardToolbar } from './dashboard-toolbar';
import { MetricCard } from './metric-card';
import { RecentReviewActivity } from './recent-review-activity';
import { RepositorySummaryPanel } from './repository-summary-panel';
import { WorkspaceStatusPanel } from './workspace-status-panel';
import { Panel } from '../../../shared/components/ui/panel';

type DashboardOverviewProps = {
  greeting: string;
  summary: string;
  filters: DashboardFilters;
  repositoryOptions: DashboardSelectOption[];
  authorOptions: DashboardSelectOption[];
  metrics: DashboardMetrics;
  statusSummary: DashboardStatusSummary[];
  recentEvents: PullRequestEventResponse[];
  repositories: RepositoryResponse[];
  installations: AuthStatusResponse['installations'];
  activeInstallationCount: number;
  isRefreshing: boolean;
  notice: {
    tone: 'success' | 'info' | 'error';
    title: string;
    description: string;
  } | null;
  onFiltersChange: (nextFilters: Partial<DashboardFilters>) => void;
  onPrimaryAction: () => void;
  onDisconnectInstallation: (installationId: string) => void;
  onRemoveRepository: (repositoryId: string) => void;
};

function getActivityDescription({
  activeInstallationCount,
  repositoryCount,
  eventCount,
}: {
  activeInstallationCount: number;
  repositoryCount: number;
  eventCount: number;
}): string {
  if (activeInstallationCount === 0) {
    return 'Install the GitHub App to start syncing repositories and processing pull requests.';
  }

  if (repositoryCount === 0) {
    return 'An installation exists, but repositories still need to be made available to this workspace.';
  }

  if (eventCount === 0) {
    return 'Repositories are connected. Open or update a pull request to start generating review activity.';
  }

  return 'Review pipeline status and repository activity for the current workspace.';
}

export function DashboardOverview({
  greeting,
  summary,
  filters,
  repositoryOptions,
  authorOptions,
  metrics,
  statusSummary,
  recentEvents,
  repositories,
  installations,
  activeInstallationCount,
  isRefreshing,
  notice,
  onFiltersChange,
  onPrimaryAction,
  onDisconnectInstallation,
  onRemoveRepository,
}: DashboardOverviewProps) {
  const primaryActionLabel =
    activeInstallationCount === 0 ? 'Install GitHub App' : 'Add repositories';
  const primaryInstallation = installations[0] ?? null;

  return (
    <div className="space-y-8">
      <DashboardToolbar
        greeting={greeting}
        summary={summary}
        isRefreshing={isRefreshing}
        filters={filters}
        repositoryOptions={repositoryOptions}
        authorOptions={authorOptions}
        onFiltersChange={onFiltersChange}
        onPrimaryAction={onPrimaryAction}
        primaryActionLabel={primaryActionLabel}
      />

      {notice ? (
        <Panel
          as="div"
          className={
            notice.tone === 'error'
              ? 'border-red-500/18 bg-red-500/7 p-4'
              : notice.tone === 'success'
                ? 'border-emerald-500/18 bg-emerald-500/7 p-4'
                : 'border-blue-500/18 bg-blue-500/7 p-4'
          }
        >
          <p className="text-sm font-medium text-white">{notice.title}</p>
          <p className="mt-2 text-sm leading-6 text-white/62">{notice.description}</p>
        </Panel>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-4">
        <MetricCard
          icon={FolderGit2}
          label="Connected repositories"
          value={String(metrics.connectedRepositoryCount)}
          description={
            metrics.connectedRepositoryCount === 0
              ? 'No repositories connected for the current selection.'
              : 'Repositories currently available through the GitHub App installation.'
          }
        />
        <MetricCard
          icon={LoaderCircle}
          label="Reviews in progress"
          value={String(metrics.reviewingCount)}
          description={
            metrics.reviewingCount === 0
              ? 'No pull requests are currently being reviewed.'
              : 'Open review jobs currently being processed by the worker.'
          }
        />
        <MetricCard
          icon={ShieldCheck}
          label="Reviews completed"
          value={String(metrics.reviewedCount)}
          description={
            metrics.reviewedCount === 0
              ? 'No completed review jobs in this view.'
              : 'Review jobs that completed successfully in the selected window.'
          }
        />
        <MetricCard
          icon={AlertCircle}
          label="Review failures"
          value={String(metrics.failedCount)}
          description={
            metrics.failedCount === 0
              ? 'No failed review jobs in this view.'
              : 'Review jobs that need investigation or a retry path.'
          }
        />
      </div>

      <section className="space-y-4">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-white">Activity</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-white/45">
            {getActivityDescription({
              activeInstallationCount,
              repositoryCount: repositories.length,
              eventCount: metrics.filteredEventCount,
            })}
          </p>
        </div>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.65fr)_minmax(360px,1fr)]">
          <RecentReviewActivity events={recentEvents} />
          <WorkspaceStatusPanel
            activeInstallationCount={activeInstallationCount}
            repositoryCount={repositories.length}
            metrics={metrics}
            statusSummary={statusSummary}
            isRefreshing={isRefreshing}
            onPrimaryAction={onPrimaryAction}
          />
        </div>
      </section>

      <RepositorySummaryPanel
        repositories={repositories}
        installation={primaryInstallation}
        onPrimaryAction={onPrimaryAction}
        onDisconnectInstallation={onDisconnectInstallation}
        onRemoveRepository={onRemoveRepository}
      />

      {filters.repo !== 'all' || filters.author !== 'all' || filters.window !== '7d' ? (
        <p className="text-sm text-white/35">
          Filters are applied to the current dashboard view. Clear them from the top-right controls to return to the default workspace overview.
        </p>
      ) : null}
    </div>
  );
}
