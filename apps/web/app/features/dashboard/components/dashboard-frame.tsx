import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { Radar } from 'lucide-react';
import { api } from '../../../core/api/client';
import { Button } from '../../../shared/components/ui/button';
import type { User } from '../../../types';
import { DashboardSidebarNav } from './dashboard-sidebar-nav';

type DashboardFrameProps = {
  children: ReactNode;
  user: User;
};

export function DashboardFrame({ children, user }: DashboardFrameProps) {
  return (
    <div className="h-screen overflow-hidden bg-[#0b0d0f] text-white">
      <div className="grid h-screen lg:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="hidden h-screen max-h-screen overflow-hidden border-r border-white/[0.07] bg-[#101315] lg:block">
          <DashboardSidebarNav user={user} onLogout={() => api.logout()} />
        </aside>

        <main className="dashboard-grid-surface min-w-0 overflow-y-auto">
          <div className="border-b border-white/[0.06] px-4 py-4 lg:hidden">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <div className="flex h-9 w-9 items-center justify-center reeeddddccc-xl bg-[#1e9f63]/18 ring-1 ring-[#1e9f63]/24">
                    <Radar className="h-4 w-4 text-[#8dffc7]" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white">{user.name}</p>
                    <p className="text-xs text-white/38">@{user.githubLogin}</p>
                  </div>
                </div>
              </div>

              <Button variant="ghost" size="sm" onClick={() => api.logout()}>
                Log out
              </Button>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <Link
                to="/dashboard"
                className="reeeddddccc-xl bg-[#1c6b46] px-3 py-2 text-sm font-medium text-white"
              >
                Home
              </Link>
              <a
                href="#activity"
                className="reeeddddccc-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm text-white/64"
              >
                Review Activity
              </a>
              <a
                href="#repositories"
                className="reeeddddccc-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm text-white/64"
              >
                Repositories
              </a>
            </div>
          </div>

          <div className="px-4 py-6 lg:px-8 lg:py-8 xl:px-10">{children}</div>
        </main>
      </div>
    </div>
  );
}
