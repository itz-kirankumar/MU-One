import { applyJevMailFallback, classifyMailWithJev } from '../integrations/jev';
import type { NormalizedMailSignal } from '../utils/mailParsing';

const baseMail: NormalizedMailSignal = {
  messageId: 'mail-1', sender: 'faculty@mastersunion.org', subject: 'Cohort update',
  snippet: 'Please complete the feedback form.', receivedAt: '2026-09-19T00:00:00.000Z',
  isDeadlineSignal: false, dueDate: null, deadlineSource: null, gmailLink: 'https://mail.google.com/mail/u/0/#inbox/mail-1',
};

test('calls the native JEV decision endpoint and normalizes its answer', async () => {
  const fetcher = jest.fn(async (url: string | URL | Request, init?: RequestInit) => {
    expect(String(url)).toBe('https://api.experientiallabs.ai/v1/systemone');
    expect(init?.headers).toMatchObject({ Authorization: 'Bearer private-key' });
    const body = JSON.parse(String(init?.body));
    expect(body).toMatchObject({ model: 'jev-latest', questions: { category: { type: 'choice' }, urgency: { type: 'noul' } } });
    return new Response(JSON.stringify({ model: 'jev-latest', answers: {
      category: { choice: 'deadline', confidence: 0.91 }, urgency: { noul: 0.8 },
    } }), { status: 200 });
  }) as typeof fetch;
  await expect(classifyMailWithJev('private-key', baseMail, 'jev-latest', fetcher)).resolves.toEqual({
    model: 'jev-latest', category: 'deadline', confidence: 0.91, urgency: 0.8,
  });
});

test('keeps deterministic results authoritative and applies JEV only as fallback', () => {
  const classification = { model: 'jev-latest', category: 'deadline' as const, confidence: 0.9, urgency: 0.8 };
  expect(applyJevMailFallback(baseMail, classification)).toMatchObject({
    isDeadlineSignal: true, deadlineSource: 'jev', importance: 'high', jevClassification: classification,
  });
  expect(applyJevMailFallback({ ...baseMail, isDeadlineSignal: true, deadlineSource: 'deterministic' }, classification))
    .toMatchObject({ isDeadlineSignal: true, deadlineSource: 'deterministic' });
});

test('rejects malformed provider answers', async () => {
  const fetcher = jest.fn(async () => new Response(JSON.stringify({ answers: {
    category: { choice: 'unknown' }, urgency: { noul: 4 },
  } }), { status: 200 })) as typeof fetch;
  await expect(classifyMailWithJev('key', baseMail, 'jev-latest', fetcher)).rejects.toThrow('invalid mail category');
});
