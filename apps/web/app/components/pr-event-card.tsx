import { GitPullRequest, GitMerge, ExternalLink, GitBranch, Bot, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { buttonVariants } from './ui/button';
import type { PullRequestEventResponse } from '../types';

interface PREventCardProps {
  event: PullRequestEventResponse;
}

export function PREventCard({ event }: PREventCardProps) {
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  const getActionColor = (action: string) => {
    switch (action) {
      case 'opened':
        return 'bg-mint-100 text-mint-700';
      case 'synchronize':
        return 'bg-blue-100 text-blue-700';
      case 'closed':
        return event.merged ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const getIcon = () => {
    if (event.merged) {
      return <GitMerge className="h-5 w-5" />;
    }
    return <GitPullRequest className="h-5 w-5" />;
  };

  const getReviewStatusDisplay = () => {
    switch (event.reviewStatus) {
      case 'reviewing':
        return {
          icon: <Loader2 className="h-4 w-4 animate-spin" />,
          text: 'Bot is reviewing this PR...',
          color: 'text-blue-400',
          bgColor: 'bg-blue-500/10'
        };
      case 'reviewed':
        return {
          icon: <CheckCircle className="h-4 w-4" />,
          text: 'AI reviewed',
          color: 'text-green-400',
          bgColor: 'bg-green-500/10'
        };
      case 'failed':
        return {
          icon: <AlertCircle className="h-4 w-4" />,
          text: 'Review failed',
          color: 'text-red-400',
          bgColor: 'bg-red-500/10'
        };
      default:
        return null;
    }
  };

  const reviewStatus = getReviewStatusDisplay();

  return (
    <div className="group p-6 reeeddddccc-2xl bg-[#2a2a2a] border border-white/10 hover:border-white/20 transition-all duration-200">
      <div className="flex items-start gap-4">
        {/* Icon */}
        <div className={`mt-1 p-2.5 reeeddddccc-xl ${getActionColor(event.action)}`}>
          {getIcon()}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Title and Time */}
          <div className="flex items-start justify-between gap-4 mb-2">
            <a
              href={event.htmlUrl}
              target="_blank"
              rel="noreferrer"
              className="font-semibold text-white hover:text-mint-400 transition-colors line-clamp-2 flex-1"
            >
              {event.title}
            </a>
            <span className="text-xs text-gray-500 whitespace-nowrap">
              {formatDate(event.receivedAt)}
            </span>
          </div>

          {/* Repository and PR Number */}
          <div className="flex items-center gap-2 text-sm text-gray-400 mb-3">
            <span className="font-medium">{event.repository.fullName}</span>
            <span className="text-gray-600">•</span>
            <span>#{event.prNumber}</span>
            <span className="text-gray-600">•</span>
            <span className="capitalize">{event.action}</span>
            {reviewStatus && (
              <div className={`flex items-center gap-1 px-2 py-0.5 reeeddddccc-full text-xs ${reviewStatus.bgColor} ${reviewStatus.color}`}>
                <Bot className="h-3 w-3" />
                {reviewStatus.icon}
                <span>{reviewStatus.text}</span>
              </div>
            )}
          </div>

          {/* Author and Branches */}
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-2">
              {event.author.avatarUrl && (
                <img
                  src={event.author.avatarUrl}
                  alt={event.author.username}
                  className="h-5 w-5 reeeddddccc-full ring-2 ring-white/10"
                />
              )}
              <span className="text-gray-400">{event.author.username}</span>
            </div>
            <div className="flex items-center gap-2 text-gray-500">
              <GitBranch className="h-4 w-4" />
              <span className="truncate">{event.headBranch}</span>
              <span>→</span>
              <span className="truncate">{event.baseBranch}</span>
            </div>
          </div>
        </div>

        {/* External Link Button */}
        <a
          href={event.htmlUrl}
          target="_blank"
          rel="noreferrer"
          className={`${buttonVariants({ variant: 'ghost', size: 'icon' })} opacity-0 group-hover:opacity-100 transition-opacity`}
          aria-label={`Open pull request ${event.title} on GitHub`}
        >
          <ExternalLink className="h-4 w-4 text-gray-400" />
        </a>
      </div>
    </div>
  );
}
