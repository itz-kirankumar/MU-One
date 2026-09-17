import { NextRequest, NextResponse } from 'next/server';

const TAVILY_API_KEY =
  process.env.TAVILY_API_KEY || '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';

interface ResearchRequest {
  subject?: string;
  body?: string;
  snippet?: string;
  query?: string;
  type?: 'company' | 'competition' | 'speaker' | 'general';
}

export interface ResearchResult {
  topicType: 'company' | 'competition' | 'speaker' | 'general';
  summary: string;
  keyPoints: string[];
  suggestedQuestions: string[];
  sources: Array<{ title: string; url: string }>;
}

function classifyTopic(subject: string, body: string): {
  topicType: ResearchResult['topicType'];
  searchQuery: string;
} {
  const text = `${subject} ${body}`.toLowerCase();

  const competitionPatterns = [
    /\b(competition|hackathon|case comp|pitch|challenge|brandstorm|l\.?i\.?m\.?e|ideathon|b-?plan|t\.?u\.?p|case study competition)\b/,
  ];
  const companyPatterns = [
    /\b(placement|hiring|recruit|job|jd|live project|internship|ctc|stipend|company visit|industry immersion)\b/,
  ];
  const speakerPatterns = [
    /\b(masterclass|guest lecture|fireside|speaker|cxo|ceo|founder|keynote|session with|interaction with)\b/,
  ];

  if (competitionPatterns.some((p) => p.test(text))) {
    const cleanSub = subject.replace(/^(fwd|re):\s*/i, '').trim();
    const query = `${cleanSub} competition winning strategy past winners guidelines`;
    return { topicType: 'competition', searchQuery: query };
  }

  if (companyPatterns.some((p) => p.test(text))) {
    const companyMatch = subject.match(
      /(?:at|with|from|by|for|–|-)\s+([A-Z][A-Za-z0-9&.\s]{1,40})/
    );
    const companyName = companyMatch ? companyMatch[1].trim() : '';
    const query = companyName
      ? `${companyName} company overview business model funding revenue competitors 2025 2026`
      : `${subject} company overview hiring`;
    return { topicType: 'company', searchQuery: query };
  }

  if (speakerPatterns.some((p) => p.test(text))) {
    const nameMatch = subject.match(
      /(?:with|by|from|session|masterclass|lecture)\s*[:\-–]?\s*([A-Z][A-Za-z.\s]{2,35})/i
    );
    const speakerName = nameMatch ? nameMatch[1].trim() : '';
    const query = speakerName
      ? `${speakerName} founder CEO career bio achievements latest interview`
      : `${subject} speaker biography career achievements`;
    return { topicType: 'speaker', searchQuery: query };
  }

  return {
    topicType: 'general',
    searchQuery: `${subject} summary key insights overview`,
  };
}

export async function POST(req: NextRequest) {
  try {
    const data: ResearchRequest = await req.json();
    const { subject = '', body = '', snippet = '', query: explicitQuery, type: explicitType } = data;

    let topicType: ResearchResult['topicType'] = explicitType || 'general';
    let searchQuery = explicitQuery || '';

    if (!searchQuery) {
      if (!subject && !body && !snippet) {
        return NextResponse.json(
          { error: 'Provide a query or email subject/body' },
          { status: 400 }
        );
      }
      const fullText = `${subject}\n${body || snippet}`;
      const detected = classifyTopic(subject, fullText);
      topicType = explicitType || detected.topicType;
      searchQuery = detected.searchQuery;
    }

    const tavilyRes = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: TAVILY_API_KEY,
        query: searchQuery,
        search_depth: 'advanced',
        include_answer: true,
        max_results: 5,
      }),
    });

    if (!tavilyRes.ok) {
      const errText = await tavilyRes.text();
      return NextResponse.json(
        { error: `Tavily API error (${tavilyRes.status}): ${errText}` },
        { status: 502 }
      );
    }

    const response = await tavilyRes.json();
    const answer = typeof response.answer === 'string' ? response.answer : '';
    const results = Array.isArray(response.results) ? response.results : [];

    const keyPoints: string[] = [];
    for (const r of results.slice(0, 4)) {
      if (r.content && typeof r.content === 'string') {
        const sentences = r.content
          .split(/[.!?]\s+/)
          .filter((s: string) => s.trim().length > 25);
        if (sentences.length > 0) {
          keyPoints.push(sentences[0].trim() + '.');
        }
      }
    }

    const suggestedQuestions: string[] = [];
    if (topicType === 'competition') {
      suggestedQuestions.push(
        'What were the winning themes and decks from previous editions of this challenge?',
        'What are the primary evaluation metrics and judging criteria?',
        'What is the recommended team structure and timeline breakdown for submissions?'
      );
    } else if (topicType === 'company') {
      suggestedQuestions.push(
        "What is the company's core business model, target market, and unit economics?",
        'Who are their primary competitors and what is their moat / unique value proposition?',
        'What are the most common technical / managerial questions asked in their interview rounds?'
      );
    } else if (topicType === 'speaker') {
      suggestedQuestions.push(
        'What was the most critical inflection point or pivot in your venture/career?',
        'How do you identify high-conviction opportunities in an uncertain market?',
        'What are the core mental models you rely on when making high-stakes decisions?'
      );
    } else {
      suggestedQuestions.push(
        'What are the core strategic takeaways from this initiative?',
        'What immediate action steps are required to prepare for this deadline?'
      );
    }

    const sources = results
      .filter((r: { title?: string; url?: string }) => r.title && r.url)
      .slice(0, 5)
      .map((r: { title: string; url: string }) => ({
        title: r.title,
        url: r.url,
      }));

    const result: ResearchResult = {
      topicType,
      summary:
        answer ||
        (keyPoints.length > 0
          ? keyPoints.join(' ')
          : 'Detailed research gathered for this topic.'),
      keyPoints: keyPoints.length > 0 ? keyPoints : ['No detailed insights found.'],
      suggestedQuestions,
      sources,
    };

    return NextResponse.json(result);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
