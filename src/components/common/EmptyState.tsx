import { ReactNode } from 'react';
import { Inbox } from 'lucide-react';

interface EmptyStateProps {
  icon?: ReactNode;
  title?: string;
  description?: string;
  action?: ReactNode;
}

export default function EmptyState({
  icon,
  title = '暂无数据',
  description,
  action,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="text-vintage-brown mb-4 opacity-50">
        {icon || <Inbox size={64} />}
      </div>
      <h3 className="text-lg font-bold text-vintage-dark mb-2">{title}</h3>
      {description && (
        <p className="text-vintage-brown mb-4 max-w-md">{description}</p>
      )}
      {action}
    </div>
  );
}
