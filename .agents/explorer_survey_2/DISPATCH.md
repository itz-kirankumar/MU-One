# Survey Explorer 2 Dispatch

## 2026-09-21T18:02:00Z
- **Role**: Survey Explorer 2 (Event Sanitization, Section Parsing & Deduplication)
- **Working Directory**: d:\Projects\MU-One\.agents\explorer_survey_2
- **Project Root**: d:\Projects\MU-One
- **Original Request**: d:\Projects\MU-One\.agents\ORIGINAL_REQUEST.md
- **Orchestrator Conversation ID**: b9706a30-9e99-42c4-a11e-6d85609cc08e

### Objective
Investigate the codebase for Event Sanitization, Section Handling, and Session Deduplication (Requirements R2, R3).

### Specific Focus Areas
1. Event Sanitization and Filtering (R2):
   - How are events parsed from Google Calendar?
   - How to filter out personal events, primary calendar events, private meetings, and personal reminders?
   - What fields are needed in the shared collection: Section (A-H), Course name, Session title, One-line description, Date, Start/End time, Venue/link, Mode, Event type, and Source update time.
   - What personal data must be stripped (email, organizer, attendees, private notes)?
2. Section Normalization and Deduplication (R3):
   - How are sections identified in calendar event titles, summaries, descriptions, or calendar names?
   - Support formats: "Section A-H", "Sec A-H", "Legacy 1-8" mapped to A-H (1->A, 2->B, etc.).
   - Support across programs: TBM, YLC, HR & OS, SMG.
   - Deduplication logic: stable fingerprint (section, course, session title, start/end time, venue) keeping most recent version based on source update time.
3. Unit and integration testing patterns in the codebase for sanitization and deduplication.

### Output
Write your findings to `d:\Projects\MU-One\.agents\explorer_survey_2\handoff.md`. Include:
- Concrete schema/model differences between raw events and sanitized shared events
- Exact parsing and regex/logic needed for sections and filtering
- Fingerprint calculation logic and conflict resolution
- Documented testing strategy and test commands
Send a message back to orchestrator when finished.
