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
      className={`vintage-card rounded-lg p-6 ${
        onClick ? 'cursor-pointer hover:shadow-lg transition-all' : ''
      } ${className}`}
      onClick={onClick}
    >
      {number && (
        <div className="vintage-number text-xs mb-2 opacity-60">
          NO.{number}
        </div>
      )}
      {children}
    </div>
  );
}
