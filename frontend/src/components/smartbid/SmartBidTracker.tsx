'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  ArrowUpRight,
  Pencil,
  CheckCircle2,
  ChevronDown,
  Clock,
  ExternalLink,
  Gauge,
  Layers,
  RefreshCw,
  Sparkles,
  Target,
  TrendingUp,
  Users,
  XCircle,
} from 'lucide-react';
import { Logo } from '@/components/ui/Logo';
import {
  CONCENTRATIONS,
  CONCENTRATION_PAIRS,
  MAX_ELECTIVE_CREDITS,
  POINTS_PER_CREDIT_GUIDE,
  POINTS_RESERVE,
  SMARTBID_DEADLINE_ISO,
  SMARTBID_FORM_URL,
  SMARTBID_SHEET_URL,
  rankForBid,
  type Concentration,
  type CourseStats,
  type FillStatus,
  type SmartBidError,
  type SmartBidPayload,
} from '@/lib/smartbid';

const REFRESH_MS = 15_000;
const STALE_MS = 60_000;
const DEADLINE = new Date(SMARTBID_DEADLINE_ISO).getTime();

const fmt = (n: number, digits = 0) =>
  (Number.isFinite(n) ? n : 0).toLocaleString('en-IN', { maximumFractionDigits: digits, minimumFractionDigits: 0 });
const pct = (n: number) => `${(n * 100).toFixed(n < 0.1 ? 1 : 0)}%`;

// ─── Data hook ───────────────────────────────────────────────────────────────

type SyncState = 'loading' | 'live' | 'syncing' | 'stale' | 'error' | 'final';

function useSmartBid() {
  const [data, setData] = useState<SmartBidPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [lastOk, setLastOk] = useState<number | null>(null);
  // 0 until mounted, so server and client render the same markup.
  const [now, setNow] = useState(0);
  const busy = useRef(false);
  // Once the API serves the frozen final results there is nothing left to poll.
  const isFinal = useRef(false);

  const refresh = useCallback(async () => {
    if (busy.current || isFinal.current) return;
    busy.current = true;
    setSyncing(true);
    try {
      const res = await fetch('/api/smartbid', { cache: 'no-store' });
      const body = (await res.json()) as SmartBidPayload | SmartBidError;
      if (!body.ok) throw new Error(body.error);
      if (body.final) isFinal.current = true;
      setData(body);
      setError(null);
      setLastOk(Date.now());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not reach the sheet');
    } finally {
      busy.current = false;
      setSyncing(false);
    }
  }, []);

  useEffect(() => {
    const first = setTimeout(() => {
      setNow(Date.now());
      void refresh();
    }, 0);
    const poll = setInterval(() => {
      if (document.visibilityState === 'visible') void refresh();
    }, REFRESH_MS);
    const onVisible = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    document.addEventListener('visibilitychange', onVisible);
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      clearTimeout(first);
      clearInterval(poll);
      clearInterval(tick);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [refresh]);

  const dataAge = data && now ? Math.max(0, now - new Date(data.fetchedAt).getTime()) : null;
  let state: SyncState = 'loading';
  // Background refreshes keep the "Live" label; only the refresh icon spins.
  if (!data) state = error ? 'error' : 'loading';
  else if (data.final) state = 'final';
  else if (error || (dataAge != null && dataAge > STALE_MS)) state = 'stale';
  else state = 'live';

  return { data, error, state, syncing, refresh, now, lastOk, dataAge };
}

// ─── Small UI pieces ─────────────────────────────────────────────────────────

function Card({ className = '', children }: { className?: string; children: React.ReactNode }) {
  return <div className={`rounded-xl border border-[#222] bg-[#161616] ${className}`}>{children}</div>;
}

function SectionTitle({ icon: Icon, title, sub }: { icon: React.ElementType; title: string; sub?: string }) {
  return (
    <div className="mb-3 flex items-start gap-2.5">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-[#f7d344]" aria-hidden="true" />
      <div>
        <h2 className="text-sm font-semibold text-white">{title}</h2>
        {sub && <p className="mt-0.5 text-xs text-gray-500">{sub}</p>}
      </div>
    </div>
  );
}

function ConcBadge({ c }: { c: Concentration }) {
  const { color } = CONCENTRATIONS[c];
  return (
    <span
      className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold tracking-wide"
      style={{ color, background: `${color}14`, border: `1px solid ${color}40` }}
    >
      {c}
    </span>
  );
}

const STATUS_STYLE: Record<FillStatus, { label: string; cls: string; bar: string }> = {
  open: { label: 'Seats open', cls: 'bg-[#0E1C14] text-[#4ADE80] border-[#166534]', bar: 'bg-[#4ADE80]' },
  filling: { label: 'Filling up', cls: 'bg-[#1C180E] text-[#FCD34D] border-[#785412]', bar: 'bg-[#FCD34D]' },
  oversubscribed: {
    label: 'Oversubscribed',
    cls: 'bg-[#1C1214] text-[#FF6B6B] border-[#7A282D]',
    bar: 'bg-[#FF6B6B]',
  },
};

function StatusBadge({ s }: { s: FillStatus }) {
  const st = STATUS_STYLE[s];
  return (
    <span className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-medium ${st.cls}`}>
      {st.label}
    </span>
  );
}

function LiveStatus({
  state,
  syncing,
  dataAge,
  error,
  onRefresh,
}: {
  state: SyncState;
  syncing: boolean;
  dataAge: number | null;
  error: string | null;
  onRefresh: () => void;
}) {
  const ageText =
    dataAge == null ? '' : dataAge < 10_000 ? 'just now' : dataAge < 60_000 ? `${Math.floor(dataAge / 1000)}s ago` : `${Math.floor(dataAge / 60_000)}m ago`;
  const map: Record<SyncState, { dot: string; text: string; label: string }> = {
    loading: { dot: 'bg-gray-500', text: 'text-gray-400', label: 'Connecting to sheet…' },
    syncing: { dot: 'bg-[#f7d344] animate-pulse', text: 'text-[#f7d344]', label: 'Syncing…' },
    live: { dot: 'bg-[#4ADE80] animate-pulse', text: 'text-[#4ADE80]', label: 'Live' },
    stale: { dot: 'bg-[#FCD34D]', text: 'text-[#FCD34D]', label: 'Showing last snapshot' },
    error: { dot: 'bg-[#FF6B6B]', text: 'text-[#FF6B6B]', label: 'Sheet unreachable' },
    final: { dot: 'bg-[#f7d344]', text: 'text-[#f7d344]', label: 'Final results' },
  };
  const m = map[state];
  if (state === 'final') {
    return (
      <div className="inline-flex items-center gap-2 rounded-full border border-[#2A2A2A] bg-[#111] px-3 py-1.5 text-xs" role="status">
        <span className={`h-2 w-2 rounded-full ${m.dot}`} aria-hidden="true" />
        <span className={`font-medium ${m.text}`}>{m.label}</span>
        <span className="text-gray-500">· bidding closed 7 Nov, 11:59 PM IST</span>
      </div>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div
        className="inline-flex items-center gap-2 rounded-full border border-[#2A2A2A] bg-[#111] px-3 py-1.5 text-xs"
        role="status"
        aria-live="polite"
        title={error ?? undefined}
      >
        <span className={`h-2 w-2 rounded-full ${m.dot}`} aria-hidden="true" />
        <span className={`font-medium ${m.text}`}>{m.label}</span>
        {ageText && <span className="text-gray-500">· updated {ageText}</span>}
        <span className="hidden text-gray-600 sm:inline">· auto-refresh 15s</span>
      </div>
      <button
        onClick={onRefresh}
        disabled={syncing}
        className="inline-flex items-center gap-1.5 rounded-full border border-[#2A2A2A] bg-[#111] px-3 py-1.5 text-xs text-gray-300 transition-colors hover:border-[#f7d344]/50 hover:text-white disabled:opacity-50"
      >
        <RefreshCw className={`h-3 w-3 ${syncing ? 'animate-spin' : ''}`} aria-hidden="true" />
        Refresh
      </button>
    </div>
  );
}

/** Frame-accurate clock so the milliseconds actually tick; isolated to this component. */
function useFrameClock() {
  const [now, setNow] = useState(0);
  useEffect(() => {
    let raf = 0;
    const loop = () => {
      setNow(Date.now());
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);
  return now;
}

function Countdown() {
  const now = useFrameClock();
  const left = DEADLINE - now;
  if (!now) return <div className="h-[70px] w-full sm:h-[86px] sm:w-[260px]" aria-hidden="true" />;
  if (left <= 0) {
    return (
      <div className="flex items-center gap-2 text-sm text-[#FF6B6B]">
        <XCircle className="h-4 w-4" aria-hidden="true" /> Bidding window closed · 7 Nov, 11:59 PM IST
      </div>
    );
  }
  const h = Math.floor(left / 3_600_000);
  const m = Math.floor((left % 3_600_000) / 60_000);
  const s = Math.floor((left % 60_000) / 1000);
  const ms = Math.floor(left % 1000);
  const units = [
    [String(h).padStart(2, '0'), 'hrs'],
    [String(m).padStart(2, '0'), 'min'],
    [String(s).padStart(2, '0'), 'sec'],
    [String(ms).padStart(3, '0'), 'ms'],
  ] as const;
  return (
    <div>
      <p className="mb-1.5 flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-gray-500 sm:mb-2 sm:text-[11px]">
        <Clock className="h-3 w-3" aria-hidden="true" /> Bidding closes 7 Nov · 11:59 PM IST
      </p>
      <div className="grid grid-cols-4 gap-1.5 sm:flex sm:gap-2">
        {units.map(([v, l]) => (
          <div
            key={l}
            className="rounded-lg border border-[#2A2A2A] bg-[#111] px-1 py-1 text-center sm:min-w-[58px] sm:px-2 sm:py-1.5"
          >
            <div
              className={`text-lg font-bold tabular-nums sm:text-xl ${
                l === 'ms' ? 'text-[#f7d344]' : h < 2 ? 'text-[#FF6B6B]' : 'text-white'
              }`}
            >
              {v}
            </div>
            <div className="text-[10px] uppercase text-gray-500">{l}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Kpi({ label, value, sub, loading }: { label: string; value: string; sub?: string; loading: boolean }) {
  return (
    <Card className="min-w-0 px-2.5 py-2 sm:px-4 sm:py-3.5">
      <p className="truncate text-[9px] uppercase tracking-wider text-gray-500 sm:text-[11px]">{label}</p>
      {loading ? (
        <div className="mt-1.5 h-6 w-12 animate-pulse rounded bg-[#2A2A2A] sm:mt-2 sm:h-7 sm:w-16" />
      ) : (
        <p className="mt-0.5 text-lg font-bold tabular-nums text-white sm:mt-1 sm:text-2xl">{value}</p>
      )}
      {sub && !loading && <p className="mt-0.5 hidden truncate text-xs text-gray-500 sm:block">{sub}</p>}
    </Card>
  );
}

// ─── Course card ─────────────────────────────────────────────────────────────

const BRACKETS: [number, number, string][] = [
  [1, 100, '1–100'],
  [101, 250, '101–250'],
  [251, 500, '251–500'],
  [501, 750, '501–750'],
  [751, 1000, '751–1k'],
  [1001, 2000, '1k–2k'],
  [2001, Infinity, '2k+'],
];

function bracketCounts(bids: number[]) {
  return BRACKETS.map(([lo, hi, label]) => ({ label, n: bids.filter((b) => b >= lo && b <= hi).length }));
}

function Histogram({ bids, color }: { bids: number[]; color: string }) {
  const counts = bracketCounts(bids);
  const max = Math.max(1, ...counts.map((c) => c.n));
  return (
    <div className="flex h-28 items-end gap-1.5" role="img" aria-label="Bid distribution by points bracket">
      {counts.map((c) => (
        <div key={c.label} className="flex flex-1 flex-col items-center gap-1">
          <span className="text-[10px] tabular-nums text-gray-400">{c.n || ''}</span>
          <div
            className="w-full rounded-t"
            style={{ height: `${(c.n / max) * 72}px`, minHeight: c.n ? 3 : 0, background: color, opacity: 0.85 }}
          />
          <span className="whitespace-nowrap text-[9px] text-gray-500">{c.label}</span>
        </div>
      ))}
    </div>
  );
}

function FacultyLinks({ faculty }: { faculty: CourseStats['faculty'] }) {
  return (
    <>
      {faculty.map((f) =>
        f.linkedin ? (
          <a
            key={f.name}
            href={f.linkedin}
            target="_blank"
            rel="noopener noreferrer"
            title={`${f.name} on LinkedIn`}
            className="inline-flex items-center gap-0.5 whitespace-nowrap text-[11px] font-normal text-gray-400 underline decoration-[#333] underline-offset-2 hover:text-[#f7d344] hover:decoration-[#f7d344]"
          >
            {f.name}
            <ArrowUpRight className="h-3 w-3" aria-hidden="true" />
          </a>
        ) : (
          <span key={f.name} className="whitespace-nowrap text-[11px] font-normal text-gray-400">
            {f.name}
          </span>
        ),
      )}
    </>
  );
}

function CourseCard({ c, open, onToggle }: { c: CourseStats; open: boolean; onToggle: () => void }) {
  const { color } = CONCENTRATIONS[c.concentration];
  const st = STATUS_STYLE[c.status];
  return (
    <Card className="flex flex-col overflow-hidden transition-colors hover:border-[#2A2A2A]">
      <div className="h-0.5" style={{ background: color }} />
      <div className="flex flex-1 flex-col gap-2.5 p-3 sm:gap-3 sm:p-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <ConcBadge c={c.concentration} />
            <span className="text-[10px] text-gray-500">
              {c.code} · {c.credits} cr
            </span>
          </div>
          <StatusBadge s={c.status} />
        </div>

        <h3 className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-[15px] font-semibold leading-snug text-white">
          <span>{c.name}</span>
          <FacultyLinks faculty={c.faculty} />
        </h3>

        <div>
          <div className="mb-1 flex justify-between text-xs">
            <span className="text-gray-400">
              <span className="font-semibold tabular-nums text-white">{c.count}</span> /{' '}
              <span className="tabular-nums">{c.capacity}</span> seats
              <span className="text-gray-600">
                {' · '}
                {c.status === 'oversubscribed' ? `${c.count - c.capacity} over` : `${c.seatsLeft} left`}
              </span>
            </span>
            <span className="tabular-nums text-gray-400">{pct(c.fill)}</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-[#222]">
            <div className={`h-full rounded-full ${st.bar}`} style={{ width: `${Math.min(100, c.fill * 100)}%` }} />
          </div>
        </div>

        <dl className="grid grid-cols-4 gap-1.5 text-center sm:gap-2">
          {[
            ['Median', c.median],
            ['Avg', c.avg],
            ['Min', c.min],
            ['Max', c.max],
          ].map(([l, v]) => (
            <div key={l as string} className="rounded-lg bg-[#111] px-1 py-1 sm:py-1.5">
              <dt className="text-[10px] text-gray-500">{l}</dt>
              <dd className="text-[13px] font-semibold tabular-nums text-white sm:text-sm">
                {c.count ? fmt(v as number) : '—'}
              </dd>
            </div>
          ))}
        </dl>

        <div className="mt-auto flex items-stretch gap-2">
          <div className="flex flex-1 items-center justify-between gap-2 rounded-lg border border-[#2A2A2A] bg-[#111] px-2.5 py-1.5 sm:px-3 sm:py-2">
            <span className="text-xs text-gray-400">Cutoff</span>
            {c.cutoff == null ? (
              <span className="text-right text-xs font-semibold text-[#4ADE80]">None · any bid &gt; 0 gets in</span>
            ) : (
              <span className="text-sm font-bold tabular-nums text-[#FF6B6B]">Beat {fmt(c.cutoff)} pts</span>
            )}
          </div>
          <button
            onClick={onToggle}
            aria-expanded={open}
            aria-label={`${open ? 'Hide' : 'Show'} bid distributions`}
            title={`${open ? 'Hide' : 'Show'} bid distributions`}
            className={`flex items-center gap-1 rounded-lg border px-2.5 text-xs transition-colors ${
              open ? 'border-[#f7d344]/60 bg-[#1C1A0E] text-[#f7d344]' : 'border-[#2A2A2A] bg-[#111] text-gray-400 hover:text-white'
            }`}
          >
            <span className="hidden sm:inline">Bids</span>
            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
          </button>
        </div>

        {open && (
          <div className="space-y-2.5 border-t border-[#222] pt-2.5">
            <Histogram bids={c.bids} color={color} />
            <div className="grid grid-cols-3 gap-2 text-center text-[11px]">
              <div>
                <p className="text-gray-500">25th pct</p>
                <p className="tabular-nums text-white">{fmt(c.p25)}</p>
              </div>
              <div>
                <p className="text-gray-500">75th pct</p>
                <p className="tabular-nums text-white">{fmt(c.p75)}</p>
              </div>
              <div>
                <p className="text-gray-500">Entered 0</p>
                <p className="tabular-nums text-white">{c.zeroBids}</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}

// ─── Concentration split ─────────────────────────────────────────────────────

function ConcentrationSplit({ data }: { data: SmartBidPayload }) {
  return (
    <Card className="p-3 sm:p-4">
      <SectionTitle icon={Layers} title="Concentration choices" sub="From every form response" />
      <div className="space-y-4">
        {CONCENTRATION_PAIRS.map(([a, b]) => {
          const na = data.concentrationSplit[a];
          const nb = data.concentrationSplit[b];
          const total = na + nb || 1;
          return (
            <div key={a}>
              <div className="mb-1.5 flex justify-between text-xs">
                <span style={{ color: CONCENTRATIONS[a].color }}>
                  {CONCENTRATIONS[a].name} · <span className="tabular-nums">{na}</span>
                </span>
                <span style={{ color: CONCENTRATIONS[b].color }}>
                  <span className="tabular-nums">{nb}</span> · {CONCENTRATIONS[b].name}
                </span>
              </div>
              <div className="flex h-2 overflow-hidden rounded-full bg-[#222]">
                <div style={{ width: `${(na / total) * 100}%`, background: CONCENTRATIONS[a].color }} />
                <div style={{ width: `${(nb / total) * 100}%`, background: CONCENTRATIONS[b].color }} />
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

// ─── Clearing table ──────────────────────────────────────────────────────────

function ClearingTable({ courses, final }: { courses: CourseStats[]; final?: boolean }) {
  return (
    <Card className="overflow-hidden">
      <div className="p-3 pb-1 sm:p-4 sm:pb-2">
        <SectionTitle
          icon={Gauge}
          title="Seats vs bids"
          sub={
            final
              ? 'Cutoff = the lowest bid that holds a seat in the final sheet. Only exists where bids exceed seats.'
              : 'Cutoff = the bid holding the last seat if bidding closed now. Only exists once bids exceed seats.'
          }
        />
      </div>
      <table className="w-full text-xs sm:text-sm">
        <thead>
          <tr className="border-y border-[#222] text-left text-[10px] uppercase tracking-wider text-gray-500 sm:text-[11px]">
            <th className="px-3 py-2 font-medium sm:px-4">Course</th>
            <th className="px-2 py-2 text-right font-medium sm:px-3">Bids/Seats</th>
            <th className="hidden px-3 py-2 text-right font-medium sm:table-cell">Median</th>
            <th className="hidden px-3 py-2 text-right font-medium sm:table-cell">Lowest</th>
            <th className="px-2 py-2 text-right font-medium sm:px-3">Cutoff</th>
            <th className="hidden px-4 py-2 text-right font-medium sm:table-cell">Status</th>
          </tr>
        </thead>
        <tbody>
          {[...courses]
            .sort((a, b) => b.fill - a.fill)
            .map((c) => (
              <tr key={c.code} className="border-b border-[#1E1E1E] last:border-0">
                <td className="px-3 py-2 sm:px-4 sm:py-2.5">
                  <div className="flex items-center gap-2">
                    <span
                      className="h-2 w-2 shrink-0 rounded-full sm:hidden"
                      style={{ background: CONCENTRATIONS[c.concentration].color }}
                      aria-hidden="true"
                    />
                    <span className="hidden sm:inline-flex">
                      <ConcBadge c={c.concentration} />
                    </span>
                    <span className="text-white">{c.name}</span>
                  </div>
                </td>
                <td className="whitespace-nowrap px-2 py-2 text-right tabular-nums text-gray-300 sm:px-3 sm:py-2.5">
                  {c.count}/{c.capacity}
                  <span className="block text-[10px] text-gray-500 sm:hidden">{pct(c.fill)}</span>
                </td>
                <td className="hidden px-3 py-2.5 text-right tabular-nums text-gray-300 sm:table-cell">
                  {c.count ? fmt(c.median) : '—'}
                </td>
                <td className="hidden px-3 py-2.5 text-right tabular-nums text-gray-300 sm:table-cell">
                  {c.count ? fmt(c.min) : '—'}
                </td>
                <td className="px-2 py-2 text-right font-semibold tabular-nums sm:px-3 sm:py-2.5">
                  {c.cutoff == null ? (
                    <span className="text-xs font-medium text-[#4ADE80]">None</span>
                  ) : (
                    <span className="text-[#FF6B6B]">{fmt(c.cutoff)}</span>
                  )}
                </td>
                <td className="hidden px-4 py-2.5 text-right sm:table-cell">
                  <StatusBadge s={c.status} />
                </td>
              </tr>
            ))}
        </tbody>
      </table>
    </Card>
  );
}

// ─── Planner ─────────────────────────────────────────────────────────────────

function Planner({ courses }: { courses: CourseStats[] }) {
  const [bids, setBids] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState<string[]>([]);

  const picked = courses.filter((c) => selected.includes(c.code));
  const credits = picked.reduce((a, c) => a + c.credits, 0);
  const committed = picked.reduce((a, c) => a + (Number(bids[c.code]) || 0), 0);
  const conflicts = CONCENTRATION_PAIRS.filter(([a, b]) =>
    picked.some((c) => c.concentration === a) && picked.some((c) => c.concentration === b),
  );
  const overCredits = credits > MAX_ELECTIVE_CREDITS;

  const toggle = (code: string) =>
    setSelected((s) => (s.includes(code) ? s.filter((x) => x !== code) : [...s, code]));

  return (
    <Card className="p-3 sm:p-4">
      <SectionTitle
        icon={Target}
        title="Bid planner"
        sub="Pick courses and try a bid to see where it ranks among the final bids. Nothing is submitted — this stays in your browser."
      />

      <div className="mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {courses.map((c) => {
          const on = selected.includes(c.code);
          return (
            <button
              key={c.code}
              onClick={() => toggle(c.code)}
              aria-pressed={on}
              className={`flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left text-xs transition-colors ${
                on ? 'border-[#f7d344]/60 bg-[#1C1A0E] text-white' : 'border-[#2A2A2A] bg-[#111] text-gray-400 hover:text-white'
              }`}
            >
              <span className="flex min-w-0 items-center gap-2">
                <ConcBadge c={c.concentration} />
                <span className="truncate">{c.name}</span>
              </span>
              <span className="shrink-0 text-gray-500">{c.credits} cr</span>
            </button>
          );
        })}
      </div>

      {picked.length > 0 && (
        <div className="mb-4 space-y-2">
          {picked.map((c) => {
            const raw = bids[c.code] ?? '';
            const bid = Number(raw) || 0;
            const { higher, percentile } = rankForBid(c.bids, bid);
            const wins = bid > 0 && higher < c.capacity;
            return (
              <div
                key={c.code}
                className="flex flex-col gap-2 rounded-lg border border-[#222] bg-[#111] px-3 py-2.5 sm:flex-row sm:items-center"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-white">{c.name}</p>
                  <p className="text-[11px] text-gray-500">
                    Guide ~{fmt(c.credits * POINTS_PER_CREDIT_GUIDE)} pts ·{' '}
                    {c.cutoff == null ? `no cutoff (${c.seatsLeft} seats spare)` : `cutoff ${fmt(c.cutoff)}`}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <label className="sr-only" htmlFor={`bid-${c.code}`}>
                    Bid for {c.name}
                  </label>
                  <input
                    id={`bid-${c.code}`}
                    inputMode="numeric"
                    placeholder="Your bid"
                    value={raw}
                    onChange={(e) => setBids((b) => ({ ...b, [c.code]: e.target.value.replace(/\D/g, '').slice(0, 4) }))}
                    className="w-24 rounded-md border border-[#2A2A2A] bg-[#0A0A0A] px-2 py-1.5 text-right text-sm tabular-nums text-white placeholder:text-gray-600 focus:border-[#f7d344]/60 focus:outline-none"
                  />
                  <div className="w-36 text-[11px]">
                    {bid > 0 ? (
                      <>
                        <p className={wins ? 'text-[#4ADE80]' : 'text-[#FF6B6B]'}>
                          {wins ? 'Would win a seat now' : 'Would miss the cut now'}
                        </p>
                        <p className="text-gray-500">Higher than {pct(percentile)} of bids</p>
                      </>
                    ) : (
                      <p className="text-gray-600">Enter a bid</p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="grid gap-2 sm:grid-cols-3">
        <RuleRow
          ok={conflicts.length === 0}
          label="Concentrations"
          detail={
            conflicts.length
              ? `Can't mix ${conflicts.map(([a, b]) => `${a} + ${b}`).join(', ')}`
              : 'SAMA or FIFI · MAST or DTP'
          }
        />
        <RuleRow
          ok={!overCredits}
          label={`Credits ${credits} / ${MAX_ELECTIVE_CREDITS}`}
          detail={overCredits ? 'Over the Term 3 elective cap' : 'Within the Term 3 cap'}
        />
        <RuleRow
          ok={committed <= POINTS_RESERVE}
          label={`${fmt(committed)} pts committed`}
          detail={`${fmt(Math.max(0, POINTS_RESERVE - committed))} of ${fmt(POINTS_RESERVE)} left for Terms 4–8`}
        />
      </div>
    </Card>
  );
}

function RuleRow({ ok, label, detail }: { ok: boolean; label: string; detail: string }) {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-[#222] bg-[#111] px-3 py-2">
      {ok ? (
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#4ADE80]" aria-hidden="true" />
      ) : (
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#FF6B6B]" aria-hidden="true" />
      )}
      <div>
        <p className="text-xs font-medium text-white">{label}</p>
        <p className="text-[11px] text-gray-500">{detail}</p>
      </div>
    </div>
  );
}

// ─── Insights (all computed from live data) ──────────────────────────────────

function Insights({ data }: { data: SmartBidPayload }) {
  const lines = useMemo(() => {
    const out: { tone: 'good' | 'warn'; text: string }[] = [];
    const over = data.courses.filter((c) => c.status === 'oversubscribed');
    const filling = data.courses.filter((c) => c.status === 'filling');
    if (over.length) {
      out.push({
        tone: 'warn',
        text: `${over.map((c) => c.name).join(', ')} ${over.length > 1 ? 'have' : 'has'} more bids than seats — a bid below ${over
          .map((c) => fmt(c.cutoff ?? 0))
          .join(' / ')} pts ${data.final ? 'missed out in the final sheet' : 'would miss out right now'}.`,
      });
    } else {
      out.push({
        tone: 'good',
        text: `No course is oversubscribed: ${fmt(data.totals.activeBids)} bids for ${fmt(data.totals.seats)} seats. Every bid above 0 ${data.final ? 'wins' : 'currently wins'} a seat.`,
      });
    }
    if (filling.length && !data.final) {
      out.push({
        tone: 'warn',
        text: `${filling.map((c) => `${c.name} (${pct(c.fill)})`).join(', ')} ${filling.length > 1 ? 'are' : 'is'} above 80% full — watch these close to the deadline.`,
      });
    }
    const all = data.courses.flatMap((c) => c.bids);
    const big = all.filter((b) => b >= 1000).length;
    if (all.length) {
      out.push({
        tone: 'warn',
        text: `${big} of ${all.length} bids (${pct(big / all.length)}) are 1,000 pts or more. If the course doesn't fill, they win the same seat as a much smaller bid.`,
      });
    }
    return out;
  }, [data]);

  return (
    <Card className="p-3 sm:p-4">
      <SectionTitle icon={Sparkles} title={data.final ? 'What the final numbers say' : 'What the live numbers say'} />
      <ul className="space-y-2.5">
        {lines.map((l, i) => (
          <li key={i} className="flex gap-2 text-sm leading-relaxed text-gray-300">
            <span
              className={`mt-2 h-1.5 w-1.5 shrink-0 rounded-full ${l.tone === 'good' ? 'bg-[#4ADE80]' : 'bg-[#FCD34D]'}`}
              aria-hidden="true"
            />
            {l.text}
          </li>
        ))}
      </ul>
      <p className="mt-3 border-t border-[#222] pt-3 text-[11px] leading-relaxed text-gray-500">
        Cutoffs rank the bids in this sheet against seats. The sheet is self-reported by students, so the official portal may
        differ. Check the official bidding policy for how points are charged and refunded.
      </p>
    </Card>
  );
}

function PlaceBid() {
  return (
    <div className="flex max-w-xl items-center justify-between gap-3 rounded-xl border border-[#665200] bg-[#1C1A0E] p-2.5 sm:p-3.5">
      <div className="flex min-w-0 items-start gap-2.5">
        <Pencil className="mt-0.5 hidden h-4 w-4 shrink-0 text-[#f7d344] sm:block" aria-hidden="true" />
        <div className="min-w-0">
          <p className="text-[13px] font-semibold text-white sm:text-sm">
            <span className="sm:hidden">Bid on the form</span>
            <span className="hidden sm:inline">Haven&apos;t bid yet? Place your bid on the form.</span>
          </p>
          <p className="mt-0.5 text-[11px] leading-snug text-gray-400 sm:text-xs">
            <span className="sm:hidden">Form is editable — change your bid any time before the deadline.</span>
            <span className="hidden sm:inline">
              The form is editable — already submitted? Use the same form to change your bid any time before the deadline.
            </span>
          </p>
        </div>
      </div>
      <a
        href={SMARTBID_FORM_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex shrink-0 items-center justify-center gap-1 rounded-lg bg-[#f7d344] px-3 py-2 text-xs font-semibold text-black hover:bg-[#ffe066] sm:gap-1.5 sm:px-4 sm:text-sm"
      >
        Place your bid <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
      </a>
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

const FILTERS: ('ALL' | Concentration)[] = ['ALL', 'SAMA', 'MAST', 'FIFI', 'DTP'];

export function SmartBidTracker() {
  const { data, error, state, syncing, refresh, dataAge } = useSmartBid();
  const [filter, setFilter] = useState<'ALL' | Concentration>('ALL');
  // One switch for every card: opening one distribution opens them all.
  const [showDist, setShowDist] = useState(false);
  const loading = !data;
  const courses = data?.courses ?? [];
  const shown = filter === 'ALL' ? courses : courses.filter((c) => c.concentration === filter);
  const highest = data?.totals.highestBid;
  const highestCourse = courses.find((c) => c.code === highest?.code);
  const final = !!data?.final;

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white">
      <header className="sticky top-0 z-20 border-b border-[#1E1E1E] bg-[#0A0A0A]/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <Link href="/" className="flex items-center gap-2.5">
            <Logo className="h-7 w-7" />
            <span className="text-sm font-semibold">
              MU One <span className="text-gray-500">/</span> <span className="text-[#f7d344]">SmartBid</span>
            </span>
          </Link>
          <div className="flex items-center gap-3">
            <a
              href={SMARTBID_SHEET_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="hidden items-center gap-1 text-xs text-gray-500 hover:text-white sm:inline-flex"
            >
              Source sheet <ExternalLink className="h-3 w-3" aria-hidden="true" />
            </a>
            {!final && (
              <a
                href={SMARTBID_FORM_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded-md bg-[#f7d344] px-3 py-1.5 text-xs font-semibold text-black hover:bg-[#ffe066]"
              >
                Place your bid <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
              </a>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-4 px-3 py-4 pb-24 sm:space-y-6 sm:px-4 sm:py-6">
        <section className="flex flex-col gap-3 sm:gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0 space-y-2.5 sm:space-y-3">
            <p className="hidden text-[11px] font-medium uppercase tracking-[0.18em] text-[#f7d344] sm:block">
              Term 3 · Elective bidding
            </p>
            <h1 className="text-xl font-bold tracking-tight sm:text-3xl">
              <span className="sm:hidden">Term 3 </span>
              {final ? 'Final bid results' : 'Live bid tracker'}
            </h1>
            <p className="hidden max-w-xl text-sm text-gray-400 sm:block">
              {final
                ? 'Final seats, bids and seat cutoffs for every Term 3 elective, from the batch’s bidding sheet after bidding closed. Free for every student — no login.'
                : 'Seats, bids and seat cutoffs for every Term 3 elective, straight from the batch’s bidding sheet. Free for every student — no login.'}
            </p>
            <LiveStatus
              state={state}
              syncing={syncing}
              dataAge={dataAge}
              error={error}
              onRefresh={() => void refresh()}
            />
            {data && !final && <PlaceBid />}
            {state === 'error' && (
              <p className="text-xs text-[#FF6B6B]">Couldn&apos;t load the sheet ({error}). Retrying automatically.</p>
            )}
          </div>
          <Countdown />
        </section>

        <section className="grid grid-cols-3 gap-2 sm:gap-3 lg:grid-cols-6">
          <Kpi loading={loading} label="Responses" value={fmt(data?.responses ?? 0)} sub="Students who filled the form" />
          <Kpi loading={loading} label="Active bids" value={fmt(data?.totals.activeBids ?? 0)} sub="Bids above 0 pts" />
          <Kpi loading={loading} label="Seats" value={fmt(data?.totals.seats ?? 0)} sub={`${courses.length} electives`} />
          <Kpi
            loading={loading}
            label="Overall fill"
            value={pct(data?.totals.fill ?? 0)}
            sub={`${fmt(Math.max(0, (data?.totals.seats ?? 0) - (data?.totals.activeBids ?? 0)))} seats unclaimed`}
          />
          <Kpi
            loading={loading}
            label="Oversubscribed"
            value={`${data?.totals.oversubscribed ?? 0} / ${courses.length}`}
            sub={data?.totals.oversubscribed ? 'Bids exceed seats' : 'All courses have room'}
          />
          <Kpi
            loading={loading}
            label="Highest bid"
            value={highest ? fmt(highest.value) : '—'}
            sub={highestCourse?.name}
          />
        </section>

        <section>
          <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2 sm:mb-3 sm:gap-3">
            <SectionTitle icon={TrendingUp} title="Electives" sub="Tap a course's instructor to open their LinkedIn." />
            <div className="flex w-full items-center justify-between gap-2 sm:w-auto sm:justify-end">
            <button
              onClick={() => setShowDist((o) => !o)}
              aria-pressed={showDist}
              className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors ${
                showDist ? 'border-[#f7d344]/60 bg-[#1C1A0E] text-[#f7d344]' : 'border-[#222] bg-[#111] text-gray-400 hover:text-white'
              }`}
            >
              {showDist ? 'Hide' : 'Show'} <span className="hidden sm:inline">all</span> distributions
              <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showDist ? 'rotate-180' : ''}`} aria-hidden="true" />
            </button>
            <div className="flex gap-1 rounded-lg border border-[#222] bg-[#111] p-1" role="tablist" aria-label="Filter by concentration">
              {FILTERS.map((f) => (
                <button
                  key={f}
                  role="tab"
                  aria-selected={filter === f}
                  onClick={() => setFilter(f)}
                  className={`rounded-md px-2 py-1 text-xs font-medium transition-colors sm:px-2.5 ${
                    filter === f ? 'bg-[#f7d344] text-black' : 'text-gray-400 hover:text-white'
                  }`}
                >
                  {f === 'ALL' ? 'All' : f}
                </button>
              ))}
            </div>
            </div>
          </div>
          <div className="grid gap-2.5 sm:grid-cols-2 sm:gap-3 lg:grid-cols-3">
            {loading
              ? Array.from({ length: 7 }).map((_, i) => (
                  <Card key={i} className="h-72 animate-pulse">
                    <span className="sr-only">Loading</span>
                  </Card>
                ))
              : shown.map((c) => (
                  <CourseCard key={c.code} c={c} open={showDist} onToggle={() => setShowDist((o) => !o)} />
                ))}
          </div>
        </section>

        {data && (
          <>
            <section className="grid gap-2.5 sm:gap-3 lg:grid-cols-5">
              <div className="min-w-0 lg:col-span-3">
                <ClearingTable courses={courses} final={data.final} />
              </div>
              <div className="min-w-0 space-y-2.5 sm:space-y-3 lg:col-span-2">
                <Insights data={data} />
                <ConcentrationSplit data={data} />
              </div>
            </section>

            <section>
              <Planner courses={courses} />
            </section>
          </>
        )}

        <footer className="flex flex-col gap-2 border-t border-[#1E1E1E] pt-5 text-[11px] text-gray-500 sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-center gap-1.5">
            <Users className="h-3 w-3" aria-hidden="true" />
            Student-built on MU One · numbers come from the batch&apos;s self-reported bidding sheet, not the official portal.
          </p>
          <Link href="/" className="text-gray-400 hover:text-[#f7d344]">
            Open MU One →
          </Link>
        </footer>
      </main>
    </div>
  );
}
