import type { ReactNode } from 'react';
import Card from './Card';
import EmptyState from './EmptyState';

interface ComingSoonProps {
  moduleName: string;
  icon: ReactNode;
}

export default function ComingSoon({ moduleName, icon }: ComingSoonProps) {
  return (
    <div className="p-8">
      <div className="max-w-4xl mx-auto">
        <Card number="待设计">
          <EmptyState
            icon={icon}
            title="功能待设计"
            description={`${moduleName}尚未定义业务数据与操作规则。`}
          />
        </Card>
      </div>
    </div>
  );
}
