import { Boxes, CalendarDays, ChevronDown, Github, RefreshCcw, Users } from 'lucide-react';
import { Button } from '../../../shared/components/ui/button';
import { Panel } from '../../../shared/components/ui/panel';
import type { DashboardSelectOption } from '../lib/dashboard-metrics';
import type { DashboardFilters } from '../schemas/dashboard-filter-schema';

type DashboardToolbarProps = {
  greeting: string;
  summary: string;
  isRefreshing: boolean;
  filters: DashboardFilters;
  repositoryOptions: DashboardSelectOption[];
  authorOptions: DashboardSelectOption[];
  onFiltersChange: (nextFilters: Partial<DashboardFilters>) => void;
  onPrimaryAction: () => void;
  primaryActionLabel: string;
};

type FilterSelectProps = {
  label: string;
  value: string;
  icon: typeof Boxes;
  options: DashboardSelectOption[];
  onChange: (value: string) => void;
};

function FilterSelect({ label, value, icon: Icon, options, onChange }: FilterSelectProps) {
  return (
    <div className="relative min-w-[180px]">
      <Icon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/34" />
      <select
        aria-label={label}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 w-full appearance-none reeeddddccc-xl border border-white/[0.08] bg-[#0f1214] pl-10 pr-9 text-sm text-white/74 outline-none transition focus:border-[#1e9f63]/45"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/28" />
    </div>
  );
}

const WINDOW_OPTIONS: DashboardSelectOption[] = [
  { value: '7d', label: 'This week' },
  { value: '30d', label: 'Last 30 days' },
  { value: 'all', label: 'All time' },
];

export function DashboardToolbar({
  greeting,
  summary,
  isRefreshing,
  filters,
  repositoryOptions,
  authorOptions,
  onFiltersChange,
  onPrimaryAction,
  primaryActionLabel,
}: DashboardToolbarProps) {
  return (
    <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
      <div>
        <p className="text-[11px] uppercase tracking-[0.24em] text-white/28">Home</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white lg:text-4xl">
          {greeting}
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-white/52">{summary}</p>
        {isRefreshing ? (
          <p className="mt-3 text-sm text-[#7af0b8]">Refreshing live review activity…</p>
        ) : null}
      </div>

      <div className="flex flex-col gap-3 xl:items-end">
        <div className="grid gap-3 md:grid-cols-3">
          <FilterSelect
            label="Filter repositories"
            icon={Boxes}
            value={filters.repo}
            options={repositoryOptions}
            onChange={(repo) => onFiltersChange({ repo })}
          />
          <FilterSelect
            label="Filter authors"
            icon={Users}
            value={filters.author}
            options={authorOptions}
            onChange={(author) => onFiltersChange({ author })}
          />
          <FilterSelect
            label="Filter time window"
            icon={CalendarDays}
            value={filters.window}
            options={WINDOW_OPTIONS}
            onChange={(window) => onFiltersChange({ window: window as DashboardFilters['window'] })}
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Panel as="div" className="flex items-center gap-2 px-3 py-2 text-sm text-white/48">
            <RefreshCcw className="h-4 w-4 text-white/28" />
            Live workspace
          </Panel>
          <Button onClick={onPrimaryAction} className="gap-2 reeeddddccc-xl px-4">
            <Github className="h-4 w-4" />
            {primaryActionLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
