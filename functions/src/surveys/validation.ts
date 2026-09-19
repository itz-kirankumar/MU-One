import { HttpsError } from 'firebase-functions/v2/https';
import { SurveyAnswer, SurveyDraft, SurveyQuestion } from './model';

export function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new HttpsError('invalid-argument', 'Invalid survey request.');
  }
  return value as Record<string, unknown>;
}

export function text(value: unknown, label: string, max: number): string {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max) {
    throw new HttpsError('invalid-argument', `${label} must contain 1–${max} characters.`);
  }
  return value.trim();
}

export function documentId(value: unknown): string {
  if (typeof value !== 'string' || !/^[a-zA-Z0-9_-]{10,80}$/.test(value)) {
    throw new HttpsError('invalid-argument', 'Invalid survey or page identifier.');
  }
  return value;
}

export function validateDraft(input: unknown): SurveyDraft {
  const data = object(input);
  const title = text(data.title, 'Title', 120);
  const description = text(data.description, 'Description', 1500);
  if (typeof data.anonymousAuthor !== 'boolean' || typeof data.anonymousResponses !== 'boolean') {
    throw new HttpsError('invalid-argument', 'Choose the author and response privacy settings.');
  }
  if (!Number.isInteger(data.durationDays) || Number(data.durationDays) < 1 || Number(data.durationDays) > 90) {
    throw new HttpsError('invalid-argument', 'Surveys must run for 1–90 days.');
  }
  if (!Array.isArray(data.questions) || data.questions.length < 1 || data.questions.length > 10) {
    throw new HttpsError('invalid-argument', 'Add between 1 and 10 questions.');
  }
  const questions: SurveyQuestion[] = data.questions.map((raw, index) => {
    const q = object(raw);
    if (!['text', 'choice', 'rating'].includes(String(q.type)) || typeof q.required !== 'boolean') {
      throw new HttpsError('invalid-argument', 'Invalid question type or required setting.');
    }
    let options: string[] = [];
    if (q.type === 'choice') {
      if (!Array.isArray(q.options) || q.options.length < 2 || q.options.length > 8) {
        throw new HttpsError('invalid-argument', 'Choice questions need 2–8 options.');
      }
      options = q.options.map(option => text(option, 'Option', 100));
      if (new Set(options.map(option => option.toLowerCase())).size !== options.length) {
        throw new HttpsError('invalid-argument', 'Answer options must be different.');
      }
    }
    return { id: `q${index + 1}`, title: text(q.title, 'Question', 300),
      type: q.type as SurveyQuestion['type'], required: q.required, options };
  });
  return { title, description, questions, anonymousAuthor: data.anonymousAuthor,
    anonymousResponses: data.anonymousResponses, durationDays: Number(data.durationDays) };
}

export function validateAnswers(input: unknown, questions: SurveyQuestion[]): SurveyAnswer[] {
  if (!Array.isArray(input) || input.length !== questions.length) {
    throw new HttpsError('invalid-argument', 'Submit an answer for every question, using null for optional blanks.');
  }
  const answers = input.map(object);
  if (new Set(answers.map(answer => answer.questionId)).size !== questions.length) {
    throw new HttpsError('invalid-argument', 'Duplicate question answers.');
  }
  return questions.map(question => {
    const answer = answers.find(item => item.questionId === question.id);
    if (!answer) throw new HttpsError('invalid-argument', 'Unknown question.');
    const value = typeof answer.value === 'string' ? answer.value.trim() : answer.value;
    if (value === null || value === '') {
      if (question.required) throw new HttpsError('invalid-argument', `Please answer: ${question.title}`);
      return { questionId: question.id, value: null };
    }
    if (question.type === 'text') return { questionId: question.id, value: text(value, 'Answer', 1500) };
    const min = question.type === 'rating' ? 1 : 0;
    const max = question.type === 'rating' ? 5 : question.options.length - 1;
    if (typeof value !== 'number' || !Number.isInteger(value) || value < min || value > max) {
      throw new HttpsError('invalid-argument', `Choose a valid answer for: ${question.title}`);
    }
    return { questionId: question.id, value };
  });
}
