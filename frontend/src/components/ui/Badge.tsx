'use client';

import React, { type ReactNode } from 'react';

type BadgeVariant = 'default' | 'warning' | 'error' | 'success' | 'accent';

interface BadgeProps {
  variant?: BadgeVariant;
  children: ReactNode;
  className?: string;
}

const variantClasses: Record<BadgeVariant, string> = {
  default: 'bg-[#1E1E1E] text-gray-200 border border-[#333333]',
  warning: 'bg-[#1C180E] text-[#FCD34D] border border-[#785412]',
  error:   'bg-[#1C1214] text-[#FF6B6B] border border-[#7A282D]',
  success: 'bg-[#0E1C14] text-[#4ADE80] border border-[#166534]',
  accent:  'bg-[#1C1A0E] text-[#f7d344] border border-[#665200]',
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
