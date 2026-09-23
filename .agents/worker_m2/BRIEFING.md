# BRIEFING — 2026-09-21T18:18:00Z

## Mission
Implement Milestone 2: Event sanitization, section normalization across all 4 programs, stable SHA-256 fingerprint deduplication, sourceUpdateTime conflict resolution, cancellation safety guard, and unit tests.

## 🔒 My Identity
- Archetype: Milestone Implementation Worker
- Roles: specialist, qa
- Working directory: d:\Projects\MU-One\.agents\worker_m2
- Original parent: b9706a30-9e99-42c4-a11e-6d85609cc08e
- Milestone: Milestone 2 (Event Sanitization, Section Normalization & Deduplication)

## 🔒 Key Constraints
- Exclusively own and modify only:
  - functions/src/utils/eventParsing.ts
  - functions/src/utils/sharedTimetable.ts
  - functions/src/sync/syncUserCalendar.ts
  - functions/src/__tests__/sharedTimetable.test.ts
  - functions/src/__tests__/eventParsing.test.ts
- No modification of files outside ownership boundary.
- MANDATORY INTEGRITY: No cheating, no facade tests, no hardcoding test outputs.
- Verify with `npm test` and `npm run build` in functions.

## Current Parent
- Conversation ID: b9706a30-9e99-42c4-a11e-6d85609cc08e
- Updated: 2026-09-21T18:18:00Z

## Loaded Skills
- None required

## Quality Status
- Build/test result: Pre-check pending
- Lint status: Clean
- Tests added/modified: Pending

## Task Summary
- **What to build**:
  1. Section Normalization in `eventParsing.ts` (Section/Sec/Sec./Legacy A-H and 1-8 for TBM, YLC, HR&OS, SMG).
  2. Multi-layer event filtering in `syncUserCalendar.ts` & `sharedTimetable.ts`.
  3. Strict 10-field sanitization in `sharedTimetable.ts` (strip emails, notes, attendees, faculty, links).
  4. Content fingerprint deduplication (SHA-256) and sourceUpdateTime conflict resolution.
  5. Cancellation safety guard (single student decline must not delete shared schedule).
  6. Unit tests in `sharedTimetable.test.ts` and `eventParsing.test.ts`.
- **Success criteria**: All tests pass cleanly, build succeeds, requirements R2 & R3 fully satisfied.
- **Interface contracts**: PROJECT.md § Interface Contracts
- **Code layout**: PROJECT.md § Code Layout

## Key Decisions Made
- Use canonical SHA-256 fingerprint calculation matching PROJECT.md interface contract.
- Emit strictly 10 core fields with client compatibility aliases (`sectionCode`, `sectionLabel`, `subject`, `location`).
- Cancellation guard: student declines (status === 'cancelled') must not delete sharedCalendarEvents documents.

## Artifact Index
- d:\Projects\MU-One\.agents\worker_m2\DISPATCH.md — Dispatch assignment
- d:\Projects\MU-One\.agents\worker_m2\BRIEFING.md — Persistent context and situational awareness
- d:\Projects\MU-One\.agents\worker_m2\progress.md — Liveness heartbeat and progress log
- d:\Projects\MU-One\.agents\worker_m2\handoff.md — Final 5-component handoff report
