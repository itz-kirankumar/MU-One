# Community surveys

Members open **Surveys** in the dashboard sidebar. All verified MU members can browse and answer surveys. Creators can publish 1–10 questions (single choice, a 1–5 rating, or written answers), choose an expiry, and inspect private results under **My surveys**. Questions and privacy choices cannot change after publication. Closing a survey preserves results and permanently stops new answers.

## Privacy

- Author anonymity and response anonymity are independent settings.
- Anonymous authors appear as “Anonymous member”. The callable never returns their owner UID to other members.
- Anonymous answer documents contain no name, email, account UID, or submission timestamp. A separate private `receipts/{uid}` document prevents repeat submissions without holding a response ID.
- Named responses require explicit consent and use identity from the verified authentication token, not client-supplied identity.
- Only the creator can retrieve answers and aggregate results. Members can see participation counts.
- Anonymity is toward other members and survey creators, not the service operator. The operator retains ownership and participation records. Free-text answers can still identify a person; the UI tells respondents to avoid personal details.
- Direct Firestore reads and writes to `surveys/**` are denied. Every operation goes through `surveyPortal`, which requires a verified `@mastersunion.org` account.

## Storage and correctness

`surveys/{id}` stores the definition, private owner UID, response count and per-question aggregates. `responses/{randomId}` stores validated answers; `receipts/{uid}` is the participation ledger. Submission validates expiry, ownership, consent, required answers and option ranges, then writes the response, receipt and aggregates in one Firestore transaction. Duplicate/retried submissions return success without incrementing counts. Creation uses a client-generated request ID so retrying cannot publish duplicate surveys.

The feed pages 20 surveys at a time. Results page 50 responses at a time; charts use totals across all responses. The creator filter requires the `surveys` ownerUid/createdAt composite index in `firestore.indexes.json`.

## Deployment

The `surveyPortal` callable and its Firestore rules/indexes are deployed to the production Firebase project `mu-one-508502`. The frontend is released through the existing Vercel workflow.

The current application defaults to the **named database `default`**, through frontend `NEXT_PUBLIC_FIREBASE_DATABASE_ID` and backend `APP_DATABASE_ID`. This differs from Firebase’s `(default)` database. The included `firebase.surveys.json` explicitly targets the named database and leaves the existing general deployment configuration unchanged. If runtime environment settings override the database, adjust this deployment target to match.

Deploy the callable with `firebase deploy --config firebase.surveys.json --only functions:surveyPortal`, and the associated rules/indexes with `firebase deploy --config firebase.surveys.json --only firestore:rules,firestore:indexes`. Wait for the index to finish building before using **My surveys**. Deploy the frontend through its existing hosting workflow.

## Verification

- Backend tests: verified-member access, anonymity projections, consent, transactional deduplication, creator-only management, expiry, validation and pagination.
- Frontend tests: discovery, publishing/retry, privacy controls, named consent, already-answered/closed/owner states, errors, result display, keyboard tab navigation, focus restoration and connection-state loading.
- Browser QA uses temporary sample data; it does not publish real surveys or prove deployed Firestore integration. The temporary route is removed before delivery.
- Both application builds and focused lint checks are run. Firestore transaction behavior is exercised through a transactional in-memory test store; a live/emulator deployment remains an integration check.
