import { ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
  number?: string;
}

export default function Card({ children, className = '', onClick, number }: CardProps) {
  return (
    <div
      className={`vintage-card rounded-lg p-6 relative ${
        onClick ? 'cursor-pointer hover:shadow-lg transition-all' : ''
      } ${className}`}
      onClick={onClick}
    >
      {number && (
        <>
          <div className="vintage-number text-xs mb-2 opacity-60">
            NO.{number}
          </div>
          <div className="absolute top-2 right-2 w-8 h-8 border-2 border-dashed border-vintage-border rounded-full opacity-30"></div>
        </>
      )}
      {children}
    </div>
  );
}
