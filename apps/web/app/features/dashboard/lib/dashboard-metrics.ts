import type { PullRequestEventResponse, RepositoryResponse } from '../../../types';
import type { DashboardFilters, DashboardWindow } from '../schemas/dashboard-filter-schema';

type DashboardSelectOption = {
  value: string;
  label: string;
};

type DashboardMetrics = {
  connectedRepositoryCount: number;
  reviewingCount: number;
  reviewedCount: number;
  failedCount: number;
  idleCount: number;
  filteredEventCount: number;
};

type DashboardStatusSummary = {
  key: PullRequestEventResponse['reviewStatus'];
  label: string;
  description: string;
  value: number;
  tone: 'accent' | 'positive' | 'danger' | 'muted';
};

type DashboardViewModel = {
  filteredEvents: PullRequestEventResponse[];
  visibleRepositories: RepositoryResponse[];
  repositoryOptions: DashboardSelectOption[];
  authorOptions: DashboardSelectOption[];
  metrics: DashboardMetrics;
  statusSummary: DashboardStatusSummary[];
};

function getWindowStart(window: DashboardWindow, now: Date): Date | null {
  switch (window) {
    case '7d':
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    case '30d':
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    case 'all':
      return null;
  }
}

function isEventWithinWindow(event: PullRequestEventResponse, window: DashboardWindow, now: Date): boolean {
  const windowStart = getWindowStart(window, now);

  if (!windowStart) {
    return true;
  }

  return new Date(event.receivedAt).getTime() >= windowStart.getTime();
}

function sortEventsNewestFirst(events: PullRequestEventResponse[]): PullRequestEventResponse[] {
  return [...events].sort(
    (left, right) => new Date(right.receivedAt).getTime() - new Date(left.receivedAt).getTime()
  );
}

function sortRepositoriesAlphabetically(repositories: RepositoryResponse[]): RepositoryResponse[] {
  return [...repositories].sort((left, right) => left.fullName.localeCompare(right.fullName));
}

function buildRepositoryOptions(repositories: RepositoryResponse[]): DashboardSelectOption[] {
  return [
    { value: 'all', label: 'All repositories' },
    ...sortRepositoriesAlphabetically(repositories).map((repository) => ({
      value: repository.fullName,
      label: repository.fullName,
    })),
  ];
}

function buildAuthorOptions(events: PullRequestEventResponse[]): DashboardSelectOption[] {
  const authorLabels = new Set<string>();

  events.forEach((event) => {
    authorLabels.add(event.author.username);
  });

  return [
    { value: 'all', label: 'All authors' },
    ...Array.from(authorLabels)
      .sort((left, right) => left.localeCompare(right))
      .map((author) => ({
        value: author,
        label: author,
      })),
  ];
}

function filterRepositories(
  repositories: RepositoryResponse[],
  repoFilter: DashboardFilters['repo']
): RepositoryResponse[] {
  const sortedRepositories = sortRepositoriesAlphabetically(repositories);

  if (repoFilter === 'all') {
    return sortedRepositories;
  }

  return sortedRepositories.filter((repository) => repository.fullName === repoFilter);
}

function filterEvents(
  events: PullRequestEventResponse[],
  filters: DashboardFilters,
  now: Date
): PullRequestEventResponse[] {
  return sortEventsNewestFirst(events).filter((event) => {
    const repoMatches = filters.repo === 'all' || event.repository.fullName === filters.repo;
    const authorMatches = filters.author === 'all' || event.author.username === filters.author;
    const windowMatches = isEventWithinWindow(event, filters.window, now);

    return repoMatches && authorMatches && windowMatches;
  });
}

function buildMetrics(
  filteredEvents: PullRequestEventResponse[],
  visibleRepositories: RepositoryResponse[]
): DashboardMetrics {
  const reviewingCount = filteredEvents.filter((event) => event.reviewStatus === 'reviewing').length;
  const reviewedCount = filteredEvents.filter((event) => event.reviewStatus === 'reviewed').length;
  const failedCount = filteredEvents.filter((event) => event.reviewStatus === 'failed').length;
  const idleCount = filteredEvents.filter((event) => event.reviewStatus === 'idle').length;

  return {
    connectedRepositoryCount: visibleRepositories.length,
    reviewingCount,
    reviewedCount,
    failedCount,
    idleCount,
    filteredEventCount: filteredEvents.length,
  };
}

function buildStatusSummary(metrics: DashboardMetrics): DashboardStatusSummary[] {
  return [
    {
      key: 'reviewing',
      label: 'In progress',
      description: 'PRs currently being processed by the review worker.',
      value: metrics.reviewingCount,
      tone: 'accent',
    },
    {
      key: 'reviewed',
      label: 'Reviewed',
      description: 'Review jobs that completed and posted back to GitHub.',
      value: metrics.reviewedCount,
      tone: 'positive',
    },
    {
      key: 'failed',
      label: 'Failed',
      description: 'Jobs that need retry or investigation.',
      value: metrics.failedCount,
      tone: 'danger',
    },
    {
      key: 'idle',
      label: 'Idle',
      description: 'Tracked PR events that are not in the active review pipeline.',
      value: metrics.idleCount,
      tone: 'muted',
    },
  ];
}

export function getGreeting(now: Date): string {
  const hours = now.getHours();

  if (hours < 12) {
    return 'Good morning';
  }

  if (hours < 18) {
    return 'Good afternoon';
  }

  return 'Good evening';
}

export function formatRelativeTime(dateString: string): string {
  const eventTime = new Date(dateString);
  const deltaMs = Date.now() - eventTime.getTime();
  const minutes = Math.max(1, Math.floor(deltaMs / 60000));

  if (minutes < 60) {
    return `${minutes}m ago`;
  }

  const hours = Math.floor(minutes / 60);

  if (hours < 24) {
    return `${hours}h ago`;
  }

  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function getWindowLabel(window: DashboardWindow): string {
  switch (window) {
    case '7d':
      return 'This week';
    case '30d':
      return 'Last 30 days';
    case 'all':
      return 'All time';
  }
}

export function buildDashboardViewModel({
  repositories,
  events,
  filters,
  now,
}: {
  repositories: RepositoryResponse[];
  events: PullRequestEventResponse[];
  filters: DashboardFilters;
  now: Date;
}): DashboardViewModel {
  const visibleRepositories = filterRepositories(repositories, filters.repo);
  const filteredEvents = filterEvents(events, filters, now);
  const metrics = buildMetrics(filteredEvents, visibleRepositories);

  return {
    filteredEvents,
    visibleRepositories,
    repositoryOptions: buildRepositoryOptions(repositories),
    authorOptions: buildAuthorOptions(events),
    metrics,
    statusSummary: buildStatusSummary(metrics),
  };
}

export type { DashboardMetrics, DashboardSelectOption, DashboardStatusSummary, DashboardViewModel };
