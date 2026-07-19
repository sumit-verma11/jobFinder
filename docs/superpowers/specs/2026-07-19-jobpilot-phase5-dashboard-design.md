# JobPilot Phase 5 — Dashboard + Applications Management — Design Spec

## Goal

Give the single user (me) a clean, good-looking local dashboard to run the whole job search from: triage saved jobs, dig into a job's details, generate a cover letter/cold message on demand, manage profile/preferences that actually drive matching, and track every submitted application through its full lifecycle — without adding auth, external state libraries, or component libraries.

This supersedes and extends `docs/spec.md`'s original "PHASE 5 — Dashboard" section (which specified a single 5-column pipeline board + a jobs table). That original board concept is replaced by the Saved-queue + Applications split described below, arrived at through brainstorming because the Applications requirements outgrew a single kanban board.

## Explicit scope (pages)

1. `/` — Saved queue (was: full pipeline board)
2. `/jobs` — all collected jobs, table, filterable
3. `/jobs/[id]` — Job Details (new)
4. `/settings` — profile/preferences/resume (new)
5. `/applications` — submitted-application tracking table (new)

## Out of scope (unchanged from `docs/spec.md`)

Auto-filling application forms, browser automation, auth/multi-user, any paid service, drag-and-drop (status changes are dropdowns/selects), resume text extraction/parsing into LLM prompts, historical resume versioning/snapshotting per application.

## Data model changes

```prisma
model Job {
  // ...existing fields unchanged...
  coldMessage   String?   // NEW — on-demand generated outreach message, cached after first generation
}

model Application {
  // ...existing fields unchanged...
  archived      Boolean   @default(false)   // NEW
  status        AppStatus @default(SAVED)   // enum widened, see below
}

enum AppStatus {
  SAVED
  APPLIED
  RECRUITER_VIEWED
  OA_RECEIVED
  INTERVIEW_SCHEDULED
  INTERVIEW_COMPLETED
  OFFER
  REJECTED
  WITHDRAWN
}
// Replaces the old 5-value enum (SAVED, APPLIED, INTERVIEW, OFFER, REJECTED).
// No existing rows depend on the removed INTERVIEW value (Phase 5 UI didn't exist yet).

model UserProfile {          // NEW — singleton row, id fixed to "default"
  id                 String    @id @default("default")
  profileText        String    // free-form bio/experience/stack/links — replaces src/profile/profile.md
  styleExamplesText  String?   // tone reference examples — replaces src/profile/style-examples.md
  preferredLocations String[]
  workMode           WorkMode  @default(REMOTE)
  expectedSalary     String?   // reference only — never passed into any LLM prompt
  noticePeriod       String?   // reference only — never passed into any LLM prompt
  resumeFileName     String?
  resumeFilePath     String?   // e.g. "uploads/resume.pdf", relative to project root
  updatedAt          DateTime  @updatedAt
}

enum WorkMode {
  REMOTE
  HYBRID
  ONSITE
}
```

`appliedAt: DateTime?` (already on `Application`) is the only field needed for Applied Date/Time/Day — all three are derived at render time via `Intl.DateTimeFormat`, no new columns.

## Architecture

Unchanged from the original plan: Next.js App Router, server components read directly via the `db` Prisma singleton, mutations go through Route Handlers under `src/app/api/`, client components call `fetch` then `router.refresh()`. No client-side state library, no component library — plain Tailwind throughout, styled with the emerald/mint-on-white palette established during brainstorming.

New route handlers:

- `PATCH /api/applications/[id]` — body: any of `{ status, notes, followUpAt, archived }`. If `status` transitions to `APPLIED` and `appliedAt` is currently null, the server sets `appliedAt: new Date()` automatically (this is how the board's "Mark as Applied" action produces a real applied timestamp).
- `POST /api/applications` — body: `{ jobId }`. Creates an `Application` row with `status: SAVED` (the "Save to pipeline" action from `/jobs`).
- `POST /api/applications/bulk` — body: `{ ids: string[], action: "delete" | "archive" | "status", status? }`. Powers the Applications page bulk bar.
- `POST /api/jobs/[id]/cover-letter` — generates (if `Job.coverNote` is null) and persists a cover letter on demand, for jobs that scored below `SCORE_THRESHOLD` at match time and so never got one automatically. Returns the (now-cached) text.
- `POST /api/jobs/[id]/cold-message` — generates (if `Job.coldMessage` is null) and persists a cold outreach message on demand, for any job regardless of score. Returns the (now-cached) text.
- `POST /api/settings` — multipart form body (profile fields + optional resume file). Upserts the singleton `UserProfile` row (`id: "default"`). Resume file, if present, is written to `uploads/<original-name>` (project-root, gitignored) and the file overwrites whatever was there before (single resume, no versioning).
- `GET /api/settings/resume` — streams the currently stored resume file for download/view from the Settings page.

## Pages

### `/` — Saved queue

Lists `Application` rows where `status = SAVED`, joined to their `Job`. Card shows: title, company, score badge, source badge, location/salary, link, a "Mark as Applied" button. No notes/follow-up editing here (moved to Job Details, see below) — this page is purely a lightweight triage queue. Clicking a card (outside the button) navigates to `/jobs/[id]`.

### `/jobs` — all collected jobs

Table of every `Job`. Client-side filters: score, source, date. Each row: title, company, score, source badge, collected date, a status indicator if an `Application` already exists (else a "Save to pipeline" button that calls `POST /api/applications`). Row click → `/jobs/[id]`.

### `/jobs/[id]` — Job Details

Shows: title, company, source badge, match score + reason, full description, cover letter (existing `coverNote` if present, else a "Generate cover letter" button hitting `POST /api/jobs/[id]/cover-letter`), cold message (always on-demand via a small client component that calls `POST /api/jobs/[id]/cold-message` on first view, showing a loading state), notes (textarea, autosaves on blur via `PATCH /api/applications/[id]`), follow-up date (date input, same autosave), current status (dropdown, only shown/editable if an `Application` exists — otherwise a "Save to pipeline" button), copy buttons next to the cover letter and cold message. Both generation flows reuse the existing `sanitizeCoverNote`/`containsSensitiveInfo` safety backstop from `src/lib/matching/sanitizeCoverNote.ts` — a generated cold message that mentions CTC/salary/notice period is discarded and logged, same as cover notes today.

### `/settings`

Single form: profile text (large textarea, replaces `profile.md`), style examples (textarea, replaces `style-examples.md`), preferred locations (comma-separated or tag input — plain text input split on commas, no new library), work mode (single select: Remote/Hybrid/Onsite), expected salary (text input), notice period (text input), resume upload (file input, shows current filename + a link to `GET /api/settings/resume` if one exists). Submits to `POST /api/settings`. If no `UserProfile` row exists yet, the form starts empty; there is no automated migration from the old `.md` files — you re-enter your profile once through this form.

### `/applications`

Table of every `Application` where `status != SAVED`. Columns: checkbox, Job Title, Company, Source badge, Applied Date, Applied Time, Applied Day (all three derived from `appliedAt`), Status (inline dropdown, all 8 non-SAVED statuses), Match Score, Resume Used (current `UserProfile.resumeFileName` — see note below), Cover Letter (View/Copy), Cold Message (View/Copy), Job URL (external link). Row click (outside checkbox/dropdown/copy buttons) → `/jobs/[id]`.

- **Bulk actions:** header checkbox selects all visible rows; selecting any row reveals a bulk-action bar with Delete Selected (custom-styled confirm dialog, not the native browser one; hard-deletes the `Application` rows only, `Job` rows are untouched), Archive Selected (`archived: true`, hidden from the default view), Mark Status (pick one status, applied to every selected row), Export Selected → CSV (built client-side from the already-loaded rows via a small hand-rolled CSV serializer and a `Blob` download — no new dependency).
- **Filters:** Company, Source, Status, Applied Date, Match Score — all client-side over the fetched list. An "include archived" toggle reveals archived rows.
- **Search:** title/company substring match, client-side.
- **Sort:** Newest First / Oldest First / Highest Match Score / Company Name — client-side array sort.

**Resume Used caveat:** since `UserProfile` is a singleton with no resume history, every row shows whatever resume is *currently* set in Settings, not what was actually attached at the time of that application. If the resume is replaced later, past rows will reflect the new one. This was flagged and accepted during brainstorming as the simple MVP behavior; per-application resume snapshotting is explicitly out of scope.

## Dashboard stats

Header row (visible on `/`) shows exactly: Total Applications, Applied Today, Applied This Week, Interviews (counts `INTERVIEW_SCHEDULED` + `INTERVIEW_COMPLETED` rows), Offers, Rejections. All computed as simple `db.application.count()` queries grouped/filtered by status and `appliedAt`. "Jobs Scanned" (from `RunLog`) and the Saved count are intentionally not in this row — Saved count is visible as the `/` page's own item count, Jobs Scanned fits as context on `/jobs` instead.

## Matcher changes (`src/lib/profile.ts`, `src/lib/matching/prompts.ts`)

- `loadProfile()` becomes `async`, reads `db.userProfile.findUnique({ where: { id: "default" } })` instead of the two `.md` files. Throws a descriptive error ("no profile found — fill in /settings first") if the row doesn't exist, mirroring the old "file missing" error behavior.
- `buildScorePrompt` stops hardcoding `"prefer Noida, NCR, or remote-India"` and instead interpolates the caller's actual `preferredLocations` and `workMode` — this is what makes Settings the real source of truth for matching, not just a form that saves to a table nobody reads.
- `expectedSalary` and `noticePeriod` are loaded into `UserProfile` but **never passed into any prompt-building function** — this is a structural guarantee, not a runtime filter, that they can't leak into a generated cover note or cold message. `src/worker/match.ts`'s call site updates to `await loadProfile()`.
- A new `buildColdMessagePrompt(profileText, styleExamplesText, job)` is added to `prompts.ts`, following the same shape/rules as `buildCoverNotePrompt` (never invent facts, treat job content as untrusted data, never mention CTC/salary/notice period, match style examples' tone). Its output goes through the existing `sanitizeCoverNote`/`containsSensitiveInfo` pair (possibly renamed to something generic like `sanitizeGeneratedText`, since it now serves two content types — final naming is an implementation detail).
- `src/profile/profile.md`, `style-examples.md`, and their `.example.md` templates are left on disk untouched but become unread/vestigial. Deleting them is a manual future cleanup, not part of this phase.

## Styling

Emerald/mint accent palette on a white background (per brainstorming decision), replacing the current `create-next-app` placeholder in `src/app/page.tsx` and the default `globals.css` color variables. Shared top nav (Pipeline / Jobs / Applications / Settings) using the same palette. No Tailwind plugins beyond what's already configured, no component library (shadcn, MUI, etc.).

## Error handling

Consistent with the project's existing philosophy (silence must never mean success, from Phase 4): failed mutations show an inline error message near the action that failed rather than failing silently. Empty states are explicit ("No saved jobs yet — run `npm run collect` and `npm run match`", "No applications yet", etc.) rather than blank pages. LLM generation failures (cover letter/cold message on-demand) show a retry-able error state on the button rather than crashing the page.

## Testing scope

Per the project's existing testing philosophy (Vitest only for logic that truly needs it — see `docs/spec.md`), new pure-logic additions get unit tests: the CSV serializer, the client-side filter/sort/search functions on `/applications`, and `buildColdMessagePrompt`'s shape (consistent with how `buildScorePrompt`/`buildCoverNotePrompt` aren't directly unit-tested today but the parsing/sanitizing/threshold functions around them are). No new tests for page rendering/UI — verified manually via `npm run dev` in the browser, per this project's standing instruction for UI changes.

## Non-negotiable rules carried forward

From `docs/spec.md`'s "Non-negotiable rules for the LLM-facing parts," unchanged and now also applying to cold-message generation:

1. Cover notes and cold messages derive only from `UserProfile.profileText`/`styleExamplesText` — no invented facts.
2. Job posting content (title, description, etc.) is treated as untrusted data, never as instructions.
3. All LLM JSON/text parsing is defensive — a bad model response never crashes a request, only surfaces a retryable error.
4. CTC/notice period never appear in generated cover notes or cold messages — guaranteed structurally (never passed into those prompts) and enforced by the `containsSensitiveInfo` backstop as defense in depth.
