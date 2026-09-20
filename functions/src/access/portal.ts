import * as admin from "firebase-admin";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { Resend } from "resend";
import {
  PLATFORM_ADMIN_EMAIL,
  authenticatedEmail,
  requireMuDomain,
  requirePlatformAdmin,
} from "../utils/domainCheck";
import { getDb } from "../utils/getDb";
import { waitlistHtml } from "../utils/waitlistEmailTemplate";

const MU_EMAIL = /^[^\s@]+@mastersunion\.org$/i;
const WAITLIST_MESSAGE = "You will be soon notified once access has been rolled out to you.";

function normalizeEmail(value: unknown): string {
  const email = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (!MU_EMAIL.test(email)) {
    throw new HttpsError("invalid-argument", "Enter a valid @mastersunion.org email address.");
  }
  return email;
}

export const accessPortal = onCall({ region: "us-central1", timeoutSeconds: 30 }, async request => {
  const uid = requireMuDomain(request);
  const callerEmail = authenticatedEmail(request);
  const data = request.data && typeof request.data === "object"
    ? request.data as Record<string, unknown>
    : {};
  const action = String(data.action || "status");
  const db = getDb();

  if (action === "status") {
    const isAdmin = callerEmail === PLATFORM_ADMIN_EMAIL;
    const [access, waitlist] = await Promise.all([
      isAdmin ? Promise.resolve(null) : db.collection("platformAccess").doc(callerEmail).get(),
      db.collection("platformWaitlist").doc(callerEmail).get(),
    ]);
    return {
      email: callerEmail,
      isAdmin,
      hasAccess: isAdmin || Boolean(access?.exists && access.get("status") === "granted"),
      waitlistStatus: waitlist?.exists ? String(waitlist.get("status") || "waiting") : null,
    };
  }

  if (action === "join") {
    if (callerEmail === PLATFORM_ADMIN_EMAIL) {
      return { success: true, message: WAITLIST_MESSAGE, status: "approved" };
    }
    const ref = db.collection("platformWaitlist").doc(callerEmail);
    const existing = await ref.get();
    
    // Only send the email if they were not already on the waitlist
    const isNewJoiner = !existing.exists || existing.get("status") === null;

    await ref.set({
      email: callerEmail,
      uid,
      displayName: String(request.auth?.token.name || "").slice(0, 120),
      status: existing.get("status") === "approved" ? "approved" : "waiting",
      joinedAt: existing.get("joinedAt") || admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      program: data.program || null,
      section: data.section || null,
      requestedFeatures: data.requestedFeatures || null,
    }, { merge: true });

    if (isNewJoiner) {
      try {
        const resendApiKey = process.env.RESEND_API_KEY || "";
        const resend = new Resend(resendApiKey);
        
        await resend.emails.send({
          from: "MU One <hello@muone.live>",
          to: callerEmail,
          subject: "You're on the MU One waitlist",
          html: waitlistHtml,
        });
      } catch (err) {
        console.error("Failed to send waitlist email via Resend:", err);
      }
    }

    return { success: true, message: WAITLIST_MESSAGE, status: "waiting" };
  }

  requirePlatformAdmin(request);

  if (action === "list") {
    const [accessSnapshot, waitlistSnapshot] = await Promise.all([
      db.collection("platformAccess").orderBy("email").limit(500).get(),
      db.collection("platformWaitlist").orderBy("joinedAt", "desc").limit(500).get(),
    ]);
    return {
      adminEmail: PLATFORM_ADMIN_EMAIL,
      granted: accessSnapshot.docs.map(doc => ({
        email: String(doc.get("email") || doc.id),
        grantedAt: doc.get("grantedAt")?.toDate?.()?.toISOString?.() || null,
      })),
      waitlist: waitlistSnapshot.docs.map(doc => ({
        email: String(doc.get("email") || doc.id),
        displayName: String(doc.get("displayName") || ""),
        status: String(doc.get("status") || "waiting"),
        joinedAt: doc.get("joinedAt")?.toDate?.()?.toISOString?.() || null,
      })),
    };
  }

  const targetEmail = normalizeEmail(data.email);
  if (targetEmail === PLATFORM_ADMIN_EMAIL && action === "revoke") {
    throw new HttpsError("failed-precondition", "The permanent administrator cannot be revoked.");
  }

  if (action === "grant") {
    const batch = db.batch();
    batch.set(db.collection("platformAccess").doc(targetEmail), {
      email: targetEmail,
      status: "granted",
      grantedBy: callerEmail,
      grantedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
    batch.set(db.collection("platformWaitlist").doc(targetEmail), {
      email: targetEmail,
      status: "approved",
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
    await batch.commit();
    return { success: true };
  }

  if (action === "revoke") {
    await db.collection("platformAccess").doc(targetEmail).delete();
    await db.collection("platformWaitlist").doc(targetEmail).set({
      email: targetEmail,
      status: "waiting",
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
    return { success: true };
  }

  throw new HttpsError("invalid-argument", "Unknown access action.");
});
