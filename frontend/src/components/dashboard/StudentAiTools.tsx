'use client';

import React, { useState } from 'react';
import {
  Sparkles,
  Search,
  Briefcase,
  Trophy,
  Mic,
  BookOpen,
  Bot,
  ExternalLink,
  Copy,
  Check,
  Building2,
  TrendingUp,
  HelpCircle,
  ArrowRight,
  ShieldAlert,
  Sliders,
  Send,
  UserCheck,
  Layers,
  FileSpreadsheet,
  AlertTriangle,
  Lightbulb,
} from 'lucide-react';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';

export type AiToolTab = 'competition' | 'copilot' | 'placement' | 'case_study' | 'speaker';

interface StudentAiToolsProps {
  activeTab: AiToolTab;
  onSelectTab: (tab: AiToolTab) => void;
}

export function StudentAiTools({ activeTab, onSelectTab }: StudentAiToolsProps) {
  // Shared state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Tool 1: Case Comp & Pitch Architect
  const [compName, setCompName] = useState('Reliance T.U.P XII');
  const [compIdea, setCompIdea] = useState(
    'Decentralized EV battery swap network for tier-2 logistics fleets using predictive battery health AI'
  );
  const [compIndustry, setCompIndustry] = useState('CleanTech & Logistics');
  const [compResult, setCompResult] = useState<any>(null);

  // Tool 2: Interactive Mock Interview & Case Simulator
  const [interviewCompany, setInterviewCompany] = useState('Ather Energy');
  const [interviewRole, setInterviewRole] = useState('Product Manager');
  const [interviewDilemma, setInterviewDilemma] = useState<any>(null);
  const [studentAnswer, setStudentAnswer] = useState('');
  const [evalResult, setEvalResult] = useState<any>(null);

  // Tool 3: Recruiter Intelligence & Cold Pitch Architect
  const [recruiterCompany, setRecruiterCompany] = useState('McKinsey & Company');
  const [recruiterRole, setRecruiterRole] = useState('Business Analyst / Strategy Fellow');
  const [studentBg, setStudentBg] = useState(
    'Led $10k Dropshipping venture in Term 1, proficient in SQL, cohort retention, and market sizing'
  );
  const [recruiterResult, setRecruiterResult] = useState<any>(null);

  // Tool 4: HBR & Academic Case Solver
  const [caseTopic, setCaseTopic] = useState('Netflix Qwikster Pivot 2011 & Streaming Transition');
  const [caseResult, setCaseResult] = useState<any>(null);

  // Tool 5: Speaker & CXO Masterclass Networking Agent
  const [speakerName, setSpeakerName] = useState('Deepinder Goyal');
  const [speakerVenture, setSpeakerVenture] = useState('Zomato / Blinkit');
  const [speakerResult, setSpeakerResult] = useState<any>(null);

  function handleCopy(text: string, key: string) {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  }

  async function runAiTool(action: string, payload: any, setter: (data: any) => void) {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/ai-tool', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, payload }),
      });
      if (!res.ok) {
        throw new Error(`AI Tool error: ${res.statusText}`);
      }
      const data = await res.json();
      setter(data);
    } catch (err: any) {
      setError(err.message || 'Execution failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Top Banner Navigation */}
      <div className="rounded-2xl border border-[#222] bg-gradient-to-r from-[#141414] via-[#181818] to-[#121212] p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#222] text-[#f7d344] border border-[#333]">
                <Sparkles className="h-3.5 w-3.5" />
              </span>
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#f7d344]">
                Masters' Union Student AI Suite
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
              {activeTab === 'competition'
                ? '🏆 Case Comp & Pitch Architect'
                : activeTab === 'copilot'
                ? '🎙️ Mock Interview & Case Simulator'
                : activeTab === 'placement'
                ? '💼 Recruiter Intel & Cold Pitcher'
                : activeTab === 'case_study'
                ? '📚 HBR & Academic Case Solver'
                : '🤝 Speaker & CXO Networking Agent'}
            </h1>
            <p className="mt-1 text-xs sm:text-sm text-gray-400">
              {activeTab === 'competition'
                ? 'Generate an end-to-end 5-slide winning deck structure + brutal Devil\'s Advocate red-team critique.'
                : activeTab === 'copilot'
                ? 'Simulate real business case interviews. Submit your structured answer and get evaluated by ex-partners.'
                : activeTab === 'placement'
                ? 'Analyze company hiring biases, discover resume hooks, and draft high-converting cold pitches.'
                : activeTab === 'case_study'
                ? 'Synthesize MECE issue trees, Porter\'s 5 Forces, and 30-60-90 day turnaround plans.'
                : 'Generate high-conviction questions that make visiting CXO founders stop and want to mentor you.'}
            </p>
          </div>

          {/* Tab Selector Pills */}
          <div className="flex flex-wrap gap-1 p-1 bg-[#0A0A0A] rounded-xl border border-[#222]">
            {[
              { id: 'competition', label: 'Pitch Architect', icon: Trophy },
              { id: 'copilot', label: 'Case Simulator', icon: Bot },
              { id: 'placement', label: 'Recruiter Intel', icon: Briefcase },
              { id: 'case_study', label: 'Case Solver', icon: BookOpen },
              { id: 'speaker', label: 'Speaker Prep', icon: Mic },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    onSelectTab(tab.id as AiToolTab);
                    setError('');
                  }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    isActive
                      ? 'bg-[#242424] text-white shadow-sm border border-[#3A3A3A]'
                      : 'text-gray-400 hover:text-gray-200 hover:bg-[#151515]'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-950/20 p-4 text-xs text-red-300 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-red-400 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* TOOL 1: CASE COMP & PITCH ARCHITECT */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {activeTab === 'competition' && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-[#222] bg-[#141414] p-5 space-y-4">
            <h2 className="text-sm font-bold uppercase tracking-wider text-[#f7d344] flex items-center gap-2">
              <Trophy className="h-4 w-4" />
              Configure Case Competition
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-gray-400 block mb-1">Competition / Hackathon</label>
                <input
                  type="text"
                  value={compName}
                  onChange={(e) => setCompName(e.target.value)}
                  placeholder="e.g. Reliance T.U.P XII, HUL LIME..."
                  className="w-full rounded-xl bg-[#0A0A0A] border border-[#2A2A2A] px-3.5 py-2.5 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-[#f7d344]"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-400 block mb-1">Target Industry / Domain</label>
                <input
                  type="text"
                  value={compIndustry}
                  onChange={(e) => setCompIndustry(e.target.value)}
                  placeholder="e.g. CleanTech, Quick Commerce, FinTech..."
                  className="w-full rounded-xl bg-[#0A0A0A] border border-[#2A2A2A] px-3.5 py-2.5 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-[#f7d344]"
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-400 block mb-1">Your Team's Raw Idea / Innovation Angle</label>
              <textarea
                rows={2}
                value={compIdea}
                onChange={(e) => setCompIdea(e.target.value)}
                placeholder="Briefly describe what your team wants to pitch..."
                className="w-full rounded-xl bg-[#0A0A0A] border border-[#2A2A2A] px-3.5 py-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-[#f7d344]"
              />
            </div>
            <button
              onClick={() =>
                runAiTool(
                  'pitch_architect',
                  { competition: compName, idea: compIdea, industry: compIndustry },
                  setCompResult
                )
              }
              disabled={loading || !compName.trim()}
              className="flex items-center gap-2 rounded-xl bg-[#f7d344] px-5 py-2.5 text-xs font-bold text-black hover:bg-[#ffe26e] disabled:opacity-50 transition-colors cursor-pointer"
            >
              {loading ? <LoadingSpinner size="sm" /> : <Sparkles className="h-3.5 w-3.5" />}
              <span>{loading ? 'Synthesizing 5-Slide Strategy...' : 'Architect 5-Slide Deck & Red-Team Critique'}</span>
            </button>
          </div>

          {compResult && (
            <div className="space-y-6 animate-in fade-in duration-300">
              {/* Context */}
              <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 text-xs text-amber-200">
                <span className="font-bold text-amber-400">Competition Strategic Context: </span>
                {compResult.marketContext}
              </div>

              {/* 5-Slide Deck */}
              <div>
                <h3 className="text-sm font-bold uppercase tracking-wider text-white mb-3 flex items-center gap-2">
                  <Layers className="h-4 w-4 text-[#f7d344]" />
                  Recommended 5-Slide Deck Structure
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                  {compResult.slides.map((s: any) => (
                    <div key={s.slideNumber} className="rounded-xl border border-[#222] bg-[#141414] p-4 flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="rounded bg-[#222] border border-[#333] px-2 py-0.5 text-[10px] font-bold text-[#f7d344]">
                            Slide {s.slideNumber}
                          </span>
                        </div>
                        <h4 className="text-xs font-bold text-white mb-1.5">{s.title}</h4>
                        <p className="text-[11px] text-gray-400 italic mb-2.5">"{s.keyMessage}"</p>
                        <ul className="space-y-1.5 mb-3">
                          {s.bulletPoints.map((b: string, idx: number) => (
                            <li key={idx} className="flex items-start gap-1.5 text-[11px] text-gray-300">
                              <span className="h-1 w-1 rounded-full bg-[#f7d344] mt-1.5 flex-shrink-0" />
                              <span>{b}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div className="pt-2 border-t border-[#1F1F1F] text-[10px] text-amber-400/90">
                        <span className="font-semibold">Judge's Lens: </span>
                        {s.judgeAdvice}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Red-Team Critique */}
              <div>
                <h3 className="text-sm font-bold uppercase tracking-wider text-red-400 mb-3 flex items-center gap-2">
                  <ShieldAlert className="h-4 w-4" />
                  Devil's Advocate: 3 Fatal Disqualification Risks
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                  {compResult.redTeamCritique.map((critique: any, idx: number) => (
                    <div key={idx} className="rounded-xl border border-red-500/20 bg-[#161010] p-4 space-y-2">
                      <span className="inline-block rounded bg-red-950/60 border border-red-800/40 text-red-300 text-[10px] font-bold px-2 py-0.5">
                        Risk {idx + 1}: {critique.flaw}
                      </span>
                      <p className="text-[11px] text-gray-300 leading-relaxed">
                        <span className="font-bold text-red-400">Why Judges Attack This: </span>
                        {critique.whyJudgesPokeHoles}
                      </p>
                      <div className="p-2 rounded bg-black/40 border border-[#222] text-[11px] text-emerald-300">
                        <span className="font-bold text-emerald-400">Winning Counter-Defense: </span>
                        {critique.counterDefense}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* TOOL 2: INTERACTIVE MOCK INTERVIEW & CASE SIMULATOR */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {activeTab === 'copilot' && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-[#222] bg-[#141414] p-5 space-y-4">
            <h2 className="text-sm font-bold uppercase tracking-wider text-purple-400 flex items-center gap-2">
              <Bot className="h-4 w-4" />
              Live Business Case & Interview Simulator
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-gray-400 block mb-1">Company Target</label>
                <input
                  type="text"
                  value={interviewCompany}
                  onChange={(e) => setInterviewCompany(e.target.value)}
                  placeholder="e.g. Ather Energy, McKinsey, Swiggy, Zepto..."
                  className="w-full rounded-xl bg-[#0A0A0A] border border-[#2A2A2A] px-3.5 py-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-purple-500"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-400 block mb-1">Role / Function</label>
                <input
                  type="text"
                  value={interviewRole}
                  onChange={(e) => setInterviewRole(e.target.value)}
                  placeholder="e.g. Product Manager, Consultant, Founder's Office..."
                  className="w-full rounded-xl bg-[#0A0A0A] border border-[#2A2A2A] px-3.5 py-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-purple-500"
                />
              </div>
            </div>
            <button
              onClick={() =>
                runAiTool(
                  'mock_interview_generate',
                  { company: interviewCompany, role: interviewRole },
                  (res) => {
                    setInterviewDilemma(res);
                    setEvalResult(null);
                  }
                )
              }
              disabled={loading || !interviewCompany.trim()}
              className="flex items-center gap-2 rounded-xl bg-purple-600 px-5 py-2 text-xs font-bold text-white hover:bg-purple-500 disabled:opacity-50 transition-colors cursor-pointer"
            >
              {loading ? <LoadingSpinner size="sm" /> : <Sparkles className="h-3.5 w-3.5" />}
              <span>{loading ? 'Simulating Case...' : 'Generate Case Dilemma'}</span>
            </button>
          </div>

          {interviewDilemma && (
            <div className="rounded-2xl border border-purple-500/30 bg-[#120D1A] p-5 space-y-4 animate-in fade-in">
              <div className="flex items-center justify-between">
                <span className="rounded-full bg-purple-900/60 border border-purple-500/40 text-purple-300 text-[10px] font-bold px-2.5 py-0.5 uppercase tracking-wider">
                  Live Case Challenge
                </span>
                <span className="text-xs text-gray-400">Role: {interviewDilemma.role}</span>
              </div>

              <div>
                <h3 className="text-sm font-bold text-white mb-1.5">{interviewDilemma.caseDilemma.title}</h3>
                <p className="text-xs text-gray-300 leading-relaxed bg-[#0A0A0A] p-3.5 rounded-xl border border-[#222]">
                  {interviewDilemma.caseDilemma.scenario}
                </p>
              </div>

              <div className="p-3 bg-purple-950/30 rounded-xl border border-purple-500/20 text-xs text-purple-200">
                <span className="font-bold text-purple-300">Prompt: </span>
                {interviewDilemma.caseDilemma.prompt}
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-300 block mb-1.5">Your Structured Response:</label>
                <textarea
                  rows={5}
                  value={studentAnswer}
                  onChange={(e) => setStudentAnswer(e.target.value)}
                  placeholder="Outline your hypothesis, framework (e.g. MECE), data to pull, and 2 operational tests..."
                  className="w-full rounded-xl bg-[#0A0A0A] border border-[#2A2A2A] p-3.5 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-purple-400 font-sans"
                />
              </div>

              <button
                onClick={() =>
                  runAiTool(
                    'mock_interview_evaluate',
                    {
                      company: interviewCompany,
                      role: interviewRole,
                      prompt: interviewDilemma.caseDilemma.prompt,
                      studentAnswer,
                    },
                    setEvalResult
                  )
                }
                disabled={loading || !studentAnswer.trim()}
                className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 px-5 py-2.5 text-xs font-bold text-white hover:from-purple-500 hover:to-indigo-500 disabled:opacity-50 transition-all cursor-pointer shadow-lg"
              >
                {loading ? <LoadingSpinner size="sm" /> : <Send className="h-3.5 w-3.5" />}
                <span>{loading ? 'Evaluating with Partner Rubric...' : 'Submit to Senior Partner for Evaluation'}</span>
              </button>

              {/* Evaluation Results */}
              {evalResult && (
                <div className="mt-4 pt-4 border-t border-purple-500/20 space-y-4 animate-in fade-in">
                  <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-xl bg-[#0A0A0A] border border-[#222]">
                    <div>
                      <span className="text-[11px] text-gray-400 block">Candidate Rating</span>
                      <span className="text-xl font-bold text-white">{evalResult.verdict}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-center">
                        <span className="text-[10px] text-gray-400 block">Structure</span>
                        <span className="text-sm font-bold text-purple-400">{evalResult.breakdown.structure}/10</span>
                      </div>
                      <div className="text-center">
                        <span className="text-[10px] text-gray-400 block">Quant Rigor</span>
                        <span className="text-sm font-bold text-purple-400">{evalResult.breakdown.analyticalRigor}/10</span>
                      </div>
                      <div className="text-center">
                        <span className="text-[10px] text-gray-400 block">Business Acumen</span>
                        <span className="text-sm font-bold text-purple-400">{evalResult.breakdown.businessAcumen}/10</span>
                      </div>
                      <div className="pl-3 border-l border-[#333] text-center">
                        <span className="text-[10px] text-gray-400 block">Overall Score</span>
                        <span className="text-xl font-black text-[#f7d344]">{evalResult.score}/10</span>
                      </div>
                    </div>
                  </div>

                  {/* Blindspots */}
                  <div className="p-4 rounded-xl bg-red-950/20 border border-red-500/30 space-y-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-red-400 flex items-center gap-1.5">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      Critical Blindspots Missed in Your Answer
                    </span>
                    <ul className="space-y-1 text-xs text-gray-300">
                      {evalResult.criticalBlindspots.map((blindspot: string, i: number) => (
                        <li key={i} className="flex items-start gap-2">
                          <span className="h-1.5 w-1.5 rounded-full bg-red-400 mt-1.5 flex-shrink-0" />
                          <span>{blindspot}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* CXO Model Answer */}
                  <div className="p-4 rounded-xl bg-[#0F172A] border border-blue-500/30 space-y-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-blue-400 flex items-center gap-1.5">
                      <Lightbulb className="h-3.5 w-3.5" />
                      How a Senior Director / Ex-Partner Would Answer
                    </span>
                    <p className="text-xs text-gray-300 whitespace-pre-line leading-relaxed font-sans">
                      {evalResult.cxoModelAnswer}
                    </p>
                  </div>

                  {/* Pressure follow up */}
                  <div className="p-3.5 rounded-xl bg-amber-950/20 border border-amber-500/30 text-xs text-amber-200">
                    <span className="font-bold text-amber-400">Interviewer Follow-Up Pressure Test: </span>
                    {evalResult.followUpPressureQuestion}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* TOOL 3: RECRUITER INTEL & COLD PITCH ARCHITECT */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {activeTab === 'placement' && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-[#222] bg-[#141414] p-5 space-y-4">
            <h2 className="text-sm font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-2">
              <Briefcase className="h-4 w-4" />
              Recruiter Intelligence & Cold Pitch Generator
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-gray-400 block mb-1">Company Name</label>
                <input
                  type="text"
                  value={recruiterCompany}
                  onChange={(e) => setRecruiterCompany(e.target.value)}
                  placeholder="e.g. McKinsey, Swiggy, Bain, Ather..."
                  className="w-full rounded-xl bg-[#0A0A0A] border border-[#2A2A2A] px-3.5 py-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-400 block mb-1">Target Role</label>
                <input
                  type="text"
                  value={recruiterRole}
                  onChange={(e) => setRecruiterRole(e.target.value)}
                  placeholder="e.g. Strategy Analyst, Product Manager..."
                  className="w-full rounded-xl bg-[#0A0A0A] border border-[#2A2A2A] px-3.5 py-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-400 block mb-1">Your Key Highlights (MU term challenges, skills)</label>
              <textarea
                rows={2}
                value={studentBg}
                onChange={(e) => setStudentBg(e.target.value)}
                placeholder="Mention your term challenges, revenue generated, or specific tech/business skills..."
                className="w-full rounded-xl bg-[#0A0A0A] border border-[#2A2A2A] px-3.5 py-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-emerald-500"
              />
            </div>
            <button
              onClick={() =>
                runAiTool(
                  'recruiter_pitch',
                  { company: recruiterCompany, role: recruiterRole, studentBackground: studentBg },
                  setRecruiterResult
                )
              }
              disabled={loading || !recruiterCompany.trim()}
              className="flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2 text-xs font-bold text-white hover:bg-emerald-500 disabled:opacity-50 transition-colors cursor-pointer"
            >
              {loading ? <LoadingSpinner size="sm" /> : <Sparkles className="h-3.5 w-3.5" />}
              <span>{loading ? 'Analyzing Hiring Dynamics...' : 'Deconstruct Hiring Bias & Draft Cold Pitch'}</span>
            </button>
          </div>

          {recruiterResult && (
            <div className="space-y-4 animate-in fade-in">
              {/* Unspoken Hiring Bias */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                <div className="rounded-xl border border-emerald-500/30 bg-[#0E1A14] p-4 space-y-1.5">
                  <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                    What They Actually Screen For
                  </span>
                  <p className="text-xs text-gray-300 leading-relaxed">
                    {recruiterResult.unspokenHiringBias.whatTheyActuallyScreenFor}
                  </p>
                </div>
                <div className="rounded-xl border border-red-500/30 bg-[#1A0E0E] p-4 space-y-1.5">
                  <span className="text-xs font-bold uppercase tracking-wider text-red-400">
                    Red Flags to Avoid in Resume & Interview
                  </span>
                  <p className="text-xs text-gray-300 leading-relaxed">
                    {recruiterResult.unspokenHiringBias.redFlagsToAvoid}
                  </p>
                </div>
              </div>

              {/* Resume Advice */}
              <div className="rounded-xl border border-[#222] bg-[#141414] p-4 space-y-2">
                <span className="text-xs font-bold uppercase tracking-wider text-[#f7d344]">
                  Tailored Resume Positioning Strategy
                </span>
                <ul className="space-y-1.5 text-xs text-gray-300">
                  {recruiterResult.resumeAngleAdvice.map((advice: string, idx: number) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-[#f7d344] mt-1.5 flex-shrink-0" />
                      <span>{advice}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Copyable Cold Email */}
              <div className="rounded-xl border border-[#2A2A2A] bg-[#141414] p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-white">
                    High-Conversion Cold Outreach Email
                  </span>
                  <button
                    onClick={() =>
                      handleCopy(
                        `Subject: ${recruiterResult.coldOutreachEmail.subject}\n\n${recruiterResult.coldOutreachEmail.body}`,
                        'email'
                      )
                    }
                    className="flex items-center gap-1.5 text-xs font-medium text-emerald-400 hover:text-emerald-300 cursor-pointer"
                  >
                    {copiedKey === 'email' ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                    <span>{copiedKey === 'email' ? 'Copied!' : 'Copy Email'}</span>
                  </button>
                </div>
                <div className="p-3.5 rounded-xl bg-[#0A0A0A] border border-[#222] font-mono text-xs text-gray-300 space-y-2 whitespace-pre-line leading-relaxed">
                  <div className="font-bold text-white border-b border-[#222] pb-1">
                    Subject: {recruiterResult.coldOutreachEmail.subject}
                  </div>
                  <div>{recruiterResult.coldOutreachEmail.body}</div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* TOOL 4: HBR & ACADEMIC CASE SOLVER */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {activeTab === 'case_study' && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-[#222] bg-[#141414] p-5 space-y-4">
            <h2 className="text-sm font-bold uppercase tracking-wider text-blue-400 flex items-center gap-2">
              <BookOpen className="h-4 w-4" />
              HBR Case Study Framework Solver
            </h2>
            <div>
              <label className="text-xs font-medium text-gray-400 block mb-1">Case Title or Strategic Business Problem</label>
              <input
                type="text"
                value={caseTopic}
                onChange={(e) => setCaseTopic(e.target.value)}
                placeholder="e.g. Netflix Qwikster 2011, Starbucks entry in India, Apple supply chain..."
                className="w-full rounded-xl bg-[#0A0A0A] border border-[#2A2A2A] px-3.5 py-2.5 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-blue-500"
              />
            </div>
            <button
              onClick={() => runAiTool('case_solver', { caseTopic }, setCaseResult)}
              disabled={loading || !caseTopic.trim()}
              className="flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2 text-xs font-bold text-white hover:bg-blue-500 disabled:opacity-50 transition-colors cursor-pointer"
            >
              {loading ? <LoadingSpinner size="sm" /> : <Sparkles className="h-3.5 w-3.5" />}
              <span>{loading ? 'Synthesizing MECE Tree...' : 'Synthesize MECE Tree & Turnaround Plan'}</span>
            </button>
          </div>

          {caseResult && (
            <div className="space-y-6 animate-in fade-in">
              {/* MECE Issue Tree */}
              <div className="rounded-xl border border-[#222] bg-[#141414] p-5 space-y-3">
                <span className="text-xs font-bold uppercase tracking-wider text-blue-400 flex items-center gap-1.5">
                  <Layers className="h-3.5 w-3.5" />
                  MECE Problem & Hypothesis Tree
                </span>
                <p className="text-xs text-gray-400 font-medium italic">"{caseResult.meceIssueTree.primaryQuestion}"</p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
                  {caseResult.meceIssueTree.branches.map((branch: any, idx: number) => (
                    <div key={idx} className="rounded-xl bg-[#0A0A0A] border border-[#222] p-3.5 space-y-2">
                      <span className="text-xs font-bold text-white block pb-1 border-b border-[#222]">
                        Branch {idx + 1}: {branch.category}
                      </span>
                      <ul className="space-y-1 text-[11px] text-gray-300">
                        {branch.subDrivers.map((driver: string, dIdx: number) => (
                          <li key={dIdx} className="flex items-start gap-1.5">
                            <span className="h-1 w-1 rounded-full bg-blue-400 mt-1.5 flex-shrink-0" />
                            <span>{driver}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>

              {/* Porter's Five Forces */}
              <div className="rounded-xl border border-[#222] bg-[#141414] p-5 space-y-3">
                <span className="text-xs font-bold uppercase tracking-wider text-[#f7d344]">
                  Porter's 5 Forces Competitive Dynamic
                </span>
                <div className="grid grid-cols-1 md:grid-cols-5 gap-2.5">
                  {caseResult.portersFiveForces.map((force: any, idx: number) => (
                    <div key={idx} className="rounded-xl bg-[#0A0A0A] border border-[#222] p-3 space-y-1">
                      <span className="text-[10px] text-gray-400 block font-medium">{force.force}</span>
                      <span
                        className={`text-xs font-black uppercase tracking-wider ${
                          force.level === 'High' || force.level === 'Intense'
                            ? 'text-red-400'
                            : 'text-amber-400'
                        }`}
                      >
                        {force.level}
                      </span>
                      <p className="text-[10px] text-gray-400 leading-normal pt-1">{force.rationale}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* 30-60-90 Day Decision Matrix */}
              <div className="rounded-xl border border-[#222] bg-[#141414] p-5 space-y-3">
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                  Actionable 30-60-90 Day Decision Matrix
                </span>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {caseResult.decisionMatrix30_60_90.map((phase: any, idx: number) => (
                    <div key={idx} className="rounded-xl bg-[#0E1A14] border border-emerald-500/20 p-3.5 space-y-2">
                      <span className="text-xs font-bold text-emerald-400 block">{phase.phase}</span>
                      <ul className="space-y-1.5 text-xs text-gray-300">
                        {phase.actions.map((act: string, aIdx: number) => (
                          <li key={aIdx} className="flex items-start gap-2">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 mt-1.5 flex-shrink-0" />
                            <span>{act}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* TOOL 5: SPEAKER & CXO MASTERCLASS NETWORKING AGENT */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {activeTab === 'speaker' && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-[#222] bg-[#141414] p-5 space-y-4">
            <h2 className="text-sm font-bold uppercase tracking-wider text-purple-400 flex items-center gap-2">
              <Mic className="h-4 w-4" />
              Speaker & CXO Masterclass Networking Agent
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-gray-400 block mb-1">Speaker Name</label>
                <input
                  type="text"
                  value={speakerName}
                  onChange={(e) => setSpeakerName(e.target.value)}
                  placeholder="e.g. Deepinder Goyal, Tarun Mehta, Kunal Shah..."
                  className="w-full rounded-xl bg-[#0A0A0A] border border-[#2A2A2A] px-3.5 py-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-purple-500"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-400 block mb-1">Venture / Company</label>
                <input
                  type="text"
                  value={speakerVenture}
                  onChange={(e) => setSpeakerVenture(e.target.value)}
                  placeholder="e.g. Zomato, Ather Energy, CRED..."
                  className="w-full rounded-xl bg-[#0A0A0A] border border-[#2A2A2A] px-3.5 py-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-purple-500"
                />
              </div>
            </div>
            <button
              onClick={() => runAiTool('speaker_agent', { speakerName, venture: speakerVenture }, setSpeakerResult)}
              disabled={loading || !speakerName.trim()}
              className="flex items-center gap-2 rounded-xl bg-purple-600 px-5 py-2 text-xs font-bold text-white hover:bg-purple-500 disabled:opacity-50 transition-colors cursor-pointer"
            >
              {loading ? <LoadingSpinner size="sm" /> : <Sparkles className="h-3.5 w-3.5" />}
              <span>{loading ? 'Synthesizing Speaker Dossier...' : 'Generate 3 Standout Q&A Questions'}</span>
            </button>
          </div>

          {speakerResult && (
            <div className="space-y-4 animate-in fade-in">
              {/* Context */}
              <div className="rounded-xl border border-[#222] bg-[#141414] p-4 text-xs text-gray-300">
                <span className="font-bold text-purple-400">Executive Context: </span>
                {speakerResult.executiveContext}
              </div>

              {/* 3 Standout Questions */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-purple-400">
                  3 High-Conviction Questions That Stand Out in Q&A
                </h3>
                {speakerResult.standoutQuestions.map((item: any, idx: number) => (
                  <div
                    key={idx}
                    onClick={() => handleCopy(item.question, `q-${idx}`)}
                    className="group rounded-xl border border-[#2A2A2A] bg-[#141414] hover:bg-[#1A1A1A] p-4 space-y-2 cursor-pointer transition-colors"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-2">
                        <span className="font-black text-purple-400 text-sm">#{idx + 1}</span>
                        <p className="text-xs sm:text-sm font-medium text-white leading-relaxed">{item.question}</p>
                      </div>
                      <button className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity p-1 text-gray-400 hover:text-white">
                        {copiedKey === `q-${idx}` ? (
                          <Check className="h-3.5 w-3.5 text-emerald-400" />
                        ) : (
                          <Copy className="h-3.5 w-3.5" />
                        )}
                      </button>
                    </div>
                    <div className="p-2 rounded bg-black/40 text-[11px] text-gray-400 border border-[#222]">
                      <span className="font-semibold text-purple-300">Why this gets noticed: </span>
                      {item.whyThisWorks}
                    </div>
                  </div>
                ))}
              </div>

              {/* 1-Click LinkedIn Follow-Up */}
              <div className="rounded-xl border border-[#222] bg-[#141414] p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-white">
                    1-Click Post-Session LinkedIn Outreach
                  </span>
                  <button
                    onClick={() => handleCopy(speakerResult.followUpNote.linkedIn, 'speaker-li')}
                    className="flex items-center gap-1.5 text-xs font-medium text-purple-400 hover:text-purple-300 cursor-pointer"
                  >
                    {copiedKey === 'speaker-li' ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                    <span>{copiedKey === 'speaker-li' ? 'Copied!' : 'Copy Note'}</span>
                  </button>
                </div>
                <p className="p-3 rounded-xl bg-[#0A0A0A] border border-[#222] text-xs text-gray-300 whitespace-pre-line leading-relaxed">
                  {speakerResult.followUpNote.linkedIn}
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
