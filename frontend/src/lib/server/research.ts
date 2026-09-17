import 'server-only';
import type { PitchInput, PitchResult, PitchSource } from '@/types/pitch';

export interface SearchHit { title: string; url: string; content: string }
export interface SearchResponse { answer: string; results: SearchHit[]; available: boolean }

export function safeHttpUrl(value: unknown): value is string {
  if (typeof value !== 'string' || value.length > 2048) return false;
  try {
    const url = new URL(value);
    return (url.protocol === 'https:' || url.protocol === 'http:') && !url.username && !url.password;
  } catch { return false; }
}

export async function queryTavily(query: string, maxResults = 4): Promise<SearchResponse> {
  const apiKey = process.env.TAVILY_API_KEY?.trim();
  if (!apiKey) return { answer: '', results: [], available: false };
  try {
    const response = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ api_key: apiKey, query: query.slice(0, 500), search_depth: 'advanced', include_answer: true, max_results: maxResults }),
      signal: AbortSignal.timeout(12_000),
      cache: 'no-store',
    });
    if (!response.ok) return { answer: '', results: [], available: false };
    const data: unknown = await response.json();
    if (!data || typeof data !== 'object') return { answer: '', results: [], available: false };
    const record = data as Record<string, unknown>;
    const results: SearchHit[] = [];
    for (const value of Array.isArray(record.results) ? record.results.slice(0, maxResults) : []) {
      if (!value || typeof value !== 'object') continue;
      const item = value as Record<string, unknown>;
      if (!safeHttpUrl(item.url) || typeof item.content !== 'string' || !item.content.trim()) continue;
      results.push({ title: typeof item.title === 'string' ? item.title.slice(0, 250) : item.url, url: item.url, content: item.content.slice(0, 2400) });
    }
    return { answer: typeof record.answer === 'string' ? record.answer.slice(0, 5000) : '', results, available: true };
  } catch {
    return { answer: '', results: [], available: false };
  }
}

export async function researchPitch(input: PitchInput): Promise<Pick<PitchResult, 'sources' | 'researchStatus' | 'researchNote'>> {
  const topic = `${input.industry} ${input.idea || input.brief}`.replace(/\s+/g, ' ').slice(0, 300);
  const queries = [
    `${input.competition} ${input.round} ${input.mode === 'case' ? 'case competition' : 'pitch competition'} official brief judging rubric submission rules`.slice(0, 500),
    `${topic} market competitors customer adoption research data`,
    `${topic} unit economics costs pricing market size evidence`,
  ];
  const searches = await Promise.all(queries.map((query) => queryTavily(query, 3)));
  const retrievedAt = new Date().toISOString();
  const seen = new Set<string>();
  const sources: PitchSource[] = [];
  for (const search of searches) for (const hit of search.results) {
    if (seen.has(hit.url)) continue;
    seen.add(hit.url);
    sources.push({ id: `S${sources.length + 1}`, title: hit.title, url: hit.url, excerpt: hit.content, retrievedAt });
  }
  const complete = searches.every((search) => search.available && search.results.length > 0);
  const researchStatus = sources.length === 0 ? 'unavailable' : complete ? 'complete' : 'partial';
  const researchNote = researchStatus === 'complete'
    ? 'Searches returned evidence for competition context, market and economics. Search excerpts are leads, not independently verified facts; check each source’s geography, date and applicability.'
    : researchStatus === 'partial'
      ? 'Some searches failed or returned no usable sources. Unsupported claims must remain assumptions; verify the gaps before submitting.'
      : process.env.TAVILY_API_KEY?.trim()
        ? 'Web research returned no usable sources. This analysis uses only your brief and must not be treated as verified market research.'
        : 'Web research is not configured. This analysis uses only your brief; add evidence before submitting.';
  return { sources, researchStatus, researchNote };
}
