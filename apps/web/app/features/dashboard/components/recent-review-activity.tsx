import type { ReactElement } from 'react';
import { AlertCircle, Bot, CheckCircle2, ExternalLink, GitBranch, GitPullRequest, Loader2 } from 'lucide-react';
import { Panel } from '../../../shared/components/ui/panel';
import type { PullRequestEventResponse } from '../../../types';
import { formatRelativeTime } from '../lib/dashboard-metrics';

type RecentReviewActivityProps = {
  events: PullRequestEventResponse[];
};

type ReviewStatusPresentation = {
  label: string;
  className: string;
  icon: ReactElement;
};

function getReviewStatusPresentation(
  status: PullRequestEventResponse['reviewStatus']
): ReviewStatusPresentation {
  switch (status) {
    case 'reviewing':
      return {
        label: 'Reviewing',
        className: 'border-blue-500/16 bg-blue-500/10 text-blue-200',
        icon: <Loader2 className="h-3.5 w-3.5 animate-spin" />,
      };
    case 'reviewed':
      return {
        label: 'Reviewed',
        className: 'border-emerald-500/16 bg-emerald-500/10 text-emerald-200',
        icon: <CheckCircle2 className="h-3.5 w-3.5" />,
      };
    case 'failed':
      return {
        label: 'Failed',
        className: 'border-red-500/16 bg-red-500/10 text-red-200',
        icon: <AlertCircle className="h-3.5 w-3.5" />,
      };
    case 'idle':
      return {
        label: 'Idle',
        className: 'border-white/[0.08] bg-white/[0.05] text-white/52',
        icon: <Bot className="h-3.5 w-3.5" />,
      };
  }
}

export function RecentReviewActivity({ events }: RecentReviewActivityProps) {
  return (
    <Panel id="activity" className="p-5 lg:p-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.22em] text-white/36">Recent review activity</p>
          <h2 className="mt-3 text-xl font-semibold text-white">Pull request intake</h2>
        </div>
        <GitPullRequest className="h-5 w-5 text-white/24" />
      </div>

      {events.length === 0 ? (
        <div className="flex min-h-[320px] items-center justify-center text-center">
          <div>
            <p className="text-sm font-medium text-white/70">No pull request activity yet</p>
            <p className="mt-3 max-w-sm text-sm leading-6 text-white/40">
              Activity appears here after repositories are connected and pull request webhooks start arriving.
            </p>
          </div>
        </div>
      ) : (
        <div className="mt-6 space-y-3">
          {events.slice(0, 6).map((event) => {
            const status = getReviewStatusPresentation(event.reviewStatus);

            return (
              <div
                key={event.id}
                className="reeeddddccc-xl border border-white/[0.07] bg-[#0f1214] px-4 py-4"
              >
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 flex h-9 w-9 items-center justify-center reeeddddccc-xl bg-white/[0.05] text-white/52">
                        <GitPullRequest className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <a
                          href={event.htmlUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="line-clamp-2 text-sm font-medium text-white transition hover:text-[#8dffc7]"
                        >
                          {event.title}
                        </a>
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-white/40">
                          <span>{event.repository.fullName}</span>
                          <span>&bull;</span>
                          <span>#{event.prNumber}</span>
                          <span>&bull;</span>
                          <span className="capitalize">{event.action}</span>
                          <span>&bull;</span>
                          <span>{formatRelativeTime(event.receivedAt)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-white/42">
                      <div className="flex items-center gap-2">
                        {event.author.avatarUrl ? (
                          <img
                            src={event.author.avatarUrl}
                            alt={event.author.username}
                            className="h-5 w-5 reeeddddccc-full"
                          />
                        ) : (
                          <div className="h-5 w-5 reeeddddccc-full bg-white/[0.08]" />
                        )}
                        <span>{event.author.username}</span>
                      </div>

                      <div className="flex items-center gap-2">
                        <GitBranch className="h-3.5 w-3.5" />
                        <span>
                          {event.headBranch} -&gt; {event.baseBranch}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div
                      className={`inline-flex items-center gap-2 reeeddddccc-full border px-3 py-1.5 text-xs ${status.className}`}
                    >
                      {status.icon}
                      <span>{status.label}</span>
                    </div>
                    <a
                      href={event.htmlUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="flex h-9 w-9 items-center justify-center reeeddddccc-xl border border-white/[0.07] bg-white/[0.03] text-white/46 transition hover:text-white"
                      aria-label={`Open ${event.title} on GitHub`}
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Panel>
  );
}
