# JobPilot Phase 6 — Multi-Source Job Collection — Design Spec

## Goal

Replace the current 5-hardcoded-URL, LLM-scrape-only collector with a system that pulls postings from many more sources automatically, so new jobs surface within minutes instead of once a day from a handful of fragile links. Feeds the same `Job` table the rest of the app already reads from — matching, the dashboard, and Telegram notifications are all unchanged by this phase.

## Why (context from brainstorming)

The original ask was "search LinkedIn, Naukri, Hirist, Indeed, Shine, and auto-apply for me." None of those five platforms offer a free API for job search, and automating access to them (scraping or session-driving, by any tool) violates their terms and risks the user's own accounts getting banned — this was raised, discussed, and explicitly ruled out. What's in scope instead, confirmed with the user:

- Auto-apply is descoped entirely — semi-automated only (generate cover letter/cold message, user submits manually). Already built in Phase 5.
- Sourcing breadth comes from (a) ATS platform APIs for specific companies, with the existing LLM-scrape as fallback, and (b) two free job-aggregator APIs (Adzuna, Arbeitnow) that need no per-company list.
- The 15-minute check frequency set up in Phase 5's worker already solves the "notified too late" problem; this phase solves the "not enough sources" problem.

## Explicit scope

**In scope:**
- Move the per-company source list (`careersPage` / `ats` kinds) out of a static code file and into the database, with a new `/sources` dashboard page to add/edit/remove companies — adding a company never requires a code change or redeploy again. This directly replaces today's `sources.config.ts` array.
- Two fixed, always-on `aggregator` collectors — Adzuna, Arbeitnow — global keyword queries, not per-company, not user-manageable rows (there's nothing to add/remove; they're either on or off as integrations).
- A starter list of companies (proposed by the assistant, verified live before shipping — see Testing), seeded into the database once, editable from `/sources` from then on.
- A new `jobTitleKeywords` field on `UserProfile` / `/settings`, used as the search term(s) for the two aggregators.
- A per-run cap on how many new jobs `match.ts` scores, so a large first sync (or any burst) doesn't blow through OpenRouter's free-tier rate limit in one run.

**Out of scope (unchanged from Phase 5 and earlier decisions):**
- LinkedIn, Naukri, Hirist, Indeed, Shine — no sourcing from these, by any method.
- Auto-apply / browser automation / form auto-fill.
- Resume rewriting per job (Phase 5 already generates a cover letter + cold message; that's unchanged).
- Cross-source fuzzy deduplication. A job posted on both a company's own site and an aggregator, under two different URLs, will appear as two rows. `Job.url` uniqueness still prevents exact-URL duplicates. Solving "is this the same job under a different URL" is real complexity that isn't worth taking on for v1 — noted as a known limitation, not a bug to fix here.
- Changing the existing matching/scoring prompt logic (`buildScorePrompt`, threshold, cover-note generation) — this phase only changes what feeds into `Job`, not how it's scored afterward.

## Data model changes

```prisma
model Source {                          // NEW — replaces src/lib/sources/sources.config.ts
  id        String   @id @default(cuid())
  name      String                      // display name, e.g. "Razorpay"
  kind      SourceKind
  url       String?                     // required when kind = CAREERS_PAGE
  platform  AtsPlatform?                // required when kind = ATS
  slug      String?                     // required when kind = ATS — the company's slug on that platform
  createdAt DateTime @default(now())
}

enum SourceKind {
  CAREERS_PAGE
  ATS
}

enum AtsPlatform {
  GREENHOUSE
  LEVER
  ASHBY
  WORKABLE
}

model UserProfile {
  // ...existing fields unchanged...
  jobTitleKeywords String[] @default([])   // NEW — search terms for Adzuna/Arbeitnow, e.g. ["Full Stack Developer", "MERN Developer"]
}
```

```typescript
// src/lib/sources/types.ts

export interface ExtractedJob {
  title: string;
  company: string;       // NEW — previously implied by source.name; now explicit because
                          // an aggregator query can return many different companies
  url: string;
  location: string | null;
  salaryText: string | null;
  postedAt: string | null;
}
```

The two `aggregator` collectors (Adzuna, Arbeitnow) are NOT rows in the `Source` table — they're fixed, always-on integrations invoked directly in `collect.ts`, since there's nothing per-entry to manage (no url/slug, just "run this query with the profile's keywords"). Only the per-company `careersPage`/`ats` sources live in the database and are `/sources`-page-manageable.

New environment variables: `ADZUNA_APP_ID`, `ADZUNA_APP_KEY` (free registration at Adzuna's developer portal — the exact current signup flow and rate limits should be confirmed against their live docs during implementation, not assumed from this spec). Arbeitnow's public API needs no key.

## `/sources` page

A new dashboard page, following the same server-component-fetch + client-form-mutation pattern as `/settings`: lists existing `Source` rows, a form to add one (name, kind selector, then `url` for careers-page or `platform`+`slug` for ATS), and a delete action per row. New API routes: `POST /api/sources` (create), `DELETE /api/sources/[id]` (remove) — same validation/error-handling conventions established in Phase 5 (400 on bad input, inline error display on fetch failure, no silent failures).

## Collector architecture

`collect.ts` currently loops over one flat, static `sources[]` array, treating every entry as "one company, one URL." Two changes: the per-company list now comes from the database (`db.source.findMany()`) instead of a static import, and the model has to account for `aggregator` queries not mapping to "one company" at all. The collector runs two passes:

1. **Per-company pass** — iterates `Source` rows fetched from the database, same loop shape as today (one row, one company, politely spaced between requests). For `ATS`-kind rows, dispatch to a small per-platform function:
   - `collectFromGreenhouse(slug)`, `collectFromLever(slug)`, `collectFromAshby(slug)`, `collectFromWorkable(slug)` — each hits that platform's own public job-board JSON endpoint and maps its response shape into `ExtractedJob[]`. No LLM call, no HTML parsing — this is the reliability win over today's scrape-and-guess approach.
   - `collectFromCareersPage(source)` — unchanged logic, used for `CAREERS_PAGE`-kind rows (companies on none of the four ATS platforms).
2. **Aggregator pass** — fixed, not database-driven: `collectFromAdzuna(keywords)` and `collectFromArbeitnow(keywords)`, called once each per run with `keywords` read from `loadProfile()`'s `jobTitleKeywords`, each returning `ExtractedJob[]` spanning many companies.

Both passes feed the same `saveNewJobs` dedup-by-URL insert path that exists today. `company` is set from the `Source` row's `name` for `CAREERS_PAGE`/`ATS` rows (same as today's pattern — each row is still one company), and read directly from the API response for aggregator results, since a single aggregator query returns many different companies with no fixed name to fall back on.

Exact response-field mapping for each ATS/aggregator API is an implementation-time detail — this spec commits to the architecture (one small mapping function per platform, structured JSON in, `ExtractedJob[]` out), not to unverified field names.

## Rate/volume safeguards

Two risks that only bite once sourcing expands:

1. **LLM scoring burst.** `match.ts` scores every `score: null` job sequentially, one LLM call each. A first sync against several ATS companies plus two aggregators could return far more new jobs in one run than today's 5-source setup ever did. Fix: a `MAX_JOBS_SCORED_PER_RUN` cap (default 20, env-overridable) added to the existing `db.job.findMany({ where: { score: null } })` query as a `take`. Anything past the cap is simply picked up on the next 15-minute tick — no new state needed, since the query already resumes from wherever it left off.
2. **Politeness toward the new APIs.** Reuse the existing `DELAY_BETWEEN_SOURCES_MS`-style spacing between calls within a run. Exact rate limits for Adzuna/Arbeitnow/each ATS should be checked against their current docs during implementation rather than assumed.

## Starter company list

Candidates below are a starting point, chosen for being recognizable tech employers plausibly hiring for full-stack/MERN roles in India or remote-friendly for India. **None of these — company-to-platform mapping or slug — are verified as of this spec.** The implementation plan must confirm each one live (hit the real endpoint, confirm real job data comes back) before it's seeded; any that don't resolve get dropped, not guessed at further. Verified ones are seeded as `Source` rows once (migration or seed script); everything after that is added via the `/sources` page, not by editing code.

| Company | Guessed platform |
|---|---|
| Razorpay | Greenhouse |
| Postman | Greenhouse |
| Chargebee | Greenhouse |
| CRED | Lever or Greenhouse |
| Groww | Lever or Greenhouse |
| Freshworks | Workable or in-house (verify) |
| Browserstack | Greenhouse or Lever |
| Vercel | Ashby or Greenhouse |
| Linear | Ashby |
| Retool | Ashby or Greenhouse |

The existing 5 hardcoded `careersPage` sources (Jellyfish Technologies, Thrifty AI, GTF Technologies, Beebom, WorldRef) get seeded as `CAREERS_PAGE`-kind rows too, carrying forward what's already there today.

## Testing

- Unit tests for each collector's response-mapping function, given a representative sample API response as fixture input — assert the correct `ExtractedJob[]` shape comes out. No live network calls inside the test suite.
- Unit tests for the `/api/sources` create/delete routes (valid input persists, missing url/platform+slug per kind is rejected, delete removes the row) — same shape as the existing `/api/applications` route tests.
- One live, manual verification pass during implementation: hit each proposed company's ATS endpoint for real and confirm it returns actual job data (not a 404, not an empty/wrong-shaped response) before it's seeded — mirrors how Phase 2's collector sources were shaken out.
- Existing `tests/match.test.ts` and `tests/applications.test.ts` are unaffected by this phase and must keep passing.

## Non-negotiables carried over (unchanged, no new work needed)

- `UserProfile.expectedSalary`/`noticePeriod` still never reach an LLM prompt — this phase doesn't touch prompt-building at all, only what populates `Job` rows before they reach the existing matching step.
- Job posting content (title, description) from any new source is still untrusted data handed to the LLM only during `careersPage` extraction — the same rule already enforced in `collectFromCareersPage` applies to any future scrape-based fallback.
