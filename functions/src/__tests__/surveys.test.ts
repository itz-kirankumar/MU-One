import { Firestore } from 'firebase-admin/firestore';
import { CallableRequest } from 'firebase-functions/v2/https';
import { runSurveyAction, StoredSurvey } from '../surveys/service';
import { surveyMember } from '../surveys/portal';
import { validateDraft, validateAnswers } from '../surveys/validation';

// Transactional memory store exercises service behavior without production data.
// Production atomicity is provided by Firestore's runTransaction.
const documents = new Map<string, Record<string, unknown>>();
let sequence = 0;
let queue = Promise.resolve();
class Ref {
  constructor(readonly path: string) {}
  get id() { return this.path.split('/').pop()!; }
  collection(name: string) { return new Collection(`${this.path}/${name}`); }
  async get() { return new Snapshot(this); }
}
class Snapshot {
  readonly value: Record<string, unknown> | undefined;
  constructor(readonly ref: Ref) { this.value = documents.has(ref.path) ? structuredClone(documents.get(ref.path)) : undefined; }
  get id() { return this.ref.id; }
  get exists() { return this.value !== undefined; }
  data() { return this.value; }
}
class Collection {
  conditions: [string, unknown][] = [];
  orders: [string, string][] = [];
  maximum = Infinity;
  cursor: Snapshot | string | undefined;
  constructor(readonly path: string) {}
  doc(id = `generated${String(++sequence).padStart(12, '0')}`) { return new Ref(`${this.path}/${id}`); }
  where(field: string, _op: string, value: unknown) { this.conditions.push([field, value]); return this; }
  orderBy(field: unknown, direction = 'asc') { this.orders.push([typeof field === 'string' ? field : '__name__', direction]); return this; }
  limit(max: number) { this.maximum = max; return this; }
  startAfter(cursor: Snapshot | string) { this.cursor = cursor; return this; }
  async get() {
    const field = (snapshot: Snapshot, key: string): string => key === '__name__' ? snapshot.id : String(snapshot.data()?.[key]);
    const compare = (a: Snapshot, b: Snapshot) => {
      for (const [key, direction] of this.orders) {
        const order = field(a, key).localeCompare(field(b, key));
        if (order) return direction === 'desc' ? -order : order;
      }
      return 0;
    };
    let docs = [...documents.keys()].filter(path => path.startsWith(`${this.path}/`) && path.split('/').length === this.path.split('/').length + 1)
      .map(path => new Snapshot(new Ref(path)))
      .filter(snapshot => this.conditions.every(([key, value]) => snapshot.data()?.[key] === value)).sort(compare);
    if (this.cursor instanceof Snapshot) {
      const cursor = this.cursor;
      docs = docs.filter(doc => compare(doc, cursor) > 0);
    } else if (typeof this.cursor === 'string') {
      const cursor = this.cursor;
      docs = docs.filter(doc => doc.id > cursor);
    }
    return { docs: docs.slice(0, this.maximum) };
  }
}
const db = {
  collection: (path: string) => new Collection(path),
  getAll: (...refs: Ref[]) => Promise.all(refs.map(ref => ref.get())),
  runTransaction: <T>(callback: (tx: { get: (ref: Ref) => Promise<Snapshot>; create: (ref: Ref, data: object) => void; update: (ref: Ref, data: object) => void }) => Promise<T>) => {
    const pending = queue.then(async () => {
      const writes: (() => void)[] = [];
      const result = await callback({ get: ref => ref.get(),
        create: (ref, data) => { if (documents.has(ref.path)) throw new Error('Already exists'); writes.push(() => documents.set(ref.path, structuredClone(data) as Record<string, unknown>)); },
        update: (ref, data) => { writes.push(() => documents.set(ref.path, { ...documents.get(ref.path), ...structuredClone(data) })); },
      });
      writes.forEach(write => write());
      return result;
    });
    queue = pending.then(() => undefined, () => undefined);
    return pending;
  },
} as unknown as Firestore;

const now = Date.parse('2026-09-18T12:00:00Z');
const owner = { uid: 'owner', name: 'Survey Creator', email: 'owner@mastersunion.org' };
const member = { uid: 'private-member-uid-918', name: 'Respondent Name', email: 'person@mastersunion.org' };
const surveyId = 'survey-0000000001';
const draft = { title: 'Test a campus idea', description: 'Help validate demand.', anonymousAuthor: true, anonymousResponses: true, durationDays: 14,
  questions: [
    { id: 'untrusted', title: 'Would you use it?', type: 'choice', required: true, options: ['Yes', 'No'] },
    { title: 'How useful?', type: 'rating', required: true, options: [] },
    { title: 'What could improve?', type: 'text', required: false, options: [] },
  ] };
const answers = [{ questionId: 'q1', value: 0 }, { questionId: 'q2', value: 4 }, { questionId: 'q3', value: 'More evening availability.' }];
const action = (request: object, user = owner, time = now) => runSurveyAction(db, user, request, time);
const stored = () => documents.get(`surveys/${surveyId}`) as unknown as StoredSurvey;
const publish = (changes: object = {}) => action({ action: 'create', requestId: surveyId, draft: { ...draft, ...changes } });

beforeEach(() => { documents.clear(); sequence = 0; queue = Promise.resolve(); });

test('requires a signed-in, verified MU member', () => {
  expect(() => surveyMember({} as CallableRequest)).toThrow();
  for (const token of [{ email: 'x@example.com', email_verified: true }, { email: 'x@mastersunion.org', email_verified: false }]) {
    expect(() => surveyMember({ auth: { uid: 'x', token } } as CallableRequest)).toThrow();
  }
  expect(surveyMember({ auth: { uid: 'x', token: { email: 'x@mastersunion.org', email_verified: true, name: 'Name' } } } as unknown as CallableRequest).uid).toBe('x');
});

test('publishes once on retry and hides anonymous ownership in both feed and detail', async () => {
  await Promise.all([publish(), publish()]);
  expect(documents.size).toBe(1);
  expect(stored().questions[0].id).toBe('q1');
  const detail = await action({ action: 'detail', surveyId }, member);
  const feed = await action({ action: 'list' }, member);
  for (const result of [detail, feed]) {
    expect(JSON.stringify(result)).not.toContain('ownerUid');
    expect(JSON.stringify(result)).not.toContain(owner.name);
    expect(JSON.stringify(result)).not.toContain(owner.email);
  }
  expect(detail).toMatchObject({ authorName: 'Anonymous member', isOwner: false, hasResponded: false });
  expect(await action({ action: 'detail', surveyId })).toMatchObject({ isOwner: true });
});

test('records anonymous answers once even for concurrent submissions and retries', async () => {
  await publish();
  await Promise.all(Array.from({ length: 4 }, () => action({ action: 'respond', surveyId, answers }, member)));
  expect(stored()).toMatchObject({ responseCount: 1, counts: { q1: { '0': 1 }, q2: { '4': 1 } }, answeredCounts: { q1: 1, q2: 1, q3: 1 } });
  const results = await action({ action: 'results', surveyId });
  expect(JSON.stringify(results)).not.toContain(member.uid);
  expect(JSON.stringify(results)).not.toContain(member.name);
  expect(JSON.stringify(results)).not.toContain(member.email);
  expect(results).toMatchObject({ responses: [{ respondent: null, answers }] });
  expect(documents.get(`surveys/${surveyId}/receipts/${member.uid}`)).toEqual({ submitted: true });
  expect(await action({ action: 'detail', surveyId }, member)).toMatchObject({ hasResponded: true });
});

test('identified responses require consent and use verified identity, never request identity', async () => {
  await publish({ anonymousAuthor: false, anonymousResponses: false });
  await expect(action({ action: 'respond', surveyId, answers }, member)).rejects.toThrow('Agree');
  await action({ action: 'respond', surveyId, answers, consent: true, respondent: owner }, member);
  expect(await action({ action: 'results', surveyId })).toMatchObject({ responses: [{ respondent: { name: member.name, email: member.email } }] });
});

test('only owners can read results or close surveys; owners cannot inflate response counts', async () => {
  await publish();
  await expect(action({ action: 'results', surveyId }, member)).rejects.toThrow('Only the creator');
  await expect(action({ action: 'close', surveyId }, member)).rejects.toThrow('Only the creator');
  await expect(action({ action: 'respond', surveyId, answers })).rejects.toThrow('Creators cannot');
  await action({ action: 'close', surveyId });
  await expect(action({ action: 'respond', surveyId, answers }, member)).rejects.toThrow('closed');
  expect(stored().responseCount).toBe(0);
});

test('expired surveys are displayed closed and reject submissions', async () => {
  await publish();
  const after = now + 15 * 86400000;
  expect(await action({ action: 'detail', surveyId }, member, after)).toMatchObject({ status: 'closed' });
  await expect(action({ action: 'respond', surveyId, answers }, member, after)).rejects.toThrow('closed');
});

test('invalid answers do not create a participation record or change counts', async () => {
  await publish();
  await expect(action({ action: 'respond', surveyId, answers: [{ questionId: 'q1', value: 99 }] }, member)).rejects.toThrow();
  expect(documents.size).toBe(1);
  expect(stored().responseCount).toBe(0);
  await action({ action: 'respond', surveyId, answers: answers.map(a => a.questionId === 'q3' ? { ...a, value: null } : a) }, member);
  expect(stored().answeredCounts.q3).toBeUndefined();
});

test('feed pagination is bounded and My surveys only includes the caller’s surveys', async () => {
  for (let i = 0; i < 23; i++) await action({ action: 'create', requestId: `survey-${String(i).padStart(12, '0')}`, draft }, i === 0 ? member : owner, now + i);
  const page = await action({ action: 'list' }) as { surveys: { id: string }[]; nextCursor: string };
  expect(page.surveys).toHaveLength(20);
  const next = await action({ action: 'list', cursor: page.nextCursor }) as { surveys: { id: string }[]; nextCursor: null };
  expect(next.surveys).toHaveLength(3);
  expect(new Set([...page.surveys, ...next.surveys].map(s => s.id)).size).toBe(23);
  expect(next.nextCursor).toBeNull();
  const own = await action({ action: 'list', mine: true }, member) as { surveys: unknown[] };
  expect(own.surveys).toHaveLength(1);
});

test('results page through all responses without leaking private ledger entries', async () => {
  await publish();
  for (let i = 0; i < 52; i++) await action({ action: 'respond', surveyId, answers }, { ...member, uid: `member-${i}` });
  const page = await action({ action: 'results', surveyId }) as { responses: unknown[]; nextCursor: string };
  expect(page.responses).toHaveLength(50);
  const next = await action({ action: 'results', surveyId, cursor: page.nextCursor }) as { responses: unknown[]; nextCursor: null };
  expect(next.responses).toHaveLength(2);
  expect(next.nextCursor).toBeNull();
  expect(stored().responseCount).toBe(52);
});

test.each([
  { title: '' }, { title: 'x'.repeat(121) }, { durationDays: 0 }, { durationDays: 91 },
  { anonymousAuthor: 'true' }, { questions: [] }, { questions: Array(11).fill(draft.questions[0]) },
  { questions: [{ ...draft.questions[0], options: ['Yes', ' yes '] }] },
  { questions: [{ ...draft.questions[0], type: 'unknown' }] },
])('rejects malformed survey drafts: %j', invalid => {
  expect(() => validateDraft({ ...draft, ...invalid })).toThrow();
});

test.each([
  [{ questionId: 'q1', value: 2 }, answers[1], answers[2]],
  [answers[0], { questionId: 'q2', value: 6 }, answers[2]],
  [answers[0], { questionId: 'q2', value: null }, answers[2]],
  [answers[0], answers[1], { questionId: 'q3', value: 'x'.repeat(1501) }],
  [answers[0], answers[0], answers[2]],
].map(invalid => ({ invalid })))('rejects invalid or duplicate answers', ({ invalid }) => {
  expect(() => validateAnswers(invalid, validateDraft(draft).questions)).toThrow();
});
