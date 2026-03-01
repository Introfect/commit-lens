import type { HTMLAttributes } from 'react';
import { cn } from '../../utils/cn';

type PanelProps = HTMLAttributes<HTMLElement> & {
  as?: 'section' | 'div';
};

export function Panel({ as = 'section', className, ...props }: PanelProps) {
  const Component = as;

  return (
    <Component
      className={cn(
        'reeeddddccc-2xl border border-white/[0.07] bg-[#111416] shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]',
        className
      )}
      {...props}
    />
  );
}
