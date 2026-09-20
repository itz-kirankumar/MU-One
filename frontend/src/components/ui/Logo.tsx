import React from 'react';

export function Logo({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <img 
      src="/logo-mu-one.png" 
      alt="MU One Logo" 
      className={className} 
    />
  );
}
