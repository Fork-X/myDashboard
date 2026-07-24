import { ReactNode, useEffect } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg';
}

export default function Modal({ isOpen, onClose, title, children, size = 'md' }: ModalProps) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const sizeClasses = {
    sm: 'max-w-md',
    md: 'max-w-2xl',
    lg: 'max-w-4xl',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-vintage-dark bg-opacity-50" onClick={onClose} />
      <div className={`relative vintage-card w-full ${sizeClasses[size]} mx-4 max-h-[90vh] overflow-hidden`}>
        {title && (
          <div className="flex items-center justify-between px-6 py-4 border-b-2 border-dashed border-vintage-border">
            <h3 className="text-xl font-bold text-vintage-dark">{title}</h3>
            <button
              onClick={onClose}
              className="text-vintage-brown hover:text-vintage-red transition-colors"
            >
              <X size={24} />
            </button>
          </div>
        )}
        <div className="overflow-y-auto max-h-[calc(90vh-80px)] scrollbar-thin">
          {children}
        </div>
      </div>
    </div>
  );
}
