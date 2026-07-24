import { Loader2 } from 'lucide-react';

interface LoadingProps {
  text?: string;
}

export default function Loading({ text = '加载中...' }: LoadingProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12">
      <Loader2 className="animate-spin text-vintage-red mb-4" size={40} />
      <p className="text-vintage-brown font-medium">{text}</p>
    </div>
  );
}
