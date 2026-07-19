# JobPilot Phase 3 — Matcher + Tailor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Score every unscored `Job` against the user's profile (1-10 + one-line reason), generate a short honest cover note for jobs scoring at or above `SCORE_THRESHOLD`, and cover the pure scoring/parsing/threshold logic with Vitest — triggerable manually via `npm run match`.

**Architecture:** `src/lib/profile.ts` loads `profile.md`/`style-examples.md` from disk (gitignored, contain real PII — never committed). `src/lib/matching/` holds pure, unit-tested logic: prompt builders, a defensive JSON parser for the score response, a threshold check, and a cover-note text sanitizer — none of these touch the network or DB, so they're fully testable without mocking. `src/worker/match.ts` is the thin orchestrator: load profile once, loop over `Job` rows with `score = null`, call the LLM via the existing `chatCompletion` (Phase 2), parse defensively, and — only when the score clears the threshold — make a second LLM call for the cover note. Runnable standalone via `npm run match`; cron wiring happens in Phase 4.

**Tech Stack:** Same as Phases 1-2, plus Vitest (already named in the spec's fixed tech stack, first phase to need it — no new "ask before adding" packages beyond the spec's own list).

## Global Constraints

- TypeScript strict mode is on project-wide.
- No paid services, no packages beyond what's needed. Vitest is spec-mandated for this phase; nothing else new.
- **Non-negotiable (spec, verbatim in every relevant prompt):** "Cover notes and scores must derive ONLY from profile/profile.md — no invented facts, ever."
- **Non-negotiable (spec):** all LLM JSON parsing wrapped defensively — a bad model response must never crash the worker, only skip that item with a log line.
- **Non-negotiable (spec):** CTC / notice period from profile.md must appear only in Telegram messages (Phase 4), never inside a generated cover note.
- Scoring guidance (goes in the score prompt verbatim in spirit): weigh stack overlap (React, Node.js, Next.js, TypeScript, MongoDB, Postgres); the candidate has ~3 years of experience — penalize roles asking for 6+ years / senior / lead seniority; prefer Noida, NCR, or remote-India locations.
- Cover notes: max 4 lines, mention the RapidMart project (rapidmart.in) only when relevant, and always describe it accurately as a **self-directed demo project with manually seeded data** — never as processing real transactions or serving real customers (this exact framing is in `profile.md` and `style-examples.md` already; the code's system prompt should reinforce it, not contradict it).
- `profile.md` and `style-examples.md` live at `src/profile/` and are gitignored (real files contain the user's phone, email, and salary). **Implementers must never print, log, commit, or paste the full contents of these two files into report files, commit messages, or console output.** A brief non-sensitive confirmation (e.g., "profile loaded, 2431 chars, contains expected sections") is fine; dumping the file is not. The committed templates (`profile.example.md`, `style-examples.example.md`) are safe to reference/print freely.
- `match.ts` is naturally idempotent: it only processes `Job` rows where `score IS NULL`, so re-running it after a successful run finds nothing left to do — no separate dedupe logic needed.
- `SCORE_THRESHOLD` and `OPENROUTER_API_KEY`/`OPENROUTER_MODEL` are read from `.env` — any script that runs `match.ts` standalone needs `tsx --env-file=.env` (same gap discovered in Phase 2; already required here from the start).

---

### Task 1: Profile loader (`src/lib/profile.ts`)

**Files:**
- Create: `src/lib/profile.ts`

**Interfaces:**
- Produces: `loadProfile(): Profile` where `Profile = { profileText: string; styleExamplesText: string }`. Reads `src/profile/profile.md` and `src/profile/style-examples.md` relative to the project root. Throws a descriptive `Error` (naming the missing file and its `.example.md` template) if either file is missing — this is the only place the "missing profile" failure mode needs to be handled; callers (Task 3's `match.ts`) let it propagate and crash loudly on startup, since matching cannot proceed without it.

- [ ] **Step 1: Write src/lib/profile.ts**

```typescript
import { readFileSync } from "node:fs";
import { join } from "node:path";

const PROFILE_DIR = join(process.cwd(), "src", "profile");

export interface Profile {
  profileText: string;
  styleExamplesText: string;
}

export function loadProfile(): Profile {
  return {
    profileText: readProfileFile("profile.md"),
    styleExamplesText: readProfileFile("style-examples.md"),
  };
}

function readProfileFile(filename: string): string {
  const path = join(PROFILE_DIR, filename);
  try {
    return readFileSync(path, "utf-8");
  } catch {
    const template = filename.replace(".md", ".example.md");
    throw new Error(
      `${filename} not found at src/profile/${filename}. Copy src/profile/${template} to ${filename} and fill in your real details.`
    );
  }
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Live smoke test — confirm it loads without printing PII**

The real `profile.md` and `style-examples.md` already exist locally (gitignored). Confirm loading works WITHOUT printing their contents:

```bash
cat > /tmp/profile-smoke.mts << 'EOF'
import { loadProfile } from "/Volumes/Projects/JobFinder/src/lib/profile.ts";
const { profileText, styleExamplesText } = loadProfile();
console.log("profileText length:", profileText.length);
console.log("styleExamplesText length:", styleExamplesText.length);
console.log("profileText contains 'RapidMart':", profileText.includes("RapidMart"));
console.log("styleExamplesText contains 'Notes for the LLM':", styleExamplesText.includes("Notes for the LLM"));
EOF
npx tsx /tmp/profile-smoke.mts
rm /tmp/profile-smoke.mts
```

Expected: both lengths are non-zero (a few hundred to a few thousand characters), both boolean checks print `true`. **Do not** modify this script to print `profileText` or `styleExamplesText` themselves.

- [ ] **Step 4: Commit**

```bash
git add src/lib/profile.ts
git commit -m "feat: add profile loader for profile.md and style-examples.md"
```

---

### Task 2: Matching prompts, defensive parsing, threshold logic, and Vitest tests

**Files:**
- Create: `src/lib/matching/types.ts`
- Create: `src/lib/matching/prompts.ts`
- Create: `src/lib/matching/parseScore.ts`
- Create: `src/lib/matching/threshold.ts`
- Create: `src/lib/matching/sanitizeCoverNote.ts`
- Create: `vitest.config.ts`
- Create: `tests/match.test.ts`
- Modify: `package.json` (add `vitest` devDependency, `"test"` script)

**Interfaces:**
- Consumes: `ChatMessage` type from `../llm` (Phase 2).
- Produces (all pure functions, no I/O — this is what makes them unit-testable without mocking):
  - `JobForMatching` type: `{ title: string; company: string; location: string | null; salaryText: string | null; description: string | null }` — the subset of `Job` fields Task 3 passes in.
  - `buildScorePrompt(profileText: string, job: JobForMatching): ChatMessage[]`
  - `buildCoverNotePrompt(profileText: string, styleExamplesText: string, job: JobForMatching): ChatMessage[]`
  - `parseScoreResponse(raw: string): ScoreResult | null` where `ScoreResult = { score: number; reason: string }` — returns `null` (never throws) on any malformed input.
  - `shouldGenerateCoverNote(score: number, threshold: number): boolean`
  - `sanitizeCoverNote(raw: string): string`
- All five are consumed directly by Task 3's `worker/match.ts`.

- [ ] **Step 1: Write src/lib/matching/types.ts**

```typescript
export interface JobForMatching {
  title: string;
  company: string;
  location: string | null;
  salaryText: string | null;
  description: string | null;
}
```

- [ ] **Step 2: Write src/lib/matching/prompts.ts**

```typescript
import type { ChatMessage } from "../llm";
import type { JobForMatching } from "./types";

const NEVER_INVENT_RULE =
  "Never invent experience, numbers, or technologies not present in the profile below. Facts must come only from the profile.";

export function buildScorePrompt(profileText: string, job: JobForMatching): ChatMessage[] {
  return [
    {
      role: "system",
      content: [
        "You are scoring how well a job posting fits a candidate, on a scale of 1 to 10.",
        "Scoring guidance: weigh stack overlap (React, Node.js, Next.js, TypeScript, MongoDB, Postgres); the candidate has ~3 years of experience, so penalize roles asking for 6+ years / senior / lead seniority; prefer locations in Noida, NCR, or remote-India.",
        NEVER_INVENT_RULE,
        'Respond with ONLY strict JSON: {"score": <integer 1-10>, "reason": "<one line, under 20 words>"}. No prose, no markdown code fences.',
      ].join(" "),
    },
    {
      role: "user",
      content: [
        `CANDIDATE PROFILE:\n"""\n${profileText}\n"""`,
        "",
        "JOB POSTING:",
        `Title: ${job.title}`,
        `Company: ${job.company}`,
        `Location: ${job.location ?? "not specified"}`,
        `Salary: ${job.salaryText ?? "not specified"}`,
        `Description: ${job.description ?? "not provided"}`,
      ].join("\n"),
    },
  ];
}

export function buildCoverNotePrompt(
  profileText: string,
  styleExamplesText: string,
  job: JobForMatching
): ChatMessage[] {
  return [
    {
      role: "system",
      content: [
        "You are writing a short cover note (max 4 lines) for a job application, in the candidate's own natural voice.",
        NEVER_INVENT_RULE,
        "Mention the candidate's project RapidMart (rapidmart.in) only when relevant to the role (e.g. e-commerce, full-stack ownership) — describe it accurately per the profile (a self-directed demo project with manually seeded data), never overstate it as processing real transactions or serving real customers.",
        "Never mention CTC, salary, or notice period.",
        "Match the tone and structure of the style examples below.",
        "Respond with ONLY the cover note text — no preamble, no markdown, no surrounding quotes.",
      ].join(" "),
    },
    {
      role: "user",
      content: [
        `CANDIDATE PROFILE:\n"""\n${profileText}\n"""`,
        "",
        `STYLE EXAMPLES:\n"""\n${styleExamplesText}\n"""`,
        "",
        "JOB POSTING:",
        `Title: ${job.title}`,
        `Company: ${job.company}`,
        `Location: ${job.location ?? "not specified"}`,
        `Salary: ${job.salaryText ?? "not specified"}`,
        `Description: ${job.description ?? "not provided"}`,
      ].join("\n"),
    },
  ];
}
```

- [ ] **Step 3: Write src/lib/matching/parseScore.ts**

```typescript
export interface ScoreResult {
  score: number;
  reason: string;
}

export function parseScoreResponse(raw: string): ScoreResult | null {
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch (err) {
    console.warn(`[match] failed to parse score response as JSON: ${(err as Error).message}`);
    return null;
  }

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    console.warn("[match] score response was not a JSON object, skipping");
    return null;
  }

  const obj = parsed as Record<string, unknown>;
  const score = obj.score;
  const reason = obj.reason;

  if (typeof score !== "number" || !Number.isInteger(score) || score < 1 || score > 10) {
    console.warn(`[match] score response had invalid score value: ${JSON.stringify(score)}`);
    return null;
  }

  if (typeof reason !== "string" || reason.trim().length === 0) {
    console.warn("[match] score response had invalid reason value");
    return null;
  }

  return { score, reason: reason.trim() };
}
```

- [ ] **Step 4: Write src/lib/matching/threshold.ts**

```typescript
export function shouldGenerateCoverNote(score: number, threshold: number): boolean {
  return score >= threshold;
}
```

- [ ] **Step 5: Write src/lib/matching/sanitizeCoverNote.ts**

```typescript
export function sanitizeCoverNote(raw: string): string {
  return raw
    .trim()
    .replace(/^```(?:\w+)?\s*/i, "")
    .replace(/```\s*$/i, "")
    .replace(/^["']|["']$/g, "")
    .trim();
}
```

- [ ] **Step 6: Install Vitest**

```bash
npm install -D vitest
```

- [ ] **Step 7: Write vitest.config.ts**

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
  },
});
```

- [ ] **Step 8: Add test script to package.json**

In `"scripts"`, add:

```json
"test": "vitest run"
```

- [ ] **Step 9: Write tests/match.test.ts (RED first — confirm it fails before Steps 1-5 existed conceptually; since the modules already exist from this task, run once to confirm all pass, not TDD-sequenced)**

```typescript
import { describe, expect, it } from "vitest";
import { parseScoreResponse } from "../src/lib/matching/parseScore";
import { shouldGenerateCoverNote } from "../src/lib/matching/threshold";
import { sanitizeCoverNote } from "../src/lib/matching/sanitizeCoverNote";

describe("parseScoreResponse", () => {
  it("parses a valid plain JSON response", () => {
    const result = parseScoreResponse('{"score": 8, "reason": "Strong React/Node overlap"}');
    expect(result).toEqual({ score: 8, reason: "Strong React/Node overlap" });
  });

  it("parses a response wrapped in ```json fences", () => {
    const result = parseScoreResponse('```json\n{"score": 6, "reason": "Decent fit"}\n```');
    expect(result).toEqual({ score: 6, reason: "Decent fit" });
  });

  it("parses a response wrapped in fences without the json language tag", () => {
    const result = parseScoreResponse('```\n{"score": 3, "reason": "Senior role, poor fit"}\n```');
    expect(result).toEqual({ score: 3, reason: "Senior role, poor fit" });
  });

  it("returns null for malformed JSON", () => {
    expect(parseScoreResponse("this is not json at all")).toBeNull();
  });

  it("returns null for a JSON array instead of an object", () => {
    expect(parseScoreResponse('[{"score": 8, "reason": "x"}]')).toBeNull();
  });

  it("returns null when score is out of range (too high)", () => {
    expect(parseScoreResponse('{"score": 15, "reason": "too high"}')).toBeNull();
  });

  it("returns null when score is zero or negative", () => {
    expect(parseScoreResponse('{"score": 0, "reason": "x"}')).toBeNull();
    expect(parseScoreResponse('{"score": -1, "reason": "x"}')).toBeNull();
  });

  it("returns null when score is not an integer", () => {
    expect(parseScoreResponse('{"score": 7.5, "reason": "x"}')).toBeNull();
  });

  it("returns null when reason is missing", () => {
    expect(parseScoreResponse('{"score": 8}')).toBeNull();
  });

  it("returns null when reason is an empty string", () => {
    expect(parseScoreResponse('{"score": 8, "reason": "  "}')).toBeNull();
  });
});

describe("shouldGenerateCoverNote", () => {
  it("returns true when score is above threshold", () => {
    expect(shouldGenerateCoverNote(9, 7)).toBe(true);
  });

  it("returns true when score equals threshold", () => {
    expect(shouldGenerateCoverNote(7, 7)).toBe(true);
  });

  it("returns false when score is below threshold", () => {
    expect(shouldGenerateCoverNote(6, 7)).toBe(false);
  });

  it("returns false for the lowest possible score against the default threshold", () => {
    expect(shouldGenerateCoverNote(1, 7)).toBe(false);
  });
});

describe("sanitizeCoverNote", () => {
  it("returns plain text unchanged aside from trimming", () => {
    expect(sanitizeCoverNote("  Hi, saw the opening...  ")).toBe("Hi, saw the opening...");
  });

  it("strips markdown code fences", () => {
    expect(sanitizeCoverNote("```\nHi, saw the opening...\n```")).toBe("Hi, saw the opening...");
  });

  it("strips surrounding quotes", () => {
    expect(sanitizeCoverNote('"Hi, saw the opening..."')).toBe("Hi, saw the opening...");
  });
});
```

- [ ] **Step 10: Run the tests**

Run: `npm test`
Expected: all tests pass (21 tests across 3 describe blocks), pristine output (no warnings).

- [ ] **Step 11: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 12: Commit**

```bash
git add src/lib/matching/ vitest.config.ts tests/match.test.ts package.json package-lock.json
git commit -m "feat: add matching prompts, defensive score parsing, threshold logic, and Vitest tests"
```

---

### Task 3: Matcher orchestrator (`src/worker/match.ts`) + npm run match

**Files:**
- Create: `src/worker/match.ts`
- Modify: `package.json` (add `match` script)

**Interfaces:**
- Consumes: `db` from `../lib/db`, `chatCompletion` from `../lib/llm`, `loadProfile` from `../lib/profile`, `buildScorePrompt`/`buildCoverNotePrompt` from `../lib/matching/prompts`, `parseScoreResponse` from `../lib/matching/parseScore`, `shouldGenerateCoverNote` from `../lib/matching/threshold`, `sanitizeCoverNote` from `../lib/matching/sanitizeCoverNote`, `JobForMatching` from `../lib/matching/types` (all from Tasks 1-2).
- Produces: `runMatch(): Promise<void>` — exported the same way `runCollect()` was in Phase 2, so Phase 4 can wire it into the cron later. Also directly runnable via `npm run match`.

- [ ] **Step 1: Write src/worker/match.ts**

```typescript
import { pathToFileURL } from "node:url";
import { db } from "../lib/db";
import { chatCompletion } from "../lib/llm";
import { loadProfile } from "../lib/profile";
import { buildScorePrompt, buildCoverNotePrompt } from "../lib/matching/prompts";
import { parseScoreResponse } from "../lib/matching/parseScore";
import { shouldGenerateCoverNote } from "../lib/matching/threshold";
import { sanitizeCoverNote } from "../lib/matching/sanitizeCoverNote";
import type { JobForMatching } from "../lib/matching/types";

const SCORE_THRESHOLD = Number(process.env.SCORE_THRESHOLD) || 7;

export async function runMatch(): Promise<void> {
  const { profileText, styleExamplesText } = loadProfile();
  const jobs = await db.job.findMany({ where: { score: null } });

  console.log(`[match] scoring ${jobs.length} job(s)`);

  let scored = 0;
  let coverNotesGenerated = 0;

  for (const job of jobs) {
    const jobForMatching: JobForMatching = {
      title: job.title,
      company: job.company,
      location: job.location,
      salaryText: job.salaryText,
      description: job.description,
    };

    try {
      const scoreRaw = await chatCompletion(buildScorePrompt(profileText, jobForMatching));
      const scoreResult = parseScoreResponse(scoreRaw);

      if (!scoreResult) {
        console.warn(`[match] skipping job ${job.id} (${job.title}): could not parse score response`);
        continue;
      }

      let coverNote: string | null = null;
      if (shouldGenerateCoverNote(scoreResult.score, SCORE_THRESHOLD)) {
        try {
          const coverNoteRaw = await chatCompletion(
            buildCoverNotePrompt(profileText, styleExamplesText, jobForMatching)
          );
          coverNote = sanitizeCoverNote(coverNoteRaw);
          coverNotesGenerated++;
        } catch (err) {
          console.error(`[match] failed to generate cover note for job ${job.id}: ${(err as Error).message}`);
        }
      }

      await db.job.update({
        where: { id: job.id },
        data: {
          score: scoreResult.score,
          scoreReason: scoreResult.reason,
          coverNote,
        },
      });
      scored++;
      console.log(`[match] ${job.title} @ ${job.company}: score ${scoreResult.score} (${scoreResult.reason})`);
    } catch (err) {
      console.error(`[match] failed to score job ${job.id} (${job.title}): ${(err as Error).message}`);
    }
  }

  console.log(
    `[match] run complete: scored ${scored}/${jobs.length}, ${coverNotesGenerated} cover note(s) generated`
  );
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  runMatch()
    .catch((err) => {
      console.error("[match] fatal error:", err);
      process.exitCode = 1;
    })
    .finally(async () => {
      await db.$disconnect();
    });
}
```

Note: a job that scores below `SCORE_THRESHOLD` gets `coverNote: null` because `coverNote` is only ever reassigned inside the `if (shouldGenerateCoverNote(...))` block — this is the behavior Task 2's `shouldGenerateCoverNote` tests establish; this step just wires it correctly.

- [ ] **Step 2: Add match script to package.json**

In `"scripts"`, add:

```json
"match": "tsx --env-file=.env src/worker/match.ts"
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Run the real matcher**

```bash
npm run match
```

Expected: `[match] scoring N job(s)` (N will be 3 — the seed jobs from Phase 1, since Phase 2's live collection currently returns 0 real postings), one `[match] <title> @ <company>: score X (reason)` line per job, then `[match] run complete: scored N/N, M cover note(s) generated`. Do not print or paste the full LLM prompts/responses into your report — the console log lines above (title/company/score/reason) are sufficient and don't leak the full profile.

- [ ] **Step 5: Verify scores and reasons landed in Postgres**

```bash
docker compose exec postgres psql -U jobpilot -d jobpilot -c 'SELECT title, score, "scoreReason" FROM "Job" WHERE score IS NOT NULL;'
```

Expected: all 3 seed jobs have a non-null integer `score` (1-10) and a non-empty `scoreReason`.

- [ ] **Step 6: Verify cover notes only exist for jobs at/above threshold**

```bash
docker compose exec postgres psql -U jobpilot -d jobpilot -c 'SELECT title, score, ("coverNote" IS NOT NULL) AS has_cover_note FROM "Job" ORDER BY score DESC;'
```

Expected: every row where `score >= 7` (the default `SCORE_THRESHOLD`) has `has_cover_note = t`; every row where `score < 7` has `has_cover_note = f`. If a job scored >= threshold but has no cover note, check the console output from Step 4 for a `[match] failed to generate cover note` line — that's an acceptable degraded outcome (LLM call failed), not a bug, as long as it was logged.

- [ ] **Step 7: Spot-check cover note quality (read-only, don't paste full profile into your report)**

```bash
docker compose exec postgres psql -U jobpilot -d jobpilot -c 'SELECT title, "coverNote" FROM "Job" WHERE "coverNote" IS NOT NULL;'
```

Read the output yourself and confirm: each cover note is roughly 4 lines or fewer, does not mention CTC/salary/notice period, and does not claim RapidMart processes real transactions or serves real customers (if RapidMart is mentioned at all). Quote at most one short cover note in your report as an example — do not paste the full profile or style-examples content.

- [ ] **Step 8: Verify idempotency**

```bash
npm run match
```

Expected: `[match] scoring 0 job(s)` followed by `[match] run complete: scored 0/0, 0 cover note(s) generated` — since all jobs already have a score, there's nothing left to process. This is expected, not a bug.

- [ ] **Step 9: Commit**

```bash
git add src/worker/match.ts package.json package-lock.json
git commit -m "feat: add matcher orchestrator with cover note generation and npm run match"
```

---

## Self-Review Checklist (for whoever executes this plan)

- [ ] Collected/seed jobs get sensible scores (1-10) and one-line reasons
- [ ] Jobs scoring >= `SCORE_THRESHOLD` get a short (~4 line), honest cover note; jobs below do not
- [ ] `npm test` passes (all Vitest tests green, pristine output)
- [ ] A malformed/fenced/garbage LLM score response never crashes `npm run match` — it logs a warning and skips that job
- [ ] Re-running `npm run match` after a full run finds 0 jobs left to score (idempotent by construction)
- [ ] No cover note mentions CTC, salary, or notice period
- [ ] No cover note overstates RapidMart as having real transactions/customers
- [ ] `profile.md`/`style-examples.md` contents never appear in any committed file, report file, or printed console dump beyond short, non-sensitive confirmations
- [ ] `npx tsc --noEmit` passes with no errors
- [ ] All 3 tasks committed separately
