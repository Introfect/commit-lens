import { Clock, Folder } from 'lucide-react';
import { Button } from './ui/button';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  const Icon = icon || <Folder className="h-12 w-12" />;

  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="rounded-3xl border-2 border-dashed border-white/10 bg-white/5 p-12">
        <div className="mx-auto mb-4 text-gray-600">
          {Icon}
        </div>
        <h3 className="text-lg font-semibold text-white mb-2">{title}</h3>
        <p className="text-sm text-gray-400 mb-6 max-w-sm">{description}</p>
        {action && (
          <Button
            onClick={action.onClick}
            size="lg"
            className="bg-mint-500 hover:bg-mint-600 text-white"
          >
            {action.label}
          </Button>
        )}
      </div>
    </div>
  );
}
