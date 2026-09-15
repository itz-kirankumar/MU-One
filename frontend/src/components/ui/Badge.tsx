'use client';

import React, { type ReactNode } from 'react';

type BadgeVariant = 'default' | 'warning' | 'error' | 'success' | 'accent';

interface BadgeProps {
  variant?: BadgeVariant;
  children: ReactNode;
  className?: string;
}

const variantClasses: Record<BadgeVariant, string> = {
  default: 'bg-[#222] text-gray-300 border border-[#2A2A2A]',
  warning: 'bg-yellow-900/30 text-yellow-400 border border-yellow-800/40',
  error:   'bg-red-900/30 text-red-400 border border-red-800/40',
  success: 'bg-green-900/30 text-green-400 border border-green-800/40',
  accent:  'bg-[#f7d344]/10 text-[#f7d344] border border-[#f7d344]/20',
};

export function Badge({ variant = 'default', children, className = '' }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium tracking-wide ${variantClasses[variant]} ${className}`}
    >
      {children}
    </span>
  );
}
