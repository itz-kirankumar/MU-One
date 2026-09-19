import * as admin from "firebase-admin";
import { google } from "googleapis";
import { getAccessToken } from "../auth/tokenStore";
import { normalizeMessage, senderDomain } from "../utils/mailParsing";
import { withBackoff } from "../utils/backoff";
import { getDb } from "../utils/getDb";
import { JEV_MODEL } from "../config/params";
import {
  applyJevMailFallback,
  classifyMailWithJev,
  isJevMailClassification,
} from "../integrations/jev";

const GMAIL_QUERY = "from:mastersunion.org newer_than:90d";
const MAX_MESSAGES = 60;
const MAX_JEV_FALLBACKS = 12;
const JEV_CONCURRENCY = 3;

interface SyncMailResult {
  messagesScanned: number;
  messagesNormalized: number;
  warnings: string[];
}

async function enrichWithJevFallbacks(
  db: ReturnType<typeof getDb>,
  uid: string,
  mails: ReturnType<typeof normalizeMessage>[],
): Promise<void> {
  const apiKey = process.env.EXPLABS_API_KEY?.trim();
  if (!apiKey) return;
  const candidates = mails.filter(mail => !mail.isDeadlineSignal).slice(0, MAX_JEV_FALLBACKS);
  let nextIndex = 0;
  let failures = 0;
  const workers = Array.from({ length: Math.min(JEV_CONCURRENCY, candidates.length) }, async () => {
    while (nextIndex < candidates.length) {
      const mail = candidates[nextIndex++];
      const ref = db.collection("users").doc(uid).collection("mailSignals").doc(mail.messageId);
      try {
        const existing = await ref.get();
        const cached = existing.data()?.["jevClassification"];
        const classification = isJevMailClassification(cached)
          ? cached
          : await classifyMailWithJev(apiKey, mail, JEV_MODEL.value());
        Object.assign(mail, applyJevMailFallback(mail, classification));
      } catch {
        failures += 1;
      }
    }
  });
  await Promise.all(workers);
  if (failures) console.warn(`[mail] JEV fallback skipped ${failures} message(s).`);
}

/**
 * Syncs Gmail signals for a user into Firestore.
 *
 * - Searches Gmail with a bounded query (60d, @mastersunion.org senders only).
 * - Fetches full message payloads for up to MAX_MESSAGES results.
 * - Verifies sender domain = mastersunion.org before storing.
 * - Writes to /users/{uid}/mailSignals/{messageId}.
 * - Updates dashboard/current.importantMail.
 *
 * Never fetches unbounded mailbox.
 */
export async function syncUserMail(uid: string): Promise<SyncMailResult> {
  const warnings: string[] = [];
  const accessToken = await getAccessToken(uid);

  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  const gmail = google.gmail({ version: "v1", auth });

  // List matching message IDs (bounded query)
  let messageIds: string[] = [];
  try {
    const listResponse = await withBackoff(() =>
      gmail.users.messages.list({
        userId: "me",
        q: GMAIL_QUERY,
        maxResults: MAX_MESSAGES,
      })
    );
    const messages = listResponse.data.messages ?? [];
    messageIds = messages
      .map((m) => m.id ?? "")
      .filter((id) => id !== "");
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    warnings.push(`Failed to list Gmail messages: ${msg}`);
    return { messagesScanned: 0, messagesNormalized: 0, warnings };
  }

  const db = getDb();
  const normalizedMessages: ReturnType<typeof normalizeMessage>[] = [];

  for (const messageId of messageIds) {
    try {
      const messageResponse = await withBackoff(() =>
        gmail.users.messages.get({
          userId: "me",
          id: messageId,
          format: "full",
        })
      );

      const message = messageResponse.data as Record<string, unknown>;
      const normalized = normalizeMessage(message);

      // Security: only store messages from @mastersunion.org senders
      const domain = senderDomain(normalized.sender);
      if (!domain.endsWith("mastersunion.org") && !domain.endsWith("mastersunion.edu.in")) {
        warnings.push(`Skipped message ${messageId}: sender domain ${domain}`);
        continue;
      }

      normalizedMessages.push(normalized);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      warnings.push(`Message ${messageId}: ${msg}`);
    }
  }

  // Deterministic rules stay authoritative. JEV only classifies a bounded,
  // cached set of messages that those rules could not identify.
  await enrichWithJevFallbacks(db, uid, normalizedMessages);

  // Write to Firestore in batches
  const BATCH_SIZE = 500;
  for (let i = 0; i < normalizedMessages.length; i += BATCH_SIZE) {
    const batch = db.batch();
    const chunk = normalizedMessages.slice(i, i + BATCH_SIZE);
    for (const mail of chunk) {
      const ref = db
        .collection("users")
        .doc(uid)
        .collection("mailSignals")
        .doc(mail.messageId);
      batch.set(
        ref,
        { ...mail, updatedAt: admin.firestore.FieldValue.serverTimestamp() },
        { merge: true }
      );
    }
    await batch.commit();
  }

  // Dashboard summary: prioritize deadline signals, then other recent MU mail
  const deterministicDeadlineMails = normalizedMessages
    .filter((m) => m.isDeadlineSignal && m.deadlineSource !== "jev")
    .sort((a, b) => b.receivedAt.localeCompare(a.receivedAt));

  const jevDeadlineMails = normalizedMessages
    .filter((m) => m.isDeadlineSignal && m.deadlineSource === "jev")
    .sort((a, b) => b.receivedAt.localeCompare(a.receivedAt));

  const otherMails = normalizedMessages
    .filter((m) => !m.isDeadlineSignal)
    .sort((a, b) => b.receivedAt.localeCompare(a.receivedAt));

  const importantMail = [...deterministicDeadlineMails, ...jevDeadlineMails, ...otherMails].slice(0, 30);

  await db
    .collection("users")
    .doc(uid)
    .collection("dashboard")
    .doc("current")
    .set(
      {
        importantMail,
        mailSignals: importantMail,
        metrics: {
          importantMailCount: importantMail.length,
        },
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

  return {
    messagesScanned: messageIds.length,
    messagesNormalized: normalizedMessages.length,
    warnings,
  };
}
