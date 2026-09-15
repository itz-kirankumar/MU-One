'use client';

import React from 'react';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  label?: string;
  className?: string;
}

const sizeMap = {
  sm: 'h-4 w-4 border-2',
  md: 'h-6 w-6 border-2',
  lg: 'h-10 w-10 border-2',
};

export function LoadingSpinner({ size = 'md', label, className = '' }: LoadingSpinnerProps) {
  return (
    <div
      role="status"
      aria-label={label ?? 'Loading'}
      className={`flex flex-col items-center justify-center gap-2 ${className}`}
    >
      <div
        className={`${sizeMap[size]} rounded-full border-[#2A2A2A] border-t-[#f7d344] animate-spin`}
        aria-hidden="true"
      />
      {label && (
        <span className="text-xs text-gray-400">{label}</span>
      )}
      <span className="sr-only">{label ?? 'Loading'}</span>
    </div>
  );
}
