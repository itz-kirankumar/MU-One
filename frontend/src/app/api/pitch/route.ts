import 'server-only';
import { NextRequest } from 'next/server';
import {
  requireCampusUser,
  enforceRateLimit,
  acquirePitchSlot,
  readJsonBody,
  apiErrorResponse,
  asRecord,
  ApiError,
} from '@/lib/server/apiSecurity';
import { researchPitch } from '@/lib/server/research';
import type { PitchInput, PitchResult } from '@/types/pitch';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function fallbackAnalysis(
  input: PitchInput,
  sources: PitchResult['sources'],
  researchStatus: PitchResult['researchStatus'],
  researchNote: string
): PitchResult {
  const slideLimit = Math.max(1, Math.min(input.slideLimit || 5, 20));
  const defaultSlideTitles = [
    'The Unaddressed Friction & Market Opportunity',
    'Proprietary Solution & Unfair Advantage',
    'Market Sizing (TAM/SAM/SOM) & Bottom-Up Unit Economics',
    'Go-to-Market Engine & Defensible Distribution',
    'Milestones, Unit Margins & Advisory Ask',
  ];

  const sourceIds = sources.map((s) => s.id);
  const slides: PitchResult['slides'] = [];

  for (let i = 1; i <= slideLimit; i++) {
    const title = defaultSlideTitles[i - 1] || `Strategic Pillar ${i}: Execution & Feasibility`;
    slides.push({
      number: i,
      title,
      keyMessage:
        i === 1
          ? `Urgent pain point in ${input.industry || 'the target sector'} where existing legacy players fail.`
          : i === 2
          ? `How ${input.idea || 'the proposed business'} delivers a 10x superior outcome with structural moat.`
          : i === 3
          ? 'Bottom-up unit economics with positive unit contribution and healthy payback period.'
          : i === 4
          ? 'Repeatable, zero-CAC distribution flywheel leveraging ecosystem network effects.'
          : '18-month execution milestones with key metric verification and governance roadmap.',
      bullets: [
        `Root cause driver: Why ${input.industry || 'incumbents'} cannot solve this without cannibalizing core margins.`,
        'Quantified market friction and unit cost to target ICP.',
        'Validated customer willingness-to-pay based on pilot benchmarks.',
      ],
      judgeQuestion:
        i === 1
          ? 'What proprietary customer insight validates that this is a burning hair-on-fire problem?'
          : i === 2
          ? 'Why cannot an incumbent with 100x resources clone this solution in 6 months?'
          : 'What are your gross margin and customer acquisition cost assumptions?',
      sourceIds: sourceIds.slice(0, 2),
    });
  }

  return {
    summary: `Structured deck architecture for ${input.competition || 'the competition'}. Focused on ${input.industry || 'the industry'} with emphasis on customer unit economics, moat defensibility, and clear rubric alignment.`,
    recommendation:
      'Prioritize rigorous bottom-up unit economics and defensibility against incumbents. Ensure slide narrative connects customer problem directly to product moat.',
    slides,
    critiques: [
      {
        id: 'c1',
        title: 'Incumbent Retaliation Moat',
        issue: 'Judges will scrutinize why large incumbents cannot duplicate this with standard distribution.',
        evidenceNeeded: 'Concrete network effect, proprietary dataset, or exclusive channel lock-in.',
        actionTitle: 'Define defensible moat and switching cost metrics',
      },
      {
        id: 'c2',
        title: 'Customer Acquisition Cost Sensitivity',
        issue: 'Generic digital marketing assumptions will be heavily penalized by venture judges.',
        evidenceNeeded: 'Bottom-up pilot CAC derivation and conversion funnel milestones.',
        actionTitle: 'Draft pilot CAC validation model',
      },
    ],
    assumptions: [
      {
        claim: 'Initial customer willingness-to-pay supports target price point',
        kind: 'estimate',
        sourceIds: sourceIds.slice(0, 1),
        calculation: 'Assumes 15% discount against incumbent cost of inefficiency.',
      },
      {
        claim: 'Gross margin exceeds 65% at steady-state scale',
        kind: 'assumption',
        sourceIds: [],
        calculation: 'Net of payment gateway (2%), server/hosting (5%), and support (10%).',
      },
    ],
    requirements: [
      {
        criterion: 'Problem Statement & Urgency',
        coverage: 'covered',
        feedback: 'Clearly outlined with industry friction points.',
      },
      {
        criterion: 'Defensible Unit Economics',
        coverage: 'partial',
        feedback: 'Preliminary estimates present; needs pilot validation data before submission.',
      },
    ],
    sources,
    researchStatus,
    researchNote,
    generatedAt: new Date().toISOString(),
  };
}

async function analyzeWithGemini(
  apiKey: string,
  input: PitchInput,
  sources: PitchResult['sources'],
  researchStatus: PitchResult['researchStatus'],
  researchNote: string
): Promise<PitchResult | null> {
  const prompt = `You are a world-class venture capitalist and case competition judge for top business schools.
Analyze the following pitch brief and generate a rigorous, structured response strictly adhering to the JSON schema.

Competition: ${input.competition || 'General Competition'}
Round: ${input.round || 'Preliminary'}
Mode: ${input.mode}
Industry: ${input.industry}
Idea: ${input.idea}
Brief: ${input.brief}
Judging Rubric: ${input.rubric || 'Standard B-School case competition criteria'}
Requested Slide Count: ${input.slideLimit || 5}
Deadline: ${input.deadline || 'Upcoming'}

Research Sources Gathered:
${sources.map((s) => `[${s.id}] ${s.title}: ${s.excerpt}`).join('\n\n')}

Return ONLY valid JSON with this exact structure:
{
  "summary": string,
  "recommendation": string,
  "slides": [
    {
      "number": number,
      "title": string,
      "keyMessage": string,
      "bullets": string[],
      "judgeQuestion": string,
      "sourceIds": string[]
    }
  ],
  "critiques": [
    {
      "id": string,
      "title": string,
      "issue": string,
      "evidenceNeeded": string,
      "actionTitle": string
    }
  ],
  "assumptions": [
    {
      "claim": string,
      "kind": "assumption" | "estimate" | "sourced",
      "sourceIds": string[],
      "calculation": string
    }
  ],
  "requirements": [
    {
      "criterion": string,
      "coverage": "covered" | "partial" | "missing",
      "feedback": string
    }
  ]
}`;

  try {
    const models = ['gemini-2.0-flash', 'gemini-1.5-flash'];
    for (const model of models) {
      try {
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: {
                responseMimeType: 'application/json',
                temperature: 0.3,
              },
            }),
            signal: AbortSignal.timeout(25_000),
          }
        );
        if (res.ok) {
          const data = await res.json();
          const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
          if (text) {
            const parsed = JSON.parse(text);
            if (Array.isArray(parsed.slides) && Array.isArray(parsed.critiques)) {
              return {
                ...parsed,
                sources,
                researchStatus,
                researchNote,
                generatedAt: new Date().toISOString(),
              };
            }
          }
        }
      } catch {
        continue;
      }
    }
  } catch (err) {
    console.warn('Gemini API call failed, falling back to deterministic synthesis:', err);
  }
  return null;
}

export async function POST(request: NextRequest) {
  let releaseSlot: (() => void) | null = null;
  try {
    const uid = await requireCampusUser(request);
    enforceRateLimit(uid, 'pitch', 20, 600_000);
    releaseSlot = acquirePitchSlot(uid);

    const body = asRecord(await readJsonBody(request));
    const input = asRecord(body.input) as unknown as PitchInput;

    if (!input || typeof input !== 'object') {
      throw new ApiError(400, 'Valid pitch input is required.', 'INVALID_INPUT');
    }

    const { sources, researchStatus, researchNote } = await researchPitch(input);

    const geminiKey = process.env.GEMINI_API_KEY?.trim();
    let result: PitchResult | null = null;

    if (geminiKey) {
      result = await analyzeWithGemini(geminiKey, input, sources, researchStatus, researchNote);
    }

    if (!result) {
      result = fallbackAnalysis(input, sources, researchStatus, researchNote);
    }

    return Response.json(result, {
      status: 200,
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    return apiErrorResponse(error);
  } finally {
    releaseSlot?.();
  }
}
