import { LogOut } from 'lucide-react';
import { Button } from '../../../shared/components/ui/button';
import type { User } from '../../../types';

type SessionUserSummaryProps = {
  user: User;
  onLogout: () => void;
};

function getInitials(user: User): string {
  const parts = user.name.trim().split(/\s+/).filter(Boolean);

  if (parts.length === 0) {
    return user.githubLogin.slice(0, 2).toUpperCase();
  }

  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

export function SessionUserSummary({ user, onLogout }: SessionUserSummaryProps) {
  return (
    <div className="flex items-center gap-3 reeeddddccc-2xl border border-white/10 bg-white/[0.04] p-3">
      {user.avatarUrl ? (
        <img
          src={user.avatarUrl}
          alt={user.name}
          className="h-11 w-11 reeeddddccc-2xl object-cover ring-1 ring-white/10"
        />
      ) : (
        <div className="flex h-11 w-11 items-center justify-center reeeddddccc-2xl bg-[#16975f]/15 text-sm font-semibold text-[#7af0b8]">
          {getInitials(user)}
        </div>
      )}

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-white">{user.name}</p>
        <p className="truncate text-sm text-white/48">@{user.githubLogin}</p>
      </div>

      <Button
        variant="ghost"
        size="icon"
        onClick={onLogout}
        className="text-white/48 hover:bg-white/8 hover:text-white"
        aria-label="Log out"
      >
        <LogOut className="h-4 w-4" />
      </Button>
    </div>
  );
}
