/**
 * Every Founder Connect read and write.
 *
 * Reached only through `founderPortal`; the collections it owns are closed to
 * clients in `firestore.rules`, with one deliberate exception — DM threads,
 * which are readable by their two participants so the browser can listen for
 * new messages live. The feed has no such exception because an anonymous post's
 * author uid is stored on the document, and a rule that lets a browser read the
 * document lets it read the author.
 */

import { CollectionReference, DocumentSnapshot, FieldPath, Firestore, Query } from 'firebase-admin/firestore';
import { HttpsError } from 'firebase-functions/v2/https';
import { LINKEDIN_CLIENT_ID, LINKEDIN_REDIRECT_URI, LINKEDIN_OIDC_ENABLED } from '../config/params';
import {
  FOUNDER_QUESTIONS, INTEREST_LABELS, QUESTIONNAIRE_VERSION, SECTION_LABELS, SECTION_ORDER,
  SKILL_DOMAIN_LABELS, ARCHETYPE_LABELS, WORKING_STYLE_AXES, INTEREST_TAGS, SKILL_DOMAINS,
} from './taxonomy';
import type {
  FounderComment, FounderMessage, FounderPost, FounderProfile, FounderProfileSummary,
  FounderThread, MatchReport, StoredFounderProfile, StoredMatch,
} from './model';
import { deriveTraits, topSkills } from './traits';
import { rankCandidates, scorePair } from './scoring';
import { neutralSopValidation, sopTexture, validateSop } from './sop';
import { judgePair, unavailableJudgement } from './jevMatch';
import type { FounderBrief } from './jevMatch';
import {
  boolean, cursor as validateCursor, documentId, email as validateEmail, object,
  pollOptionId, selfRatedSkills, text, uid as validateUid, validateAnswers,
  validateComment, validateLinkedIn, validatePostDraft,
} from './validation';

export interface FounderMember { uid: string; name: string; email: string; photoURL: string }

export interface FounderDeps {
  apiKey: string;
  model: string;
  fetcher?: typeof fetch;
}

const PROFILES = 'founderProfiles';
const MATCHES = 'founderMatches';
const POSTS = 'founderPosts';
const THREADS = 'founderThreads';

/** Sorted so a pair maps to exactly one document whichever side asks. */
export function pairKey(a: string, b: string): string {
  return [a, b].sort().join('__');
}

/**
 * Cursors are document ids, but a `startAfter` on a multi-field ordering needs
 * the document itself so Firestore can read every sort key off it.
 */
async function anchor(collection: CollectionReference, id: string): Promise<DocumentSnapshot> {
  const snapshot = await collection.doc(id).get();
  if (!snapshot.exists) {
    throw new HttpsError('invalid-argument', 'This page is no longer available. Refresh and try again.');
  }
  return snapshot;
}

// ── Projections ─────────────────────────────────────────────────────────────

/**
 * The only shape another student ever sees. Answers, the raw LinkedIn record and
 * the SOP text stay on the server: a compatibility score is something you are
 * told, not something you can reverse-engineer from someone else's answers.
 */
function summaryOf(data: StoredFounderProfile): FounderProfileSummary {
  return {
    uid: data.uid,
    email: data.email,
    displayName: data.displayName,
    photoURL: data.photoURL,
    headline: data.headline,
    archetype: data.traits.archetype,
    interests: data.traits.interests,
    topSkills: topSkills(data.traits.skills),
    lookingFor: data.traits.lookingFor,
    onboardedAt: data.onboarding.completedAt ?? data.createdAt,
  };
}

function selfProfile(data: StoredFounderProfile): FounderProfile {
  return {
    ...summaryOf(data),
    linkedin: data.linkedin,
    traits: data.traits,
    sop: data.sop,
    visibility: data.visibility,
    version: data.version,
    isSelf: true,
  };
}

interface StoredPost {
  kind: FounderPost['kind'];
  authorUid: string;
  authorName: string;
  authorHeadline: string;
  authorPhoto: string;
  anonymous: boolean;
  title: string;
  body: string;
  tags: FounderPost['tags'];
  idea: FounderPost['idea'];
  poll: FounderPost['poll'];
  likeCount: number;
  commentCount: number;
  createdAt: string;
}

const ANONYMOUS = { name: 'Anonymous founder', headline: 'Identity hidden', photo: '' };

function publicPost(
  id: string, data: StoredPost, viewerUid: string, liked: boolean, vote: string | null,
): FounderPost {
  return {
    id,
    kind: data.kind,
    authorUid: data.anonymous ? '' : data.authorUid,
    authorName: data.anonymous ? ANONYMOUS.name : data.authorName,
    authorHeadline: data.anonymous ? ANONYMOUS.headline : data.authorHeadline,
    authorPhoto: data.anonymous ? ANONYMOUS.photo : data.authorPhoto,
    anonymous: data.anonymous,
    title: data.title,
    body: data.body,
    tags: data.tags,
    idea: data.idea,
    poll: data.poll,
    likeCount: data.likeCount,
    commentCount: data.commentCount,
    createdAt: data.createdAt,
    likedByMe: liked,
    myVote: vote,
    isAuthor: data.authorUid === viewerUid,
  };
}

// ── Profile loading ─────────────────────────────────────────────────────────

async function loadProfile(db: Firestore, uid: string): Promise<StoredFounderProfile | null> {
  const snapshot = await db.collection(PROFILES).doc(uid).get();
  return snapshot.exists ? snapshot.data() as StoredFounderProfile : null;
}

function isComplete(profile: StoredFounderProfile | null): boolean {
  return profile?.onboarding.status === 'complete';
}

function requireOnboarded(profile: StoredFounderProfile | null): StoredFounderProfile {
  if (!isComplete(profile)) {
    throw new HttpsError('failed-precondition', 'Complete your Founder Connect profile first.');
  }
  return profile as StoredFounderProfile;
}

function briefOf(profile: StoredFounderProfile): FounderBrief {
  return {
    traits: profile.traits,
    sop: profile.sop.text,
    proudOf: profile.sop.proudOf,
    headline: profile.linkedin?.headline ?? null,
    totalMonths: profile.linkedin?.totalMonths ?? null,
  };
}

// ── Matching ────────────────────────────────────────────────────────────────

/** The stored match minus the bookkeeping the client has no use for. */
function reportOf(stored: StoredMatch, other: StoredFounderProfile): MatchReport {
  return {
    pairId: stored.pairId,
    score: stored.score,
    band: stored.band,
    confidence: stored.confidence,
    components: stored.components,
    strengths: stored.strengths,
    frictions: stored.frictions,
    openQuestions: stored.openQuestions,
    judgement: stored.judgement,
    counterpart: summaryOf(other),
    computedAt: stored.computedAt,
  };
}

/**
 * Scores a pair, reusing the cached result while neither profile has changed.
 * The version pair is the cache key rather than a timestamp, so editing an
 * answer invalidates every match that answer contributed to, and nothing else.
 */
async function resolveMatch(
  db: Firestore,
  viewer: StoredFounderProfile,
  other: StoredFounderProfile,
  deps: FounderDeps,
  now: number,
): Promise<MatchReport> {
  const pairId = pairKey(viewer.uid, other.uid);
  const ref = db.collection(MATCHES).doc(pairId);
  const cached = await ref.get();

  if (cached.exists) {
    const stored = cached.data() as StoredMatch;
    const fresh = stored.versions?.[viewer.uid] === viewer.version
      && stored.versions?.[other.uid] === other.version
      // A judgement that failed last time is worth retrying on the next look.
      && stored.judgement.available;
    if (fresh) return reportOf(stored, other);
  }

  const judgement = deps.apiKey
    ? await judgePair(briefOf(viewer), briefOf(other), deps)
    : unavailableJudgement('not-configured');

  const scored = scorePair({
    a: viewer.traits,
    b: other.traits,
    sopA: viewer.sop.validation,
    sopB: other.sop.validation,
    judgement,
  });

  const stored: StoredMatch = {
    pairId,
    uids: [viewer.uid, other.uid].sort(),
    score: scored.score,
    band: scored.band,
    confidence: scored.confidence,
    components: scored.components,
    strengths: scored.strengths,
    frictions: scored.frictions,
    openQuestions: scored.openQuestions,
    judgement,
    versions: { [viewer.uid]: viewer.version, [other.uid]: other.version },
    computedAt: new Date(now).toISOString(),
  };
  await ref.set(stored);

  return reportOf(stored, other);
}

// ── Dispatcher ──────────────────────────────────────────────────────────────

export async function runFounderAction(
  db: Firestore,
  member: FounderMember,
  input: unknown,
  deps: FounderDeps,
  now = Date.now(),
) {
  const request = object(input);
  const action = request.action;
  const iso = new Date(now).toISOString();
  const profiles = db.collection(PROFILES);
  const posts = db.collection(POSTS);

  // ── Onboarding ──────────────────────────────────────────────────────────

  if (action === 'connectionStatus') {
    const snapshot = await db.collection('founderLinkedInConnections').doc(member.uid).get();
    const connection = snapshot.data();
    return {
      linkedinConnection: snapshot.exists ? {
        name: String(connection?.name || '').slice(0, 150),
        linkedAt: String(connection?.linkedAt || ''),
      } : null,
    };
  }

  if (action === 'bootstrap') {
    const [profile, linkedinConnection] = await Promise.all([
      loadProfile(db, member.uid),
      db.collection('founderLinkedInConnections').doc(member.uid).get(),
    ]);
    return {
      onboarding: profile?.onboarding ?? {
        status: 'not_started' as const,
        questionnaireVersion: QUESTIONNAIRE_VERSION,
        completedAt: null,
      },
      profile: profile ? selfProfile(profile) : null,
      linkedinConnection: linkedinConnection.exists ? linkedinConnection.data() : null,
      linkedinSignInReady: Boolean(
        LINKEDIN_CLIENT_ID.value() && LINKEDIN_REDIRECT_URI.value()
        && LINKEDIN_OIDC_ENABLED.value() === 'true',
      ),
      questionnaire: {
        version: QUESTIONNAIRE_VERSION,
        questions: FOUNDER_QUESTIONS,
        sectionOrder: SECTION_ORDER,
        sectionLabels: SECTION_LABELS,
      },
      labels: {
        skills: SKILL_DOMAIN_LABELS,
        interests: INTEREST_LABELS,
        archetypes: ARCHETYPE_LABELS,
        workingStyle: WORKING_STYLE_AXES,
      },
      vocab: { interests: INTEREST_TAGS, skills: SKILL_DOMAINS },
    };
  }

  if (action === 'importLinkedIn') {
    const record = validateLinkedIn(request.record);
    const ref = profiles.doc(member.uid);
    await db.runTransaction(async (tx) => {
      const snapshot = await tx.get(ref);
      if (!snapshot.exists) {
        tx.create(ref, {
          uid: member.uid,
          email: member.email,
          displayName: member.name,
          photoURL: member.photoURL,
          headline: record.headline,
          onboarding: { status: 'linkedin_done', questionnaireVersion: QUESTIONNAIRE_VERSION, completedAt: null },
          linkedin: record,
          answers: {},
          traits: deriveTraits({}, record),
          sop: { text: '', proudOf: '', wants: '', validation: null },
          visibility: 'open',
          version: 0,
          createdAt: iso,
          updatedAt: iso,
        } satisfies StoredFounderProfile);
        return;
      }
      const existing = snapshot.data() as StoredFounderProfile;
      // Re-importing after onboarding changes the evidence behind the traits, so
      // the version is bumped and every cached match recomputes.
      tx.update(ref, {
        linkedin: record,
        headline: existing.headline || record.headline,
        traits: deriveTraits(existing.answers, record),
        version: existing.version + 1,
        updatedAt: iso,
        'onboarding.status': existing.onboarding.status === 'complete' ? 'complete' : 'linkedin_done',
      });
    });
    return { record };
  }

  if (action === 'submitQuestionnaire') {
    if (request.aiConsent !== true) {
      throw new HttpsError('failed-precondition', 'Agree to AI-assisted profile review and matching before joining Founder Connect.');
    }
    const answers = validateAnswers(request.answers);
    const existing = await loadProfile(db, member.uid);
    const record = existing?.linkedin ?? null;
    const traits = deriveTraits(answers, record);

    const sop = {
      text: String(answers.st_sop ?? ''),
      proudOf: String(answers.st_proud ?? ''),
      wants: String(answers.st_looking ?? ''),
    };
    const validation = deps.apiKey
      ? await validateSop({
        sop: sop.text, proudOf: sop.proudOf, wants: sop.wants, record, selfRatedSkills: selfRatedSkills(answers),
      }, deps)
      : neutralSopValidation('The review service is not configured on this environment.', sopTexture(sop.text, record));

    const headline = record?.headline
      || `${ARCHETYPE_LABELS[traits.archetype]} · ${topSkills(traits.skills, 2).map((d) => SKILL_DOMAIN_LABELS[d]).join(' & ')}`;

    const data: StoredFounderProfile = {
      uid: member.uid,
      email: member.email,
      displayName: member.name,
      photoURL: member.photoURL,
      headline,
      onboarding: { status: 'complete', questionnaireVersion: QUESTIONNAIRE_VERSION, completedAt: iso },
      linkedin: record,
      answers,
      traits,
      sop: { ...sop, validation },
      visibility: existing?.visibility ?? 'open',
      aiConsentAt: iso,
      version: (existing?.version ?? 0) + 1,
      createdAt: existing?.createdAt ?? iso,
      updatedAt: iso,
    };
    await profiles.doc(member.uid).set(data);
    return { profile: selfProfile(data) };
  }

  if (action === 'myProfile') {
    const profile = await loadProfile(db, member.uid);
    return { profile: profile ? selfProfile(profile) : null };
  }

  if (action === 'setVisibility') {
    const visibility = request.visibility === 'selective' ? 'selective' : 'open';
    const profile = requireOnboarded(await loadProfile(db, member.uid));
    await profiles.doc(profile.uid).update({ visibility, updatedAt: iso });
    return { visibility };
  }

  // ── Matching ────────────────────────────────────────────────────────────

  if (action === 'lookup') {
    requireOnboarded(await loadProfile(db, member.uid));
    const target = validateEmail(request.email);
    if (target === member.email) {
      throw new HttpsError('invalid-argument', 'That is your own address. Search for someone else.');
    }
    const found = await profiles.where('email', '==', target).limit(1).get();
    if (found.empty) {
      return { found: false as const, onboarded: false, invited: target };
    }
    const other = found.docs[0].data() as StoredFounderProfile;
    if (!isComplete(other)) {
      return { found: true as const, onboarded: false, counterpart: summaryOf(other) };
    }
    return { found: true as const, onboarded: true, counterpart: summaryOf(other) };
  }

  if (action === 'match') {
    const viewer = requireOnboarded(await loadProfile(db, member.uid));
    const otherUid = validateUid(request.uid);
    if (otherUid === member.uid) throw new HttpsError('invalid-argument', 'You cannot match with yourself.');
    const other = await loadProfile(db, otherUid);
    if (!other) throw new HttpsError('not-found', 'That student has not joined Founder Connect yet.');
    if (!isComplete(other)) {
      throw new HttpsError('failed-precondition', 'That student has not finished their Founder Connect profile yet.');
    }
    return { report: await resolveMatch(db, viewer, other, deps, now) };
  }

  if (action === 'suggestions') {
    const viewer = requireOnboarded(await loadProfile(db, member.uid));
    // Bounded scan: the cohort is a single university programme, so ranking the
    // open pool in memory is cheaper and far more explainable than maintaining
    // a vector index for a few thousand documents.
    const pool = await profiles
      .where('onboarding.status', '==', 'complete')
      .where('visibility', '==', 'open')
      .limit(500)
      .get();
    const candidates = pool.docs
      .map((doc) => doc.data() as StoredFounderProfile)
      .filter((candidate) => candidate.uid !== viewer.uid);

    const ranked = rankCandidates(
      viewer.traits,
      candidates.map((candidate) => ({ uid: candidate.uid, traits: candidate.traits })),
    ).slice(0, 12);

    const byUid = new Map(candidates.map((candidate) => [candidate.uid, candidate]));
    return {
      suggestions: ranked.flatMap((entry) => {
        const candidate = byUid.get(entry.uid);
        return candidate
          ? [{ counterpart: summaryOf(candidate), structural: entry.structural, lexical: entry.lexical }]
          : [];
      }),
    };
  }

  // ── Feed ────────────────────────────────────────────────────────────────

  if (action === 'createPost') {
    const profile = requireOnboarded(await loadProfile(db, member.uid));
    const draft = validatePostDraft(request.draft);
    const ref = posts.doc(documentId(request.requestId));

    await db.runTransaction(async (tx) => {
      const existing = await tx.get(ref);
      // A retry after a dropped connection must not publish the post twice.
      if (existing.exists) return;
      const data: StoredPost = {
        kind: draft.kind,
        authorUid: member.uid,
        authorName: member.name,
        authorHeadline: profile.headline,
        authorPhoto: member.photoURL,
        anonymous: draft.anonymous,
        title: draft.title,
        body: draft.body,
        tags: draft.tags,
        idea: draft.idea,
        poll: draft.poll
          ? {
            options: draft.poll.options.map((label, index) => ({ id: `o${index + 1}`, label })),
            counts: Object.fromEntries(draft.poll.options.map((_, index) => [`o${index + 1}`, 0])),
            totalVotes: 0,
            closesAt: new Date(now + draft.poll.durationDays * 86_400_000).toISOString(),
          }
          : null,
        likeCount: 0,
        commentCount: 0,
        createdAt: iso,
      };
      tx.create(ref, data);
    });
    return { id: ref.id };
  }

  if (action === 'listPosts') {
    requireOnboarded(await loadProfile(db, member.uid));
    let query: Query = posts;
    if (request.mine === true) query = query.where('authorUid', '==', member.uid);
    if (typeof request.tag === 'string' && request.tag) {
      query = query.where('tags', 'array-contains', text(request.tag, 'Tag', 40));
    }
    if (typeof request.kind === 'string' && ['post', 'idea', 'poll'].includes(request.kind)) {
      query = query.where('kind', '==', request.kind);
    }
    query = query.orderBy('createdAt', 'desc').orderBy(FieldPath.documentId(), 'desc');

    const page = validateCursor(request.cursor);
    if (page) query = query.startAfter(await anchor(posts, page));

    const snapshot = await query.limit(21).get();
    const docs = snapshot.docs.slice(0, 20);
    const [likes, votes] = docs.length
      ? await Promise.all([
        db.getAll(...docs.map((doc) => doc.ref.collection('likes').doc(member.uid))),
        db.getAll(...docs.map((doc) => doc.ref.collection('votes').doc(member.uid))),
      ])
      : [[], []];

    return {
      posts: docs.map((doc, index) => publicPost(
        doc.id,
        doc.data() as StoredPost,
        member.uid,
        likes[index]?.exists ?? false,
        (votes[index]?.data()?.optionId as string | undefined) ?? null,
      )),
      nextCursor: snapshot.docs.length > 20 ? docs[docs.length - 1].id : null,
    };
  }

  if (action === 'toggleLike') {
    requireOnboarded(await loadProfile(db, member.uid));
    const ref = posts.doc(documentId(request.postId));
    const like = ref.collection('likes').doc(member.uid);
    return db.runTransaction(async (tx) => {
      const [post, existing] = await Promise.all([tx.get(ref), tx.get(like)]);
      if (!post.exists) throw new HttpsError('not-found', 'That post is gone.');
      const data = post.data() as StoredPost;
      if (existing.exists) {
        tx.delete(like);
        tx.update(ref, { likeCount: Math.max(0, data.likeCount - 1) });
        return { liked: false, likeCount: Math.max(0, data.likeCount - 1) };
      }
      tx.create(like, { at: iso });
      tx.update(ref, { likeCount: data.likeCount + 1 });
      return { liked: true, likeCount: data.likeCount + 1 };
    });
  }

  if (action === 'vote') {
    requireOnboarded(await loadProfile(db, member.uid));
    const ref = posts.doc(documentId(request.postId));
    const optionId = pollOptionId(request.optionId);
    const receipt = ref.collection('votes').doc(member.uid);
    return db.runTransaction(async (tx) => {
      const [post, existing] = await Promise.all([tx.get(ref), tx.get(receipt)]);
      if (!post.exists) throw new HttpsError('not-found', 'That poll is gone.');
      const data = post.data() as StoredPost;
      if (!data.poll) throw new HttpsError('failed-precondition', 'That post is not a poll.');
      // One vote per member, and it cannot be changed — the receipt is checked
      // inside the transaction so two clicks cannot both land.
      if (existing.exists) {
        throw new HttpsError('failed-precondition', 'You have already voted in this poll.');
      }
      if (Date.parse(data.poll.closesAt) <= now) {
        throw new HttpsError('failed-precondition', 'This poll has closed.');
      }
      if (!data.poll.options.some((option) => option.id === optionId)) {
        throw new HttpsError('invalid-argument', 'Unknown poll option.');
      }
      const counts = { ...data.poll.counts, [optionId]: (data.poll.counts[optionId] ?? 0) + 1 };
      tx.create(receipt, { optionId, at: iso });
      tx.update(ref, { 'poll.counts': counts, 'poll.totalVotes': data.poll.totalVotes + 1 });
      return { optionId, counts, totalVotes: data.poll.totalVotes + 1 };
    });
  }

  if (action === 'comment') {
    const profile = requireOnboarded(await loadProfile(db, member.uid));
    const input = validateComment(request);
    const ref = posts.doc(input.postId);
    const commentRef = ref.collection('comments').doc();
    await db.runTransaction(async (tx) => {
      const post = await tx.get(ref);
      if (!post.exists) throw new HttpsError('not-found', 'That post is gone.');
      const data = post.data() as StoredPost;
      tx.create(commentRef, {
        authorUid: member.uid,
        authorName: member.name,
        authorPhoto: member.photoURL,
        authorHeadline: profile.headline,
        anonymous: input.anonymous,
        body: input.body,
        createdAt: iso,
      });
      tx.update(ref, { commentCount: data.commentCount + 1 });
    });
    return { id: commentRef.id };
  }

  if (action === 'listComments') {
    requireOnboarded(await loadProfile(db, member.uid));
    const ref = posts.doc(documentId(request.postId));
    let query: Query = ref.collection('comments').orderBy('createdAt', 'asc').orderBy(FieldPath.documentId());
    const page = validateCursor(request.cursor);
    if (page) query = query.startAfter(await anchor(ref.collection('comments'), page));
    const snapshot = await query.limit(51).get();
    const docs = snapshot.docs.slice(0, 50);
    return {
      comments: docs.map((doc) => {
        const data = doc.data();
        const comment: FounderComment = {
          id: doc.id,
          authorUid: data.anonymous ? '' : data.authorUid,
          authorName: data.anonymous ? ANONYMOUS.name : data.authorName,
          authorPhoto: data.anonymous ? ANONYMOUS.photo : data.authorPhoto,
          anonymous: Boolean(data.anonymous),
          body: data.body,
          createdAt: data.createdAt,
          isAuthor: data.authorUid === member.uid,
        };
        return comment;
      }),
      nextCursor: snapshot.docs.length > 50 ? docs[docs.length - 1].id : null,
    };
  }

  if (action === 'deletePost') {
    const ref = posts.doc(documentId(request.postId));
    await db.runTransaction(async (tx) => {
      const post = await tx.get(ref);
      if (!post.exists) return;
      if ((post.data() as StoredPost).authorUid !== member.uid) {
        throw new HttpsError('permission-denied', 'Only the author can delete this post.');
      }
      tx.delete(ref);
    });
    // Subcollections are left for the recursive-delete extension rather than
    // fanned out here, where a large thread could exceed the call's budget.
    return { deleted: true };
  }

  // ── Direct messages ─────────────────────────────────────────────────────

  if (action === 'sendMessage') {
    const sender = requireOnboarded(await loadProfile(db, member.uid));
    const toUid = validateUid(request.toUid);
    if (toUid === member.uid) throw new HttpsError('invalid-argument', 'You cannot message yourself.');
    const body = text(request.body, 'Message', 4000, 1);
    const recipient = await loadProfile(db, toUid);
    if (!isComplete(recipient)) {
      throw new HttpsError('failed-precondition', 'That student has not joined Founder Connect yet.');
    }
    const other = recipient as StoredFounderProfile;
    if (other.visibility === 'selective') {
      // Selective profiles only accept a first message from someone they have
      // already written to; an existing thread is that consent.
      const thread = await db.collection(THREADS).doc(pairKey(member.uid, toUid)).get();
      if (!thread.exists) {
        throw new HttpsError('permission-denied',
          'This student only takes messages from people they have contacted. Comment on their post instead.');
      }
    }

    const threadRef = db.collection(THREADS).doc(pairKey(member.uid, toUid));
    const messageRef = threadRef.collection('messages').doc();
    await db.runTransaction(async (tx) => {
      const snapshot = await tx.get(threadRef);
      const participant = (profile: StoredFounderProfile) => ({
        uid: profile.uid, name: profile.displayName, photo: profile.photoURL, headline: profile.headline,
      });
      if (!snapshot.exists) {
        tx.create(threadRef, {
          participants: [member.uid, toUid].sort(),
          profiles: { [sender.uid]: participant(sender), [other.uid]: participant(other) },
          lastMessage: body.slice(0, 200),
          lastMessageAt: iso,
          lastSenderUid: member.uid,
          unread: { [member.uid]: 0, [toUid]: 1 },
          createdAt: iso,
        });
      } else {
        const data = snapshot.data() as { unread?: Record<string, number> };
        tx.update(threadRef, {
          lastMessage: body.slice(0, 200),
          lastMessageAt: iso,
          lastSenderUid: member.uid,
          [`unread.${toUid}`]: (data.unread?.[toUid] ?? 0) + 1,
          [`unread.${member.uid}`]: 0,
          [`profiles.${sender.uid}`]: participant(sender),
          [`profiles.${other.uid}`]: participant(other),
        });
      }
      tx.create(messageRef, { fromUid: member.uid, body, createdAt: iso });
    });
    return { id: messageRef.id, threadId: threadRef.id };
  }

  if (action === 'listThreads') {
    requireOnboarded(await loadProfile(db, member.uid));
    const snapshot = await db.collection(THREADS)
      .where('participants', 'array-contains', member.uid)
      .orderBy('lastMessageAt', 'desc')
      .limit(50)
      .get();
    return {
      threads: snapshot.docs.map((doc) => {
        const data = doc.data() as {
          participants: string[];
          profiles: Record<string, FounderThread['counterpart']>;
          lastMessage: string; lastMessageAt: string; lastSenderUid: string;
          unread?: Record<string, number>;
        };
        const otherUid = data.participants.find((entry) => entry !== member.uid) ?? '';
        const thread: FounderThread = {
          id: doc.id,
          counterpart: data.profiles?.[otherUid]
            ?? { uid: otherUid, name: 'Former member', photo: '', headline: '' },
          lastMessage: data.lastMessage,
          lastMessageAt: data.lastMessageAt,
          lastSenderUid: data.lastSenderUid,
          unread: data.unread?.[member.uid] ?? 0,
        };
        return thread;
      }),
    };
  }

  if (action === 'listMessages') {
    requireOnboarded(await loadProfile(db, member.uid));
    const threadRef = db.collection(THREADS).doc(documentId(request.threadId));
    const thread = await threadRef.get();
    if (!thread.exists) throw new HttpsError('not-found', 'That conversation does not exist.');
    if (!(thread.data()?.participants as string[] | undefined)?.includes(member.uid)) {
      throw new HttpsError('permission-denied', 'That is not your conversation.');
    }
    let query: Query = threadRef.collection('messages').orderBy('createdAt', 'desc').orderBy(FieldPath.documentId(), 'desc');
    const page = validateCursor(request.cursor);
    if (page) query = query.startAfter(await anchor(threadRef.collection('messages'), page));
    const snapshot = await query.limit(51).get();
    const docs = snapshot.docs.slice(0, 50);
    return {
      messages: docs.map((doc) => {
        const data = doc.data();
        const message: FounderMessage = {
          id: doc.id,
          fromUid: data.fromUid,
          body: data.body,
          createdAt: data.createdAt,
          mine: data.fromUid === member.uid,
        };
        return message;
      }).reverse(),
      nextCursor: snapshot.docs.length > 50 ? docs[docs.length - 1].id : null,
    };
  }

  if (action === 'markThreadRead') {
    const threadRef = db.collection(THREADS).doc(documentId(request.threadId));
    await db.runTransaction(async (tx) => {
      const thread = await tx.get(threadRef);
      if (!thread.exists) return;
      if (!(thread.data()?.participants as string[] | undefined)?.includes(member.uid)) {
        throw new HttpsError('permission-denied', 'That is not your conversation.');
      }
      tx.update(threadRef, { [`unread.${member.uid}`]: 0 });
    });
    return { read: true };
  }

  if (action === 'revalidateSop') {
    const profile = requireOnboarded(await loadProfile(db, member.uid));
    const last = profile.sop.validation?.validatedAt;
    // The review costs a model call, so it is re-runnable once an hour.
    if (last && now - Date.parse(last) < 3_600_000 && profile.sop.validation?.aiAvailable) {
      throw new HttpsError('resource-exhausted', 'Your statement was reviewed in the last hour. Try again later.');
    }
    if (!deps.apiKey) throw new HttpsError('failed-precondition', 'The review service is not configured.');
    const validation = await validateSop({
      sop: profile.sop.text,
      proudOf: profile.sop.proudOf,
      wants: profile.sop.wants,
      record: profile.linkedin,
      selfRatedSkills: selfRatedSkills(profile.answers),
    }, deps);
    await profiles.doc(member.uid).update({
      'sop.validation': validation,
      version: profile.version + 1,
      updatedAt: iso,
    });
    return { validation };
  }

  if (action === 'setAnonymousDefault') {
    // Kept explicit so the client cannot silently flip someone's default.
    return { anonymous: boolean(request.anonymous, 'Anonymous') };
  }

  throw new HttpsError('invalid-argument', 'Unknown Founder Connect action.');
}
