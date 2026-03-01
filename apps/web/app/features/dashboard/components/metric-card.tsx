import type { LucideIcon } from 'lucide-react';
import { Panel } from '../../../shared/components/ui/panel';

type MetricCardProps = {
  icon: LucideIcon;
  label: string;
  value: string;
  description: string;
};

export function MetricCard({ icon: Icon, label, value, description }: MetricCardProps) {
  return (
    <Panel className="min-h-[230px] p-5">
      <div className="flex h-full flex-col">
        <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.22em] text-white/42">
          <Icon className="h-3.5 w-3.5 text-white/26" />
          <span>{label}</span>
        </div>

        <div className="mt-6">
          <p className="text-4xl font-semibold tracking-tight text-white lg:text-5xl">{value}</p>
        </div>

        <div className="flex flex-1 items-center justify-center">
          <p className="max-w-[18rem] text-center text-sm leading-6 text-white/36">{description}</p>
        </div>
      </div>
    </Panel>
  );
}
