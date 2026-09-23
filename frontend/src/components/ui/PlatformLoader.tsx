'use client';

import React from 'react';

export function PlatformLoader({ label = 'Loading MU One' }: { label?: string }) {
  return (
    <div role="status" className="flex flex-col items-center justify-center gap-6 animate-in fade-in duration-500">
      <div className="relative flex items-center justify-center h-20 w-20">
        <div className="absolute inset-0 rounded-full border-t-2 border-b-2 border-[#f7d344] animate-[spin_2s_linear_infinite] opacity-80"></div>
        <div className="absolute inset-1.5 rounded-full border-r-2 border-l-2 border-white animate-[spin_1.5s_linear_reverse_infinite] opacity-40"></div>
        <div className="absolute inset-3 rounded-full border-t-2 border-[#f7d344] animate-pulse opacity-60"></div>
        <img src="/icons/icon-72.png" alt="MU One" className="h-7 w-7 object-contain animate-pulse rounded-md" />
      </div>
      <div className="flex flex-col items-center gap-2">
        <p className="text-sm font-semibold tracking-widest text-gray-300 uppercase animate-pulse">
          {label}
        </p>
        <div className="flex gap-1.5 mt-1">
          <span className="h-1.5 w-1.5 rounded-full bg-[#f7d344] animate-bounce" style={{ animationDelay: '0ms' }} />
          <span className="h-1.5 w-1.5 rounded-full bg-[#f7d344] animate-bounce" style={{ animationDelay: '150ms' }} />
          <span className="h-1.5 w-1.5 rounded-full bg-[#f7d344] animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
      </div>
    </div>
  );
}
