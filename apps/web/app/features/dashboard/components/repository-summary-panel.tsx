import { ExternalLink, GitBranch, Lock, Unlock } from 'lucide-react';
import { Button } from '../../../shared/components/ui/button';
import { Panel } from '../../../shared/components/ui/panel';
import type { AuthStatusResponse, RepositoryResponse } from '../../../types';

type RepositorySummaryPanelProps = {
  repositories: RepositoryResponse[];
  installation: AuthStatusResponse['installations'][number] | null;
  onPrimaryAction: () => void;
  onDisconnectInstallation: (installationId: string) => void;
  onRemoveRepository: (repositoryId: string) => void;
};

export function RepositorySummaryPanel({
  repositories,
  installation,
  onPrimaryAction,
  onDisconnectInstallation,
  onRemoveRepository,
}: RepositorySummaryPanelProps) {
  return (
    <Panel id="repositories" className="p-5 lg:p-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-[0.22em] text-white/36">Repositories</p>
          <h2 className="mt-3 text-xl font-semibold text-white">Connected repository access</h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-white/45">
            These repositories are currently visible through the active GitHub App installation.
          </p>
          {installation ? (
            <p className="mt-3 text-sm text-white/34">
              Active installation owner: <span className="text-white/62">@{installation.accountLogin}</span>
            </p>
          ) : null}
        </div>

        {installation ? (
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="outline" size="sm" onClick={onPrimaryAction} className="reeeddddccc-xl">
              Manage GitHub App access
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onDisconnectInstallation(installation.installationId)}
              className="reeeddddccc-xl border border-red-500/12 bg-red-500/8 px-3 text-red-200 hover:bg-red-500/12 hover:text-red-100"
            >
              Disconnect installation
            </Button>
          </div>
        ) : null}
      </div>

      {repositories.length === 0 ? (
        <div className="flex min-h-[240px] items-center justify-center text-center">
          <div>
            <p className="text-sm font-medium text-white/70">No repositories connected yet</p>
            <p className="mt-3 max-w-sm text-sm leading-6 text-white/40">
              Install or update the GitHub App access to bring repositories into this workspace.
            </p>
          </div>
        </div>
      ) : (
        <div className="mt-6 overflow-hidden reeeddddccc-2xl border border-white/[0.07]">
          {repositories.map((repository) => (
            <div
              key={repository.id}
              className="grid gap-4 border-b border-white/[0.07] bg-[#0f1214] px-4 py-4 last:border-b-0 lg:grid-cols-[minmax(0,1.5fr)_auto_auto]"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="truncate text-sm font-medium text-white">{repository.fullName}</p>
                  {repository.isPrivate ? (
                    <Lock className="h-3.5 w-3.5 text-white/34" />
                  ) : (
                    <Unlock className="h-3.5 w-3.5 text-[#8dffc7]" />
                  )}
                </div>
                <p className="mt-2 text-sm text-white/42">
                  {repository.description ?? 'No repository description provided.'}
                </p>
                <div className="mt-3 flex items-center gap-2 text-xs text-white/34">
                  <GitBranch className="h-3.5 w-3.5" />
                  <span>{repository.defaultBranch ?? 'No default branch recorded'}</span>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <a
                  href={repository.htmlUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex h-9 w-9 items-center justify-center reeeddddccc-xl border border-white/[0.07] bg-white/[0.03] text-white/46 transition hover:text-white"
                  aria-label={`Open ${repository.fullName} on GitHub`}
                >
                  <ExternalLink className="h-4 w-4" />
                </a>
              </div>

              <div className="flex items-center">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onRemoveRepository(repository.id)}
                  className="justify-center reeeddddccc-xl border border-red-500/12 bg-red-500/8 px-3 text-red-200 hover:bg-red-500/12 hover:text-red-100"
                >
                  Remove from workspace
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}
