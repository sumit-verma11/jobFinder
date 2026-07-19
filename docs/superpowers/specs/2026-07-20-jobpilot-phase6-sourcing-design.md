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
- Restructure `Source` config to support three kinds: `careersPage` (today's LLM-scrape, unchanged, used as fallback), `ats` (Greenhouse/Lever/Ashby/Workable, structured JSON, no LLM), `aggregator` (Adzuna, Arbeitnow — global keyword queries, not per-company).
- A starter list of companies for the `ats`/`careersPage` sources (proposed by the assistant, verified live before shipping — see Testing).
- A new `jobTitleKeywords` field on `UserProfile` / `/settings`, used as the search term(s) for the two aggregators.
- A per-run cap on how many new jobs `match.ts` scores, so a large first sync (or any burst) doesn't blow through OpenRouter's free-tier rate limit in one run.

**Out of scope (unchanged from Phase 5 and earlier decisions):**
- LinkedIn, Naukri, Hirist, Indeed, Shine — no sourcing from these, by any method.
- Auto-apply / browser automation / form auto-fill.
- Resume rewriting per job (Phase 5 already generates a cover letter + cold message; that's unchanged).
- Cross-source fuzzy deduplication. A job posted on both a company's own site and an aggregator, under two different URLs, will appear as two rows. `Job.url` uniqueness still prevents exact-URL duplicates. Solving "is this the same job under a different URL" is real complexity that isn't worth taking on for v1 — noted as a known limitation, not a bug to fix here.
- Changing the existing matching/scoring prompt logic (`buildScorePrompt`, threshold, cover-note generation) — this phase only changes what feeds into `Job`, not how it's scored afterward.

## Data model changes

```typescript
// src/lib/sources/types.ts — replaces the current single-shape Source

export type Source =
  | { kind: "careersPage"; name: string; url: string }
  | { kind: "ats"; name: string; platform: "greenhouse" | "lever" | "ashby" | "workable"; slug: string }
  | { kind: "aggregator"; name: "adzuna" | "arbeitnow" };
  // Note: aggregator entries do NOT carry keywords in this static config — the search
  // terms come from UserProfile.jobTitleKeywords (below), read at collect-time via
  // loadProfile(), so they stay editable from /settings without a code change.

export interface ExtractedJob {
  title: string;
  company: string;       // NEW — previously implied by source.name; now explicit because
                          // one `ats`/`aggregator` source can return many different companies
  url: string;
  location: string | null;
  salaryText: string | null;
  postedAt: string | null;
}
```

```prisma
model UserProfile {
  // ...existing fields unchanged...
  jobTitleKeywords String[] @default([])   // NEW — search terms for Adzuna/Arbeitnow, e.g. ["Full Stack Developer", "MERN Developer"]
}
```

New environment variables: `ADZUNA_APP_ID`, `ADZUNA_APP_KEY` (free registration at Adzuna's developer portal — the exact current signup flow and rate limits should be confirmed against their live docs during implementation, not assumed from this spec). Arbeitnow's public API needs no key.

## Collector architecture

`collect.ts` currently loops over one flat `sources[]` array, treating every entry as "one company, one URL." That model breaks once a single source can return jobs for many companies (an `ats` query for one company still fits it, but an `aggregator` query fundamentally doesn't map to "one company"). The collector splits into two passes:

1. **Per-company pass** — `careersPage` and `ats` kind sources, same loop shape as today (one source, one company, politely spaced between requests). For `ats` sources, dispatch to a small per-platform function:
   - `collectFromGreenhouse(slug)`, `collectFromLever(slug)`, `collectFromAshby(slug)`, `collectFromWorkable(slug)` — each hits that platform's own public job-board JSON endpoint and maps its response shape into `ExtractedJob[]`. No LLM call, no HTML parsing — this is the reliability win over today's scrape-and-guess approach.
   - `collectFromCareersPage(source)` — unchanged, used only for companies on none of the four ATS platforms.
2. **Aggregator pass** — one run per `aggregator` source entry, calling `collectFromAdzuna(keywords)` or `collectFromArbeitnow(keywords)` with `keywords` read from `loadProfile()`'s `jobTitleKeywords` at collect-time (not stored in the static source list — see note above), each returning `ExtractedJob[]` spanning many companies.

Both passes feed the same `saveNewJobs` dedup-by-URL insert path that exists today. `company` is set from `source.name` for `careersPage`/`ats` entries (same as today's pattern — each of those is still one company per source), and read directly from the API response for `aggregator` entries, since a single aggregator query returns many different companies with no fixed name to fall back on.

Exact response-field mapping for each ATS/aggregator API is an implementation-time detail — this spec commits to the architecture (one small mapping function per platform, structured JSON in, `ExtractedJob[]` out), not to unverified field names.

## Rate/volume safeguards

Two risks that only bite once sourcing expands:

1. **LLM scoring burst.** `match.ts` scores every `score: null` job sequentially, one LLM call each. A first sync against several ATS companies plus two aggregators could return far more new jobs in one run than today's 5-source setup ever did. Fix: a `MAX_JOBS_SCORED_PER_RUN` cap (default 20, env-overridable) added to the existing `db.job.findMany({ where: { score: null } })` query as a `take`. Anything past the cap is simply picked up on the next 15-minute tick — no new state needed, since the query already resumes from wherever it left off.
2. **Politeness toward the new APIs.** Reuse the existing `DELAY_BETWEEN_SOURCES_MS`-style spacing between calls within a run. Exact rate limits for Adzuna/Arbeitnow/each ATS should be checked against their current docs during implementation rather than assumed.

## Starter company list

Candidates below are a starting point, chosen for being recognizable tech employers plausibly hiring for full-stack/MERN roles in India or remote-friendly for India. **None of these — company-to-platform mapping or slug — are verified as of this spec.** The implementation plan must confirm each one live (hit the real endpoint, confirm real job data comes back) before it's trusted in `sources.config.ts`; any that don't resolve get dropped, not guessed at further.

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

The existing 5 hardcoded `careersPage` sources (Jellyfish Technologies, Thrifty AI, GTF Technologies, Beebom, WorldRef) stay as `careersPage`-kind fallback entries unless verification finds any of them on a known ATS.

## Testing

- Unit tests for each collector's response-mapping function, given a representative sample API response as fixture input — assert the correct `ExtractedJob[]` shape comes out. No live network calls inside the test suite.
- One live, manual verification pass during implementation: hit each proposed company's ATS endpoint for real and confirm it returns actual job data (not a 404, not an empty/wrong-shaped response) before it's trusted in the committed source list — mirrors how Phase 2's collector sources were shaken out.
- Existing `tests/match.test.ts` and `tests/applications.test.ts` are unaffected by this phase and must keep passing.

## Non-negotiables carried over (unchanged, no new work needed)

- `UserProfile.expectedSalary`/`noticePeriod` still never reach an LLM prompt — this phase doesn't touch prompt-building at all, only what populates `Job` rows before they reach the existing matching step.
- Job posting content (title, description) from any new source is still untrusted data handed to the LLM only during `careersPage` extraction — the same rule already enforced in `collectFromCareersPage` applies to any future scrape-based fallback.
