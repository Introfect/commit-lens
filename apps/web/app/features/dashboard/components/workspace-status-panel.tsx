import { ArrowRight, Bot, CheckCircle2, FolderGit2, Github, Radar, TriangleAlert } from 'lucide-react';
import { Button } from '../../../shared/components/ui/button';
import { Panel } from '../../../shared/components/ui/panel';
import type { DashboardMetrics, DashboardStatusSummary } from '../lib/dashboard-metrics';

type WorkspaceStatusPanelProps = {
  activeInstallationCount: number;
  repositoryCount: number;
  metrics: DashboardMetrics;
  statusSummary: DashboardStatusSummary[];
  isRefreshing: boolean;
  onPrimaryAction: () => void;
};

type WorkspaceGuidance = {
  eyebrow: string;
  title: string;
  description: string;
  checklist: string[];
  actionLabel: string | null;
};

function getToneClasses(tone: DashboardStatusSummary['tone']): string {
  switch (tone) {
    case 'accent':
      return 'bg-blue-500';
    case 'positive':
      return 'bg-emerald-500';
    case 'danger':
      return 'bg-red-500';
    case 'muted':
      return 'bg-white/28';
  }
}

function getWorkspaceGuidance({
  activeInstallationCount,
  repositoryCount,
  metrics,
}: {
  activeInstallationCount: number;
  repositoryCount: number;
  metrics: DashboardMetrics;
}): WorkspaceGuidance {
  if (activeInstallationCount === 0) {
    return {
      eyebrow: 'Setup',
      title: 'Install the GitHub App',
      description:
        'Your GitHub session is active, but repository access still needs the GitHub App installation step.',
      checklist: [
        'Authorize repository access for your account or organization.',
        'Sync available repositories into this workspace.',
        'Wait for pull request webhooks to begin populating activity.',
      ],
      actionLabel: 'Install GitHub App',
    };
  }

  if (repositoryCount === 0) {
    return {
      eyebrow: 'Repositories',
      title: 'No repositories are synced',
      description:
        'An installation exists, but there are no active repositories available to this workspace yet.',
      checklist: [
        'Review the repositories selected in the GitHub App installation.',
        'Grant access to at least one repository.',
        'Return here to confirm sync and activity.',
      ],
      actionLabel: 'Update GitHub App access',
    };
  }

  if (metrics.filteredEventCount === 0) {
    return {
      eyebrow: 'Activity',
      title: 'Waiting for pull request activity',
      description:
        'Repositories are connected. Open or update a pull request to kick off webhook intake and AI review activity.',
      checklist: [
        'Open or update a pull request in a connected repository.',
        'Confirm the webhook reaches the backend.',
        'Watch this panel for new review jobs and failures.',
      ],
      actionLabel: null,
    };
  }

  return {
    eyebrow: 'Pipeline',
    title: metrics.failedCount > 0 ? 'Review failures need attention' : 'Review pipeline is live',
    description:
      metrics.failedCount > 0
        ? 'The review system is active, but some jobs failed and should be investigated.'
        : 'Pull request events are flowing through the pipeline and posting back to GitHub.',
    checklist: [
      `${metrics.reviewingCount} review job${metrics.reviewingCount === 1 ? '' : 's'} currently in progress.`,
      `${metrics.reviewedCount} review${metrics.reviewedCount === 1 ? '' : 's'} completed successfully in this view.`,
      `${metrics.failedCount} failure${metrics.failedCount === 1 ? '' : 's'} currently need investigation.`,
    ],
    actionLabel: null,
  };
}

export function WorkspaceStatusPanel({
  activeInstallationCount,
  repositoryCount,
  metrics,
  statusSummary,
  isRefreshing,
  onPrimaryAction,
}: WorkspaceStatusPanelProps) {
  const guidance = getWorkspaceGuidance({
    activeInstallationCount,
    repositoryCount,
    metrics,
  });
  const totalStatuses =
    statusSummary.reduce((count, item) => count + item.value, 0) || 1;

  return (
    <Panel className="p-5 lg:p-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.22em] text-white/36">{guidance.eyebrow}</p>
          <h2 className="mt-3 text-xl font-semibold text-white">{guidance.title}</h2>
        </div>
        {metrics.failedCount > 0 ? (
          <TriangleAlert className="h-5 w-5 text-red-300" />
        ) : metrics.reviewingCount > 0 ? (
          <Bot className="h-5 w-5 text-blue-300" />
        ) : metrics.reviewedCount > 0 ? (
          <CheckCircle2 className="h-5 w-5 text-emerald-300" />
        ) : activeInstallationCount > 0 ? (
          <FolderGit2 className="h-5 w-5 text-white/30" />
        ) : (
          <Github className="h-5 w-5 text-white/30" />
        )}
      </div>

      <p className="mt-4 text-sm leading-6 text-white/48">{guidance.description}</p>

      <div className="mt-6 space-y-3">
        {guidance.checklist.map((item) => (
          <div key={item} className="flex items-start gap-3 reeeddddccc-xl border border-white/[0.07] bg-[#0f1214] px-4 py-3">
            <div className="mt-1 h-2 w-2 reeeddddccc-full bg-[#1e9f63]" />
            <p className="text-sm leading-6 text-white/62">{item}</p>
          </div>
        ))}
      </div>

      <div className="mt-6">
        <p className="text-[11px] uppercase tracking-[0.22em] text-white/30">Review status</p>
        <div className="mt-4 space-y-4">
          {statusSummary.map((item) => {
            const percentage = Math.round((item.value / totalStatuses) * 100);

            return (
              <div key={item.key}>
                <div className="flex items-center justify-between gap-4 text-sm">
                  <div>
                    <p className="text-white/70">{item.label}</p>
                    <p className="text-xs text-white/34">{item.description}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium text-white">{item.value}</p>
                    <p className="text-xs text-white/34">{percentage}%</p>
                  </div>
                </div>
                <div className="mt-2 h-1.5 reeeddddccc-full bg-white/[0.06]">
                  <div
                    className={`h-1.5 reeeddddccc-full ${getToneClasses(item.tone)}`}
                    style={{ width: `${percentage}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {guidance.actionLabel ? (
        <Button onClick={onPrimaryAction} className="mt-6 w-full justify-center gap-2 reeeddddccc-xl">
          <Radar className="h-4 w-4" />
          {guidance.actionLabel}
          <ArrowRight className="h-4 w-4" />
        </Button>
      ) : null}

      {isRefreshing ? (
        <p className="mt-4 text-sm text-[#7af0b8]">A live review job is still running in this workspace.</p>
      ) : null}
    </Panel>
  );
}
