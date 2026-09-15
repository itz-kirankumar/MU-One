# MU One — Setup Guide

This guide takes you from a fresh Google Cloud project to a fully running MU One instance.

---

## Prerequisites

- [Firebase CLI](https://firebase.google.com/docs/cli): `npm install -g firebase-tools`
- [Node.js](https://nodejs.org/) 20 LTS or later
- A Google Cloud / Firebase project on the **Blaze (pay-as-you-go)** billing plan
  - Cloud Functions v2 and Cloud Scheduler require Blaze. The Firebase free (Spark) plan will not work.
- A Google Cloud OAuth 2.0 web client with the required APIs enabled (see below)

---

## 1. Firebase Project

1. Go to [console.firebase.google.com](https://console.firebase.google.com/) and open (or create) project `mu-one-508502`.
2. Upgrade to the **Blaze** billing plan if not already done.
3. Enable the following services:
   - **Firestore** → Create database in production mode, region: `asia-south1` (Mumbai).
   - **Authentication** → Enable Google provider.
   - **Cloud Functions** (v2) → Enabled automatically on Blaze.
   - **Cloud Scheduler** → Enabled automatically on Blaze.
   - **Secret Manager** → Go to Google Cloud Console → APIs & Services → Enable **Secret Manager API**.

---

## 2. Firebase Authentication — Google Provider

1. In Firebase Console → Authentication → Sign-in method → Google → Enable.
2. Set **Project support email** to your MU admin email.
3. Add authorized domains:
   - `localhost` (already present)
   - Your production domain (e.g., `mu-one.mastersunion.org`)
   - `mu-one-508502.web.app`
   - `mu-one-508502.firebaseapp.com`

---

## 3. Google Cloud — OAuth 2.0 Client

1. Go to [console.cloud.google.com](https://console.cloud.google.com/) → project `mu-one-508502`.
2. APIs & Services → Credentials → Create Credentials → **OAuth 2.0 Client ID**.
3. Application type: **Web application**.
4. Authorized JavaScript origins:
   - `http://localhost:3000`
   - `https://mu-one-508502.web.app`
   - `https://mu-one.mastersunion.org` (production)
5. Authorized redirect URIs:
   - `http://localhost:5001/mu-one-508502/us-central1/connectGoogleAccount` (local emulator)
   - `https://connectgoogleaccount-REGION-mu-one-508502.cloudfunctions.net` (production — get URL after first deploy)
6. Click Create. Download credentials and note the **Client ID** and **Client Secret**.

---

## 4. Enable Google APIs

In Google Cloud Console → APIs & Services → Library, enable:
- **Google Calendar API**
- **Gmail API**
- **Google Tasks API**
- **Secret Manager API**

---

## 5. OAuth Consent Screen

1. APIs & Services → OAuth consent screen → **Internal** (restricts to your Google Workspace domain, i.e., mastersunion.org).
2. Fill in app name: "MU One", support email, developer contact.
3. Scopes — add:
   - `https://www.googleapis.com/auth/calendar` (read/write calendar)
   - `https://www.googleapis.com/auth/gmail.readonly` (read emails)
   - `https://www.googleapis.com/auth/gmail.send` (send email)
   - `https://www.googleapis.com/auth/tasks` (read/write Google Tasks)
   - `openid`, `email`, `profile` (basic identity)
4. Save and submit for verification if required (Internal apps typically don't require Google verification).

---

## 6. Secret Manager — Store Secrets

```powershell
# Store your Google OAuth client credentials
firebase functions:secrets:set GOOGLE_OAUTH_CLIENT_ID
# Enter the client ID from step 3 when prompted

firebase functions:secrets:set GOOGLE_OAUTH_CLIENT_SECRET
# Enter the client secret from step 3 when prompted

# Generate and store the AES-256-GCM encryption key
# (run this command to generate a 32-byte hex key)
# openssl rand -hex 32     ← run in bash/WSL/Git Bash
firebase functions:secrets:set TOKEN_ENCRYPTION_KEY
# Enter the 64-character hex string when prompted
```

**Key rotation:** To rotate `TOKEN_ENCRYPTION_KEY`:
1. Generate a new key.
2. Set a new version: `firebase functions:secrets:set TOKEN_ENCRYPTION_KEY`.
3. Run a migration Cloud Function (planned) that re-encrypts all stored refresh tokens.
4. Retire the old version.

> [!CAUTION]
> Never commit these values to source control. They must only exist in Secret Manager.

---

## 7. Frontend Environment

```powershell
cd frontend
cp ..\env.example .env.local   # or copy manually on Windows
```

Edit `frontend/.env.local`:
```
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSyCFbV2v-0zTHYbOjvZnUNO8p0rkL1B_LOI
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=mu-one-508502.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=mu-one-508502
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=mu-one-508502.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=514126175818
NEXT_PUBLIC_FIREBASE_APP_ID=1:514126175818:web:c7f455a44f188c0f8f10b3
```

These are public Firebase config values (not secrets). It is safe to include them in the frontend bundle.

---

## 8. Install Dependencies

```powershell
# Frontend
cd frontend
npm install

# Cloud Functions
cd ..\functions
npm install
cd ..
```

---

## 9. Local Development with Firebase Emulator

```powershell
# Start all emulators (Firestore, Auth, Functions, Hosting)
firebase emulators:start

# In a separate terminal: start Next.js dev server
cd frontend && npm run dev
```

The emulator UI is available at: http://localhost:4000

> [!NOTE]
> Cloud Scheduler jobs cannot be emulated locally. To test scheduled sync, call `scheduledSyncAllUsers` manually via the Firebase Functions shell:
> ```
> firebase functions:shell
> > scheduledSyncAllUsers()
> ```

> [!NOTE]
> When using emulators, set these in your `frontend/.env.local` to point to local emulators:
> ```
> NEXT_PUBLIC_FIREBASE_EMULATOR=true
> ```

---

## 10. Deploy Firestore Rules and Indexes

```powershell
firebase deploy --only firestore
```

This deploys both `firestore.rules` and `firestore.indexes.json`.

---

## 11. Deploy Cloud Functions

```powershell
# Build TypeScript first
cd functions && npm run build
cd ..

# Deploy all functions
firebase deploy --only functions

# Or deploy a specific function
firebase deploy --only functions:syncDashboard
```

After deploying `connectGoogleAccount`, note its URL (shown in console output) and add it as an authorized redirect URI in step 3.

---

## 12. Deploy Frontend (Production)

```powershell
cd frontend
npm run build    # Next.js static export to frontend/out/
cd ..
firebase deploy --only hosting
```

---

## 13. Scheduled Sync

Cloud Scheduler is configured via `firebase.json` and deploys automatically with `firebase deploy --only functions`. The `scheduledSyncAllUsers` function runs every 15 minutes.

**Cost/quota considerations:**
- Each sync reads ~50 users × (1 calendarList + N events + 60 mail messages + N task lists) Google API calls.
- Stay within Google API free quotas: Calendar API (1M queries/day), Gmail API (1B quota units/day), Tasks API (50K queries/day).
- Implement exponential backoff (already in the codebase) for API errors.
- Monitor costs in Google Cloud Console → Billing.

---

## 14. Running Tests

```powershell
# Frontend unit tests
cd frontend
npm test

# Cloud Function tests
cd ..\functions
npm test
```

---

## Privacy and Data Retention

- **Google refresh tokens** are encrypted with AES-256-GCM and stored in Firestore. They are never logged or exposed to the browser.
- **Email content** — only normalized metadata (sender, subject, snippet, received date) is stored permanently. Full message bodies are fetched on-demand when a student opens an email and are not persisted.
- **Calendar events** — stored for the configured sync window (default 14 days). Past events can be purged via Firestore TTL policy.
- **Personal tasks** — stored in Firestore under the user's own subtree. Deleted on account disconnect.
- **Disconnect workflow** — disconnecting Google access revokes the OAuth token, deletes the encrypted refresh token, and clears all synced data from Firestore.
- **Account deletion** — contact the MU One administrator to request complete data deletion.

---

## Known Limitation: Coach/LMS Integration

MU One **does not read LMS-only data** — grades, submission status, attendance, or quiz scores are not accessible without an approved Coach API or sanctioned export.

If Masters' Union configures Coach/LMS to share academic events to students' Google Calendars, those events will appear in MU One as calendar-derived information, clearly labeled with their source calendar name.

A direct Coach LMS integration may be added in a future release once an approved API or export path is established.
