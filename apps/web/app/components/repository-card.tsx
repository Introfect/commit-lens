import { ExternalLink, Lock, Unlock } from 'lucide-react';
import { Button } from './ui/button';
import type { RepositoryResponse } from '../types';

interface RepositoryCardProps {
  repository: RepositoryResponse;
  onDisconnect?: (id: string) => void;
}

export function RepositoryCard({ repository, onDisconnect }: RepositoryCardProps) {
  return (
    <div className="group p-6 rounded-2xl bg-[#2a2a2a] border border-white/10 hover:border-white/20 transition-all duration-200">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <h3 className="font-semibold text-white truncate">{repository.name}</h3>
            {repository.isPrivate ? (
              <Lock className="h-4 w-4 text-gray-500 flex-shrink-0" />
            ) : (
              <Unlock className="h-4 w-4 text-mint-500 flex-shrink-0" />
            )}
          </div>
          <p className="text-sm text-gray-500 mb-1 truncate">{repository.fullName}</p>
          {repository.description && (
            <p className="text-sm text-gray-400 line-clamp-2 mb-3">{repository.description}</p>
          )}
          <div className="text-xs text-gray-500">
            {repository.defaultBranch && `Default: ${repository.defaultBranch}`}
          </div>
        </div>
        <a
          href={repository.htmlUrl}
          target="_blank"
          rel="noreferrer"
          className="text-gray-500 hover:text-mint-500 transition-colors"
        >
          <ExternalLink className="h-5 w-5" />
        </a>
      </div>
      {onDisconnect && (
        <div className="mt-4 pt-4 border-t border-white/10">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onDisconnect(repository.id)}
            className="w-full text-red-500 hover:text-red-400 hover:bg-red-500/10"
          >
            Disconnect
          </Button>
        </div>
      )}
    </div>
  );
}
