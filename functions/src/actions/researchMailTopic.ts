import { onCall, HttpsError } from "firebase-functions/v2/https";
import { requireMuDomain } from "../utils/domainCheck";
import { tavily } from "@tavily/core";

const TAVILY_API_KEY =
  process.env.TAVILY_API_KEY || "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";

interface ResearchRequest {
  subject: string;
  body: string;
  snippet?: string;
}

export interface ResearchResult {
  topicType: "company" | "competition" | "speaker" | "general";
  summary: string;
  keyPoints: string[];
  suggestedQuestions: string[];
  sources: Array<{ title: string; url: string }>;
}

/**
 * Detects the topic type from email content.
 */
function classifyTopic(subject: string, body: string): {
  topicType: ResearchResult["topicType"];
  searchQuery: string;
} {
  const text = `${subject} ${body}`.toLowerCase();

  // Company / Placement / Live Project
  const companyPatterns = [
    /\b(placement|hiring|recruit|job|jd|live project|internship|ctc|stipend|company visit|industry immersion)\b/,
  ];
  // Competition / Hackathon
  const competitionPatterns = [
    /\b(competition|hackathon|case comp|pitch|challenge|brandstorm|l\.?i\.?m\.?e|ideathon|b-?plan|case study competition)\b/,
  ];
  // Speaker / Masterclass / Guest Lecture
  const speakerPatterns = [
    /\b(masterclass|guest lecture|fireside|speaker|cxo|ceo|founder|keynote|session with|interaction with)\b/,
  ];

  if (companyPatterns.some((p) => p.test(text))) {
    // Try to extract company name from subject
    const companyMatch = subject.match(
      /(?:at|with|from|by|for|–|-)\s+([A-Z][A-Za-z0-9&.\s]{1,40})/
    );
    const companyName = companyMatch ? companyMatch[1].trim() : "";
    const query = companyName
      ? `${companyName} company overview business model funding revenue competitors 2025 2026`
      : `${subject} company overview hiring`;
    return { topicType: "company", searchQuery: query };
  }

  if (competitionPatterns.some((p) => p.test(text))) {
    const query = `${subject} competition past winners winning strategy tips judging criteria`;
    return { topicType: "competition", searchQuery: query };
  }

  if (speakerPatterns.some((p) => p.test(text))) {
    // Try to extract speaker name
    const nameMatch = subject.match(
      /(?:with|by|from|session|masterclass|lecture)\s*[:\-–]?\s*([A-Z][A-Za-z.\s]{2,35})/i
    );
    const speakerName = nameMatch ? nameMatch[1].trim() : "";
    const query = speakerName
      ? `${speakerName} founder CEO career bio achievements latest interview`
      : `${subject} speaker biography career achievements`;
    return { topicType: "speaker", searchQuery: query };
  }

  return {
    topicType: "general",
    searchQuery: `${subject} summary key insights overview`,
  };
}

/**
 * Callable: researches the topic of an email using Tavily AI search.
 * Returns a structured dossier with summary, key points, questions, and sources.
 */
export const researchMailTopic = onCall(async (request) => {
  requireMuDomain(request);

  const { subject, body, snippet } = request.data as ResearchRequest;

  if (!subject && !body && !snippet) {
    throw new HttpsError(
      "invalid-argument",
      "At least one of subject, body, or snippet is required."
    );
  }

  if (!TAVILY_API_KEY) {
    throw new HttpsError(
      "failed-precondition",
      "Tavily API key is not configured."
    );
  }

  const fullText = `${subject || ""}\n${body || snippet || ""}`;
  const { topicType, searchQuery } = classifyTopic(subject || "", fullText);

  const tvly = tavily({ apiKey: TAVILY_API_KEY });

  try {
    const response = await tvly.search(searchQuery, {
      searchDepth: "advanced",
      includeAnswer: true,
      maxResults: 5,
    });

    const answer = typeof response.answer === "string" ? response.answer : "";
    const results = Array.isArray(response.results) ? response.results : [];

    // Build key points from result content
    const keyPoints: string[] = [];
    for (const r of results.slice(0, 4)) {
      if (r.content && typeof r.content === "string") {
        // Take first meaningful sentence
        const sentences = r.content.split(/[.!?]\s+/).filter((s: string) => s.trim().length > 20);
        if (sentences.length > 0) {
          keyPoints.push(sentences[0].trim() + ".");
        }
      }
    }

    // Generate suggested questions based on topic type
    const suggestedQuestions: string[] = [];
    if (topicType === "speaker") {
      suggestedQuestions.push(
        "What was the most counterintuitive lesson you learned while scaling your venture?",
        "How do you evaluate whether an idea is worth pursuing vs. pivoting away from?",
        "What skills do you wish you had developed earlier in your career?"
      );
    } else if (topicType === "company") {
      suggestedQuestions.push(
        "What is the company's core business model and revenue streams?",
        "Who are the main competitors and what differentiates this company?",
        "What recent funding rounds or strategic moves has the company made?"
      );
    } else if (topicType === "competition") {
      suggestedQuestions.push(
        "What frameworks have past winners typically used?",
        "What are the key evaluation criteria judges focus on?",
        "What common mistakes should teams avoid?"
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
      summary: answer || "No summary available for this topic.",
      keyPoints: keyPoints.length > 0 ? keyPoints : ["No detailed insights found."],
      suggestedQuestions,
      sources,
    };

    return result;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new HttpsError("internal", `Tavily research failed: ${msg}`);
  }
});
