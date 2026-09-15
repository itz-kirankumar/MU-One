'use client';

import React, { type ReactNode } from 'react';
import { type LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ icon: Icon, title, description, action, className = '' }: EmptyStateProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center gap-3 py-10 text-center ${className}`}
    >
      {Icon && (
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#1A1A1A] border border-[#2A2A2A]">
          <Icon className="h-5 w-5 text-gray-500" aria-hidden="true" />
        </div>
      )}
      <p className="text-sm font-medium text-gray-300">{title}</p>
      {description && (
        <p className="max-w-xs text-xs text-gray-500">{description}</p>
      )}
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}
