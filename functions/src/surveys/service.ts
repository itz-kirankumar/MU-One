import { FieldPath, Firestore, Query } from 'firebase-admin/firestore';
import { HttpsError } from 'firebase-functions/v2/https';
import { Survey, SurveyResults, SurveyResponse } from './model';
import { documentId, object, validateAnswers, validateDraft } from './validation';

export interface SurveyMember { uid: string; name: string; email: string }
export interface StoredSurvey extends Omit<Survey, 'id' | 'isOwner' | 'hasResponded'> {
  ownerUid: string;
  counts: SurveyResults['counts'];
  answeredCounts: SurveyResults['answeredCounts'];
}

// Always project public fields explicitly. Anonymous ownership never leaves the server.
export function publicSurvey(id: string, data: StoredSurvey, uid: string, responded: boolean, now: number): Survey {
  return { id, title: data.title, description: data.description, questions: data.questions,
    anonymousAuthor: data.anonymousAuthor, anonymousResponses: data.anonymousResponses,
    authorName: data.anonymousAuthor ? 'Anonymous member' : data.authorName,
    createdAt: data.createdAt, closesAt: data.closesAt,
    status: data.status === 'closed' || Date.parse(data.closesAt) <= now ? 'closed' : 'open',
    responseCount: data.responseCount, isOwner: data.ownerUid === uid, hasResponded: responded };
}

function requireOwner(data: StoredSurvey, member: SurveyMember) {
  if (data.ownerUid !== member.uid) throw new HttpsError('permission-denied', 'Only the creator can manage this survey.');
}

/** All survey reads and writes go through this service, never directly from a browser. */
export async function runSurveyAction(db: Firestore, member: SurveyMember, input: unknown, now = Date.now()) {
  const request = object(input);
  const surveys = db.collection('surveys');
  if (request.action === 'create') {
    const draft = validateDraft(request.draft);
    const ref = surveys.doc(documentId(request.requestId));
    await db.runTransaction(async tx => {
      const existing = await tx.get(ref);
      if (existing.exists) {
        requireOwner(existing.data() as StoredSurvey, member);
        return; // A retry after a lost connection must not publish a second survey.
      }
      const data: StoredSurvey = {
        title: draft.title, description: draft.description, questions: draft.questions,
        anonymousAuthor: draft.anonymousAuthor, anonymousResponses: draft.anonymousResponses,
        authorName: draft.anonymousAuthor ? 'Anonymous member' : member.name,
        ownerUid: member.uid, createdAt: new Date(now).toISOString(),
        closesAt: new Date(now + draft.durationDays * 86400000).toISOString(),
        status: 'open', responseCount: 0, counts: {}, answeredCounts: {},
      };
      tx.create(ref, data);
    });
    return { id: ref.id };
  }

  if (request.action === 'list') {
    let query: Query = surveys;
    if (request.mine === true) query = query.where('ownerUid', '==', member.uid);
    query = query.orderBy('createdAt', 'desc').orderBy(FieldPath.documentId(), 'desc');
    if (request.cursor) {
      const cursor = await surveys.doc(documentId(request.cursor)).get();
      if (!cursor.exists) throw new HttpsError('invalid-argument', 'This page is no longer available. Refresh the feed.');
      query = query.startAfter(cursor);
    }
    const snapshot = await query.limit(21).get();
    const docs = snapshot.docs.slice(0, 20);
    const receipts = docs.length ? await db.getAll(...docs.map(doc => doc.ref.collection('receipts').doc(member.uid))) : [];
    return { surveys: docs.map((doc, index) => publicSurvey(doc.id, doc.data() as StoredSurvey, member.uid, receipts[index].exists, now)),
      nextCursor: snapshot.docs.length > 20 ? docs[docs.length - 1].id : null };
  }

  const ref = surveys.doc(documentId(request.surveyId));
  if (request.action === 'respond') {
    const receipt = ref.collection('receipts').doc(member.uid);
    const responseRef = ref.collection('responses').doc();
    return db.runTransaction(async tx => {
      const [snapshot, previous] = await Promise.all([tx.get(ref), tx.get(receipt)]);
      if (!snapshot.exists) throw new HttpsError('not-found', 'Survey not found.');
      const data = snapshot.data() as StoredSurvey;
      if (previous.exists) return { submitted: true }; // Safe retry; counts stay unchanged.
      if (data.ownerUid === member.uid) throw new HttpsError('failed-precondition', 'Creators cannot answer their own survey.');
      if (data.status !== 'open' || Date.parse(data.closesAt) <= now) {
        throw new HttpsError('failed-precondition', 'This survey is closed.');
      }
      if (!data.anonymousResponses && request.consent !== true) {
        throw new HttpsError('invalid-argument', 'Agree to share your name and email before submitting.');
      }
      const answers = validateAnswers(request.answers, data.questions);
      const counts = structuredClone(data.counts);
      const answeredCounts = { ...data.answeredCounts };
      for (const answer of answers) {
        if (answer.value === null) continue;
        answeredCounts[answer.questionId] = (answeredCounts[answer.questionId] ?? 0) + 1;
        if (typeof answer.value === 'number') {
          const values = counts[answer.questionId] ?? {};
          values[String(answer.value)] = (values[String(answer.value)] ?? 0) + 1;
          counts[answer.questionId] = values;
        }
      }
      // The private dedup ledger contains no response ID. Anonymous answers contain no account identity.
      tx.create(receipt, { submitted: true });
      tx.create(responseRef, { answers, respondent: data.anonymousResponses ? null : { name: member.name, email: member.email } });
      tx.update(ref, { responseCount: data.responseCount + 1, counts, answeredCounts });
      return { submitted: true };
    });
  }

  if (request.action === 'close') {
    await db.runTransaction(async tx => {
      const snapshot = await tx.get(ref);
      if (!snapshot.exists) throw new HttpsError('not-found', 'Survey not found.');
      requireOwner(snapshot.data() as StoredSurvey, member);
      tx.update(ref, { status: 'closed' });
    });
    return { closed: true };
  }

  const snapshot = await ref.get();
  if (!snapshot.exists) throw new HttpsError('not-found', 'Survey not found.');
  const data = snapshot.data() as StoredSurvey;
  if (request.action === 'detail') {
    const receipt = await ref.collection('receipts').doc(member.uid).get();
    return publicSurvey(ref.id, data, member.uid, receipt.exists, now);
  }
  if (request.action === 'results') {
    requireOwner(data, member);
    let query: Query = ref.collection('responses').orderBy(FieldPath.documentId());
    if (request.cursor) query = query.startAfter(documentId(request.cursor));
    const responses = await query.limit(51).get();
    const page = responses.docs.slice(0, 50);
    const result: SurveyResults = {
      survey: publicSurvey(ref.id, data, member.uid, false, now),
      counts: data.counts, answeredCounts: data.answeredCounts,
      responses: page.map(doc => {
        const response = doc.data();
        return { id: doc.id, answers: response.answers,
          respondent: data.anonymousResponses ? null : response.respondent } as SurveyResponse;
      }),
      nextCursor: responses.docs.length > 50 ? page[page.length - 1].id : null,
    };
    return result;
  }
  throw new HttpsError('invalid-argument', 'Unknown survey action.');
}
