import { AlertTriangle } from 'lucide-react';

export default function ErrorState({ message }: { message: string }) {
  return (
    <div className="vintage-card p-8 text-center">
      <AlertTriangle className="mx-auto mb-3 text-vintage-red" size={40} />
      <h3 className="font-bold text-vintage-dark">本地数据暂时不可用</h3>
      <p className="mt-2 text-sm text-vintage-brown">{message}</p>
    </div>
  );
}
