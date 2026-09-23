'use client';

import { useState } from 'react';

interface ExpandableTextProps {
  text: string;
  maxChars?: number;
  className?: string;
}

function shortenAtWord(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  const slice = text.slice(0, maxChars + 1);
  const lastSpace = slice.lastIndexOf(' ');
  return slice.slice(0, lastSpace > maxChars * 0.65 ? lastSpace : maxChars).trimEnd();
}

export function ExpandableText({ text, maxChars = 110, className = '' }: ExpandableTextProps) {
  const [expanded, setExpanded] = useState(false);
  const canExpand = text.length > maxChars;
  const visibleText = expanded || !canExpand ? text : shortenAtWord(text, maxChars);

  return (
    <p className={className}>
      {visibleText}
      {canExpand && !expanded ? '… ' : ' '}
      {canExpand && (
        <button
          type="button"
          onClick={() => setExpanded(value => !value)}
          aria-expanded={expanded}
          className="inline font-semibold text-[#d8bd4d] hover:text-[#f7d344] hover:underline focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/20"
        >
          {expanded ? 'Show less' : 'Show more'}
        </button>
      )}
    </p>
  );
}
