# Original User Request

## 2026-09-21T17:59:42Z

# Teamwork Project Prompt — Draft

> Status: Launched
> Goal: Craft prompt → get user approval → delegate to teamwork_preview
> Requested team: [none — teamwork routes from the description]

Implement shared academic calendars for Sections A–H in MU One by syncing sanitized events from consented waitlisted users, while keeping them blocked from the platform. 

Working directory: d:\Projects\MU-One
Integrity mode: benchmark

## Requirements

### R1. Calendar Sync & Consent
Sync calendars from waitlisted users who have explicitly connected Google Calendar and consented. Joining the waitlist does not equal consent. Waitlisted users must remain blocked from the platform and no access records should be granted or modified.

### R2. Event Sanitization & Filtering
Publish only institutional shared academic calendars. Filter out personal events, primary calendar events, private meetings, and personal reminders. Store sanitized events in Firebase under a shared calendar collection with only: Section (A-H), Course name, Session title, One-line description, Date, Start/End time, Venue/link, Mode, Event type, and Source update time. Strip all personal data (email, organizer, attendees, private notes).

### R3. Section Handling & Deduplication
Recognize section formats (Section A-H, Sec A-H, Legacy 1-8 mapped to A-H). Use the same eight sections across all programs (TBM, YLC, HR & OS, SMG). Deduplicate sessions based on a stable fingerprint (section, course, session title, start/end time, venue), keeping the most recent version.

### R4. Calendar Interface & Cross-Section View
In the calendar UI, show "All sections" followed by Section A-H. Selecting a section loads its shared sessions. Subject filtering must work within the selected section. Default to the user's registered section, or "All sections" if none. Preserve preference locally. Allow students to view when a session is conducted for another section. 

### R5. Database & UI States
Deploy rules and indexes to the named Firestore database `default` (and `(default)` where required). Add clear UI states: loading ("Loading shared section calendars…"), empty ("No sessions are available for Section X in this period."), and a retry action on failure.

## Acceptance Criteria

### Verification
- [ ] Backend tests, Firestore rules tests, frontend tests, and production builds pass.
- [ ] Section A–H all display their available shared academic sessions.
- [ ] Changing sections updates the calendar without reloading the page.
- [ ] Cross-section subject comparison works.
- [ ] Personal calendar events never enter the shared Firebase collection.
- [ ] Duplicate events do not appear.
- [ ] Waitlisted contributors remain blocked from the platform.
- [ ] No waitlist access records are granted or modified.
- [ ] Firestore no longer returns "Missing or insufficient permissions."
