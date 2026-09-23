import { FOUNDER_QUESTIONS } from '../founder/taxonomy';
import { runFounderAction, type FounderMember } from '../founder/service';
import { MemoryStore } from './helpers/memoryFirestore';

const alex: FounderMember = { uid: 'alexfounder123', email: 'alex@mastersunion.org', name: 'Alex', photoURL: '' };
const sam: FounderMember = { uid: 'samfounder1234', email: 'sam@mastersunion.org', name: 'Sam', photoURL: '' };
const deps = { apiKey: '', model: 'jev-latest' };

function questionnaireAnswers(seed: number) {
  return Object.fromEntries(FOUNDER_QUESTIONS.map(question => {
    if (question.kind === 'text') return [question.id, question.id === 'st_sop'
      ? 'I built a student marketplace after interviewing dozens of classmates, shipped an MVP with a small team and measured repeat usage. I want to work with someone who can challenge my assumptions, talk to customers and help turn those early lessons into a reliable business.'
      : question.id === 'st_proud'
        ? 'I shipped a booking tool for our student club, owned the product specification and measured whether organizers used it every week.'
        : 'A thoughtful builder who likes customer conversations.'];
    if (question.kind === 'multi') return [question.id, [seed]];
    if (question.kind === 'single') return [question.id, seed % (question.options?.length ?? 1)];
    return [question.id, question.min ?? 0];
  }));
}

describe('Founder Connect service flow', () => {
  const store = new MemoryStore();
  const db = store.asFirestore();
  const call = (member: FounderMember, input: Record<string, unknown>) => runFounderAction(db, member, input, deps);

  beforeEach(() => store.reset());

  test('connection status reads only the requesting member and omits private LinkedIn identifiers', async () => {
    store.seed(`founderLinkedInConnections/${alex.uid}`, {
      sub: 'private-linkedin-id', name: 'Alex Founder', email: 'alex@example.com', linkedAt: '2026-09-23T10:00:00.000Z',
    });
    expect(await call(alex, { action: 'connectionStatus' })).toEqual({
      linkedinConnection: { name: 'Alex Founder', linkedAt: '2026-09-23T10:00:00.000Z' },
    });
    expect(await call(sam, { action: 'connectionStatus' })).toEqual({ linkedinConnection: null });
  });

  test('requires explicit AI consent before storing a complete profile', async () => {
    await expect(call(alex, { action: 'submitQuestionnaire', answers: questionnaireAnswers(0) }))
      .rejects.toThrow(/Agree to AI-assisted/);
    expect(store.get(`founderProfiles/${alex.uid}`)).toBeUndefined();
  });

  test('onboards two members, matches them, and keeps private answers out of lookup', async () => {
    const record = { source: 'manual', headline: 'Software builder', summary: 'Built student tools', roles: [], education: [], skills: ['TypeScript'] };
    await call(alex, { action: 'importLinkedIn', record });
    await call(alex, { action: 'submitQuestionnaire', answers: questionnaireAnswers(0), aiConsent: true });
    const before = await call(alex, { action: 'lookup', email: sam.email });
    expect(before).toMatchObject({ found: false, onboarded: false });
    await call(sam, { action: 'submitQuestionnaire', answers: questionnaireAnswers(1), aiConsent: true });
    const found = await call(alex, { action: 'lookup', email: sam.email });
    expect(found).toMatchObject({ found: true, onboarded: true });
    expect(JSON.stringify(found)).not.toContain('st_sop');
    const matched = await call(alex, { action: 'match', uid: sam.uid });
    expect(matched).toMatchObject({ report: { counterpart: { uid: sam.uid } } });
    expect((matched as { report: { score: number } }).report.score).toBeGreaterThanOrEqual(0);
  });

  test('publishes an anonymous idea without exposing its author in the feed', async () => {
    await call(alex, { action: 'submitQuestionnaire', answers: questionnaireAnswers(0), aiConsent: true });
    await call(sam, { action: 'submitQuestionnaire', answers: questionnaireAnswers(1), aiConsent: true });
    await call(alex, { action: 'createPost', requestId: 'anonymousidea123', draft: {
      kind: 'idea', title: 'A smarter campus map', body: 'Students should find every open study space.',
      tags: [0], anonymous: true,
      idea: { problem: 'Students waste time hunting for available study spaces.', stage: 'validating', lookingFor: [0] },
      poll: null,
    } });
    const feed = await call(sam, { action: 'listPosts' }) as { posts: Array<{ authorUid: string; authorName: string }> };
    expect(feed.posts).toHaveLength(1);
    expect(feed.posts[0]).toMatchObject({ authorUid: '', authorName: 'Anonymous founder' });
    expect(store.get('founderPosts/anonymousidea123')).toMatchObject({ authorUid: alex.uid });
  });

  test('only participants can read a message thread', async () => {
    await call(alex, { action: 'submitQuestionnaire', answers: questionnaireAnswers(0), aiConsent: true });
    await call(sam, { action: 'submitQuestionnaire', answers: questionnaireAnswers(1), aiConsent: true });
    const sent = await call(alex, { action: 'sendMessage', toUid: sam.uid, body: 'Would you like to compare founder notes?' }) as { threadId: string };
    const inbox = await call(sam, { action: 'listMessages', threadId: sent.threadId }) as { messages: Array<{ body: string }> };
    expect(inbox.messages[0].body).toMatch(/founder notes/);
    const outsider: FounderMember = { uid: 'outsider12345', email: 'outsider@mastersunion.org', name: 'Outsider', photoURL: '' };
    await call(outsider, { action: 'submitQuestionnaire', answers: questionnaireAnswers(0), aiConsent: true });
    await expect(call(outsider, { action: 'listMessages', threadId: sent.threadId })).rejects.toThrow(/not your conversation/);
  });
});
