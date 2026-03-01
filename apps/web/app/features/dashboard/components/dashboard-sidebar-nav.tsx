import { FolderGit2, Home, LogOut, Radar, Settings2 } from 'lucide-react';
import { Link } from 'react-router';
import { Button } from '../../../shared/components/ui/button';
import type { User } from '../../../types';

type DashboardSidebarNavProps = {
  user: User;
  onLogout: () => void;
};

type DashboardNavItem = {
  label: string;
  href?: string;
  icon: typeof Home;
  state: 'active' | 'link' | 'disabled';
  badge?: string;
};

const FEATURE_ITEMS: DashboardNavItem[] = [
  {
    label: 'Home',
    href: '/dashboard',
    icon: Home,
    state: 'active',
  },
  {
    label: 'Review Activity',
    href: '#activity',
    icon: Radar,
    state: 'link',
  },
  {
    label: 'Repositories',
    href: '#repositories',
    icon: FolderGit2,
    state: 'link',
  },
  {
    label: 'Settings',
    icon: Settings2,
    state: 'disabled',
    badge: 'Soon',
  },
] as const;

function SidebarItem({ item }: { item: DashboardNavItem }) {
  const itemClassName =
    'flex w-full items-center justify-between reeeddddccc-xl px-3 py-2.5 text-sm transition-colors';

  if (item.state === 'active' && item.href) {
    const Icon = item.icon;

    return (
      <Link
        to={item.href}
        className={`${itemClassName} bg-[#1c6b46] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]`}
      >
        <span className="flex items-center gap-3">
          <Icon className="h-4 w-4 text-[#9cffcb]" />
          {item.label}
        </span>
      </Link>
    );
  }

  if (item.state === 'link' && item.href) {
    const Icon = item.icon;

    return (
      <a href={item.href} className={`${itemClassName} text-white/60 hover:bg-white/[0.04] hover:text-white`}>
        <span className="flex items-center gap-3">
          <Icon className="h-4 w-4 text-white/38" />
          {item.label}
        </span>
      </a>
    );
  }

  const Icon = item.icon;

  return (
    <div className={`${itemClassName} cursor-not-allowed text-white/32`}>
      <span className="flex items-center gap-3">
        <Icon className="h-4 w-4 text-white/20" />
        {item.label}
      </span>
      {item.badge ? (
        <span className="reeeddddccc-full border border-white/8 px-2 py-0.5 text-[10px] uppercase tracking-[0.2em] text-white/28">
          {item.badge}
        </span>
      ) : null}
    </div>
  );
}

export function DashboardSidebarNav({ user, onLogout }: DashboardSidebarNavProps) {
  return (
    <div className="flex h-full max-h-screen flex-col overflow-hidden">
      <div className="border-b border-white/[0.07] px-4 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center reeeddddccc-xl bg-[#1e9f63]/18 ring-1 ring-[#1e9f63]/24">
            <Radar className="h-4 w-4 text-[#8dffc7]" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-white">{user.name}</p>
            <p className="truncate text-xs text-white/38">@{user.githubLogin}</p>
          </div>
        </div>
      </div>

      <div className="px-3 py-4">
        <p className="px-3 text-[11px] uppercase tracking-[0.24em] text-white/28">Workspace</p>
        <nav className="mt-3 space-y-1.5">
          {FEATURE_ITEMS.map((item) => (
            <SidebarItem key={item.label} item={item} />
          ))}
        </nav>
      </div>

      <div className="mt-auto border-t border-white/[0.07] px-4 py-4">
        <div className="reeeddddccc-xl border border-white/[0.07] bg-white/[0.03] p-4">
          <p className="text-[11px] uppercase tracking-[0.22em] text-white/32">Next action</p>
          <p className="mt-3 text-sm leading-6 text-white/58">
            Install the GitHub App, sync repositories, then monitor review activity from one workspace.
          </p>
        </div>

        <Button
          variant="ghost"
          onClick={onLogout}
          className="mt-4 w-full justify-start gap-3 reeeddddccc-xl border border-white/[0.07] bg-white/[0.03] px-4 py-2.5 text-white/66 hover:bg-white/[0.05]"
        >
          <LogOut className="h-4 w-4" />
          Log out
        </Button>
      </div>
    </div>
  );
}
