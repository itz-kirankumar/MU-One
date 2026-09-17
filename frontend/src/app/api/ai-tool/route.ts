import { NextRequest, NextResponse } from 'next/server';

const TAVILY_API_KEY =
  process.env.TAVILY_API_KEY || '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';

async function queryTavily(query: string, maxResults = 4): Promise<{ answer: string; results: any[] }> {
  try {
    const res = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: TAVILY_API_KEY,
        query,
        search_depth: 'advanced',
        include_answer: true,
        max_results: maxResults,
      }),
    });
    if (res.ok) {
      const data = await res.json();
      return {
        answer: data.answer || '',
        results: data.results || [],
      };
    }
  } catch (err) {
    console.error('Tavily query failed:', err);
  }
  return { answer: '', results: [] };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, payload } = body;

    switch (action) {
      case 'pitch_architect': {
        const { competition, idea, industry } = payload;
        const tavilyData = await queryTavily(
          `${competition} competition guidelines winning decks past winners`,
          3
        );

        return NextResponse.json({
          competition,
          marketContext:
            tavilyData.answer ||
            `Key intelligence for ${competition}: Focus on bold problem selection, verifiable unit economics, and scalable technology.`,
          slides: [
            {
              slideNumber: 1,
              title: 'The Non-Obvious Problem & Market Failure',
              keyMessage: `Why existing solutions in ${industry || 'the market'} are failing and the burning urgency today.`,
              bulletPoints: [
                `Root cause analysis: Why incumbents cannot solve this without cannibalizing their core revenue.`,
                `Quantified market friction: Direct cost of this inefficiency to current customers.`,
                `The Catalyst: Why now? (Recent technological, regulatory, or consumer shift enabling this).`,
              ],
              judgeAdvice: 'Judges test if you truly understand the customer pain or are just pitching a nice-to-have.',
            },
            {
              slideNumber: 2,
              title: 'The Radical Solution & Proprietary Moat',
              keyMessage: `How ${idea || 'your innovation'} solves the core bottleneck 10x better.`,
              bulletPoints: [
                `Core architecture: The unfair mechanism powering the product.`,
                `Defensible Moat: Network effects, proprietary data loops, or distribution lock-in.`,
                `Why Reliance/Google/Amazon cannot simply clone this in 3 months.`,
              ],
              judgeAdvice: 'Avoid buzzwords. Show the specific mechanism of action that makes this defensible.',
            },
            {
              slideNumber: 3,
              title: 'Zero-CAC Go-to-Market & Distribution Flywheel',
              keyMessage: 'A repeatable acquisition engine that does not rely on burning venture capital on paid ads.',
              bulletPoints: [
                'Beachhead segment: The hyper-specific initial 1,000 customers with highest willingness to pay.',
                'Viral / Partnership loop: Leveraging existing channel ecosystems (e.g. colleges, SMB aggregators).',
                'Phase 1 to Phase 3 scaling milestones across 18 months.',
              ],
              judgeAdvice: 'B-School judges heavily penalize teams whose only marketing strategy is "Performance Marketing".',
            },
            {
              slideNumber: 4,
              title: 'Unit Economics & Financial Feasibility',
              keyMessage: 'Clear path to positive contribution margins and robust unit economics.',
              bulletPoints: [
                'TAM / SAM / SOM breakdown with bottom-up derivation rather than vague top-down percentages.',
                'Customer Economics: Projected CAC, Expected LTV, Payback period (< 6 months target).',
                'Year 1–3 revenue projections grounded in operational throughput capacity.',
              ],
              judgeAdvice: 'Ensure your gross margin assumption accounts for payment gateways, refunds, and support costs.',
            },
            {
              slideNumber: 5,
              title: 'Team, Execution Roadmap & Strategic Ask',
              keyMessage: 'Why this student team has the unfair capability to execute this vision.',
              bulletPoints: [
                'Founding team complement: Tech, Design, and GTM execution roles.',
                '30-60-90 Day pilot validation plan with defined proof-of-concept metrics.',
                'Target milestone achievable with competition prize capital & mentorship.',
              ],
              judgeAdvice: 'Close with conviction. Show a clear next step you will take tomorrow morning.',
            },
          ],
          redTeamCritique: [
            {
              flaw: 'Customer Inertia & Switching Cost Risk',
              whyJudgesPokeHoles:
                'Customers may agree the problem exists, but the pain of migrating to your solution exceeds their tolerance.',
              counterDefense:
                'Design a zero-friction wedge (e.g. free browser extension or drop-in API) that requires zero workflow changes initially.',
            },
            {
              flaw: 'Unrealistic Early CAC Projections',
              whyJudgesPokeHoles:
                'Organic growth takes time, and early customer education will be significantly more expensive than modeled.',
              counterDefense:
                'Provide evidence of pre-launch pilot interest, letters of intent (LOIs), or a community waitlist with zero ad spend.',
            },
            {
              flaw: 'Regulatory or Ecosystem Dependency',
              whyJudgesPokeHoles:
                'If your solution relies heavily on external platforms (e.g., WhatsApp API, RBI rules), you are vulnerable to platform risk.',
              counterDefense:
                'Demonstrate multi-channel redundancy and compliance-first architecture designed from day one.',
            },
          ],
        });
      }

      case 'mock_interview_generate': {
        const { company, role } = payload;
        const tavilyData = await queryTavily(
          `${company} interview questions business case product management ${role}`,
          3
        );

        return NextResponse.json({
          company,
          role,
          caseDilemma: {
            title: `${company} Strategic Dilemma (${role})`,
            scenario:
              `You are the ${role} at ${company}. Recently, customer retention in your primary tier-1 metro market dropped by 14% over two consecutive months, while customer acquisition costs (CAC) rose by 22%. Your CEO has called an emergency strategy review in 30 minutes.`,
            prompt: `Walk through your structured diagnosis. How would you isolate the root causes, what quantitative data would you pull first, and what 2 immediate operational interventions would you test this week?`,
            targetCompetencies: ['Root-cause Structuring', 'Metrics & Quant Rigor', 'Prioritization under Ambiguity'],
            contextClues: tavilyData.answer
              ? [tavilyData.answer.slice(0, 200) + '...']
              : [`Focus on unit economics, retention cohorts, and competitive pressure in ${company}'s market.`],
          },
        });
      }

      case 'mock_interview_evaluate': {
        const { company, role, prompt, studentAnswer } = payload;

        // Intelligent scoring heuristics
        const wordCount = studentAnswer.trim().split(/\s+/).length;
        const hasStructure = /first|second|initially|phase|framework|step|cohort|metric|cac|retention|hypothesis/i.test(
          studentAnswer
        );
        const hasQuant = /\d+%|\$|inr|lakh|crore|margin|ratio|tam|ltv/i.test(studentAnswer);

        let structureScore = hasStructure ? 8 : 5;
        let quantScore = hasQuant ? 8 : 4;
        let acumenScore = wordCount > 100 ? 8 : wordCount > 50 ? 6 : 4;
        const overallScore = Number(((structureScore + quantScore + acumenScore) / 3).toFixed(1));

        return NextResponse.json({
          score: overallScore,
          breakdown: {
            structure: structureScore,
            analyticalRigor: quantScore,
            businessAcumen: acumenScore,
          },
          verdict:
            overallScore >= 7.5
              ? 'High Conviction Candidate (Top 10%)'
              : overallScore >= 6.0
              ? 'Promising Structure — Needs Quant Depth'
              : 'Too Generic — Requires MECE Framework',
          criticalBlindspots: [
            'Did not segment the cohort by customer acquisition channel (paid vs organic) to see if low-quality traffic diluted retention.',
            'Failed to check for internal release regressions (e.g. app crashes, payment gateway friction, delivery SLA degradation).',
            'Did not address competitor pricing or promotional aggression launched during the same period.',
          ],
          cxoModelAnswer:
            `"I would structure this problem into 3 buckets: 1) Diagnostic Isolation, 2) Root-Cause Funnel, and 3) 7-Day Rapid Tests.\n\nFirst, I would segment the 14% drop: Is it concentrated in new cohorts or power users? Is it platform-specific (iOS vs Android)?\nSecond, I would analyze the unit economics of the 22% CAC spike to determine whether bidding inflation or creative fatigue was the culprit.\nThird, my immediate interventions would be: a) re-engaging churned users with a targeted zero-cost retention nudge, and b) pausing non-performing ad ad sets to stabilize blended CAC."`,
          followUpPressureQuestion:
            `"Good initial framework. Now suppose the data reveals that delivery times actually improved, but churn is happening strictly after the 2nd order. What is your revised hypothesis?"`,
        });
      }

      case 'recruiter_pitch': {
        const { company, role, studentBackground } = payload;
        const tavilyData = await queryTavily(
          `${company} company culture founders hiring interview values`,
          3
        );

        return NextResponse.json({
          company,
          role,
          unspokenHiringBias: {
            whatTheyActuallyScreenFor:
              `High bias for action, autonomous problem-solving, and zero-to-one scrappiness over theoretical consulting decks.`,
            redFlagsToAvoid:
              `Avoid saying "I enjoy high-level strategy without execution." Avoid quoting generic MBA buzzwords without actual project metrics.`,
          },
          resumeAngleAdvice: [
            `Lead with quantified outcomes from your Masters' Union term challenges (e.g., Dropshipping revenue, Creator Challenge engagement).`,
            `Highlight technical fluency (SQL queries, API integrations, data modeling) alongside business strategy.`,
            `Show proven ability to operate in high-ambiguity environments with fast turnaround times.`,
          ],
          coldOutreachEmail: {
            subject: `Quick thought on ${company}'s growth + Masters' Union student profile`,
            body:
`Hi [Name],

I've been closely following ${company}'s trajectory, particularly your recent focus on scaling operations and customer experience.

I'm currently at Masters' Union (PGP TBM), where we focus on hands-on business building rather than textbook theory. Prior to this, ${studentBackground || 'I built and scaled digital initiatives, driving measurable revenue and cohort retention'}.

I put together a quick 1-page tear-down with 3 high-impact opportunities I noticed in ${company}'s current funnel that could optimize user retention and unit economics.

Would you be open to a brief 10-minute chat this week? Happy to send over the teardown either way.

Best regards,
[Your Name]
Masters' Union | [Phone]`,
          },
          linkedInDm:
`Hi [Name] — loved your recent work on ${company}'s expansion. I'm a student at Masters' Union with a background in hands-on venture building and product strategy. Put together a 3-point teardown on your onboarding funnel and would love to share it if you're open to it. No ask, just wanted to share the insights!`,
        });
      }

      case 'case_solver': {
        const { caseTopic } = payload;
        const tavilyData = await queryTavily(
          `${caseTopic} HBR Harvard Business Review case study analysis summary framework`,
          4
        );

        return NextResponse.json({
          caseTopic,
          synthesis:
            tavilyData.answer ||
            `Strategic case breakdown for "${caseTopic}" focusing on competitive dynamics, unit economics, and operational turnaround.`,
          meceIssueTree: {
            primaryQuestion: `How can the leadership team sustainably restore profitability and market dominance?`,
            branches: [
              {
                category: 'Revenue Optimization',
                subDrivers: [
                  'Price elasticity & tiered packaging restructuring',
                  'Cross-sell / Expansion into adjacent high-margin offerings',
                  'Retention cohort stabilization to reduce gross churn',
                ],
              },
              {
                category: 'Cost Structure & Unit Economics',
                subDrivers: [
                  'Variable cost rationalization (COGS, distribution fees)',
                  'Fixed overhead consolidation & tech infrastructure efficiency',
                  'CAC compression through organic product-led referral loops',
                ],
              },
              {
                category: 'Competitive Moat & Defensibility',
                subDrivers: [
                  'Strengthening proprietary data & customer switching costs',
                  'Strategic vendor/partner lock-in contracts',
                  'Repositioning value proposition away from commodity pricing wars',
                ],
              },
            ],
          },
          portersFiveForces: [
            { force: 'Threat of New Entrants', level: 'Moderate', rationale: 'High capital requirements, but low digital distribution barriers.' },
            { force: 'Bargaining Power of Buyers', level: 'High', rationale: 'Low switching costs for end consumers and abundance of alternatives.' },
            { force: 'Bargaining Power of Suppliers', level: 'Moderate', rationale: 'Key technology/cloud providers hold leverage, but raw inputs are commoditized.' },
            { force: 'Threat of Substitutes', level: 'High', rationale: 'Rapid evolution of adjacent solutions addressing the same underlying job-to-be-done.' },
            { force: 'Industry Rivalry', level: 'Intense', rationale: 'Hyper-competitive market with heavy price discounting among tier-1 competitors.' },
          ],
          decisionMatrix30_60_90: [
            {
              phase: 'Days 1–30 (Immediate Stabilization)',
              actions: [
                'Halt all cash-bleeding marketing campaigns that deliver sub-1.0 LTV/CAC.',
                'Audit customer exit surveys to identify the primary reason for churn.',
                'Establish weekly executive KPI war-room tracking net burn and active user retention.',
              ],
            },
            {
              phase: 'Days 31–60 (Structural Alignment)',
              actions: [
                'Roll out restructured pricing tier prioritizing annual upfront contracts.',
                'Re-architect the core onboarding funnel to reduce time-to-first-value.',
                'Sunset bottom 15% non-performing SKUs or feature bloat.',
              ],
            },
            {
              phase: 'Days 61–90 (Scalable Expansion)',
              actions: [
                'Launch strategic partnership with primary distribution ecosystem.',
                'Re-invest retained gross profit into defensible proprietary technology.',
                'Target break-even contribution margin across core business units.',
              ],
            },
          ],
        });
      }

      case 'speaker_agent': {
        const { speakerName, venture } = payload;
        const tavilyData = await queryTavily(
          `${speakerName} ${venture} founder CEO interview podcast lesson 2025 2026`,
          4
        );

        return NextResponse.json({
          speakerName,
          venture,
          executiveContext:
            tavilyData.answer ||
            `${speakerName} is known for high-conviction leadership, aggressive execution, and building resilient business models in competitive Indian markets.`,
          standoutQuestions: [
            {
              question:
                `"Looking back at ${venture}'s earliest near-death experience, what was the most counterintuitive decision you made that the board or team initially resisted?"`,
              whyThisWorks:
                'Avoids generic PR answers and forces the speaker to share real, vulnerable operational history.',
            },
            {
              question:
                `"Given how customer acquisition dynamics in India have shifted post-2024, what core assumption from your early playbook is now completely obsolete?"`,
              whyThisWorks:
                'Demonstrates you understand market evolution and invites them to critique their own legacy models.',
            },
            {
              question:
                `"When evaluating prospective team leads for your zero-to-one projects, what non-traditional signal do you look for that doesn't appear on a standard resume?"`,
              whyThisWorks:
                'Signals high ambition, curiosity about leadership, and naturally opens the door for a post-session career conversation.',
            },
          ],
          followUpNote: {
            linkedIn:
`Hi ${speakerName},

Thank you for visiting Masters' Union today. Your point regarding operational discipline during zero-to-one execution really resonated with our cohort.

I'm currently working on a venture initiative exploring similar dynamics in our term challenge. Would love to stay connected as we build.

Best regards,
[Your Name] | Masters' Union`,
          },
        });
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
