# JobPilot Phase 4 — Telegram Notify + Commands Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Send one Telegram notification per job scoring at/above `SCORE_THRESHOLD` (never re-notifying), always send a status message even when there's nothing to report (silence must never mean success), support `/saved`, `/applied <jobId>`, `/skip <jobId>` bot commands restricted to the owner's Telegram account, and wire `collect → match → notify` into the real cron schedule.

**Architecture:** `src/lib/telegram.ts` owns the grammY `Bot` instance: an allowlist middleware that silently drops any update not from `TELEGRAM_ALLOWED_USER_ID`, the three command handlers (talking to Postgres directly via `db`), and a `notifyUser(message)` helper for one-way pushes. `src/worker/notify.ts` is the orchestrator: find `Job` rows that qualify and haven't been notified, send one message per job (marking `notifiedAt` only after a confirmed send), then send a run-summary message (no-new-matches, or a PARTIAL/FAILED alert pulled from the most recent `RunLog`). `src/worker/index.ts` — previously just a 1-minute test tick — becomes the real entry point: it starts the Telegram bot's long-polling loop and schedules `collect → match → notify` on `CRON_SCHEDULE`.

**Tech Stack:** Same as Phases 1-3, plus grammY (spec-mandated for this phase, no new "ask before adding" packages).

## Global Constraints

- TypeScript strict mode is on project-wide.
- No paid services — Telegram Bot API and grammY are free; no packages beyond grammY.
- **Non-negotiable (spec):** "Silence must always mean something is broken." Every `runNotify()` call must send at least one Telegram message: either per-job matches, or "No new matches today (scanned N jobs)", or a PARTIAL/FAILED alert (or more than one of these — they're not mutually exclusive).
- Bot commands respond ONLY to `TELEGRAM_ALLOWED_USER_ID`; every other Telegram user ID is silently ignored at the middleware level — no reply at all, not even an error, so the bot doesn't confirm its own existence to strangers.
- `notifiedAt` is set only after a confirmed successful Telegram send for that job — if the send throws, leave it `null` so the next run retries (matches the "silence = broken" philosophy: a persistently failing Telegram integration should keep trying loudly, not silently give up).
- The per-job notification message includes exactly the fields the spec lists: title, company, location, salary, score + reason, link, cover note (plus the job's id, since `/applied`/`/skip` need it) — no CTC/notice period in this message; that data isn't part of the spec's field list for this message and has no reason to appear here.
- `TELEGRAM_BOT_TOKEN` and `TELEGRAM_ALLOWED_USER_ID` are read from `.env` (already in `.env.example` since Phase 1). The user has these or will obtain them — implementers must NOT fabricate, guess, or hardcode values.
- `worker/index.ts`'s `npm run worker` script needs `--env-file=.env` from this phase on (it's the first time `worker/index.ts` itself reads env vars — `CRON_SCHEDULE`, plus everything the pipeline functions it now calls need).
- No parse_mode (Markdown/HTML) on outgoing Telegram messages — job titles, scraped locations, and LLM-generated cover notes are untrusted/uncontrolled text that could contain characters that break Telegram's Markdown/HTML parsing and cause the send to fail. Plain text is boring and reliable; use it.

---

### Task 1: Telegram bot (`src/lib/telegram.ts`)

**Files:**
- Create: `src/lib/telegram.ts`

**Interfaces:**
- Consumes: `db` from `./db`, `AppStatus` from `@prisma/client`, `process.env.TELEGRAM_BOT_TOKEN`, `process.env.TELEGRAM_ALLOWED_USER_ID`.
- Produces: `bot` (a configured grammY `Bot` instance, with the allowlist middleware and all three commands already registered — Task 3 just calls `bot.start()` on it) and `notifyUser(message: string): Promise<void>` — consumed by Task 2's `worker/notify.ts`.

- [ ] **Step 1: Install grammY**

```bash
npm install grammy
```

- [ ] **Step 2: Write src/lib/telegram.ts**

```typescript
import { Bot } from "grammy";
import { AppStatus } from "@prisma/client";
import { db } from "./db";

const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) {
  throw new Error("TELEGRAM_BOT_TOKEN is not set");
}

const allowedUserId = Number(process.env.TELEGRAM_ALLOWED_USER_ID);
if (!allowedUserId) {
  throw new Error("TELEGRAM_ALLOWED_USER_ID is not set");
}

export const bot = new Bot(token);

bot.use(async (ctx, next) => {
  if (ctx.from?.id !== allowedUserId) {
    return;
  }
  await next();
});

bot.command("saved", async (ctx) => {
  const jobs = await db.job.findMany({
    where: {
      notifiedAt: { not: null },
      OR: [{ application: null }, { application: { status: AppStatus.SAVED } }],
    },
    orderBy: { score: "desc" },
    take: 20,
  });

  if (jobs.length === 0) {
    await ctx.reply("No saved jobs — nothing pending action.");
    return;
  }

  const lines = jobs.map(
    (job) => `#${job.id}\n${job.title} @ ${job.company} — score ${job.score}\n${job.url}`
  );
  await ctx.reply(lines.join("\n\n"));
});

bot.command("applied", async (ctx) => {
  const jobId = ctx.match?.toString().trim();
  if (!jobId) {
    await ctx.reply("Usage: /applied <jobId>");
    return;
  }

  const job = await db.job.findUnique({ where: { id: jobId } });
  if (!job) {
    await ctx.reply(`No job found with id ${jobId}`);
    return;
  }

  await db.application.upsert({
    where: { jobId },
    create: { jobId, status: AppStatus.APPLIED, appliedAt: new Date() },
    update: { status: AppStatus.APPLIED, appliedAt: new Date() },
  });

  await ctx.reply(`Marked "${job.title}" as APPLIED.`);
});

bot.command("skip", async (ctx) => {
  const jobId = ctx.match?.toString().trim();
  if (!jobId) {
    await ctx.reply("Usage: /skip <jobId>");
    return;
  }

  const job = await db.job.findUnique({ where: { id: jobId } });
  if (!job) {
    await ctx.reply(`No job found with id ${jobId}`);
    return;
  }

  await db.application.upsert({
    where: { jobId },
    create: { jobId, status: AppStatus.REJECTED },
    update: { status: AppStatus.REJECTED },
  });

  await ctx.reply(`Marked "${job.title}" as REJECTED.`);
});

export async function notifyUser(message: string): Promise<void> {
  await bot.api.sendMessage(allowedUserId, message);
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Live smoke test — confirm the bot can send a message**

Requires `TELEGRAM_BOT_TOKEN` and `TELEGRAM_ALLOWED_USER_ID` already set in `.env`. If either is missing, STOP and report NEEDS_CONTEXT — do not fake or skip this.

```bash
cat > /tmp/telegram-smoke.mts << 'EOF'
import { notifyUser } from "/Volumes/Projects/JobFinder/src/lib/telegram.ts";
await notifyUser("JobPilot Phase 4 Task 1 smoke test — if you see this, the bot can send messages.");
console.log("sent");
EOF
npx tsx --env-file=.env /tmp/telegram-smoke.mts
rm /tmp/telegram-smoke.mts
```

Expected: prints `sent`, and a real Telegram message arrives on the owner's phone/app. Report whether you have external confirmation the message arrived (you generally won't — that's fine, note in your report that this needs the human's confirmation) but do confirm the script itself ran without throwing.

- [ ] **Step 5: Commit**

```bash
git add src/lib/telegram.ts package.json package-lock.json
git commit -m "feat: add Telegram bot with /saved, /applied, /skip commands and notifyUser helper"
```

---

### Task 2: Notify orchestrator (`src/worker/notify.ts`) + npm run notify

**Files:**
- Create: `src/worker/notify.ts`
- Modify: `package.json` (add `notify` script)

**Interfaces:**
- Consumes: `db` from `../lib/db`, `notifyUser` from `../lib/telegram` (Task 1).
- Produces: `runNotify(): Promise<void>` — exported the same way `runCollect()`/`runMatch()` are, for Task 3's cron wiring. Also directly runnable via `npm run notify`.

- [ ] **Step 1: Write src/worker/notify.ts**

```typescript
import { pathToFileURL } from "node:url";
import { db } from "../lib/db";
import { notifyUser } from "../lib/telegram";

const SCORE_THRESHOLD = Number(process.env.SCORE_THRESHOLD) || 7;

export async function runNotify(): Promise<void> {
  const latestRunLog = await db.runLog.findFirst({ orderBy: { startedAt: "desc" } });

  const jobsToNotify = await db.job.findMany({
    where: {
      score: { gte: SCORE_THRESHOLD },
      notifiedAt: null,
    },
  });

  console.log(`[notify] ${jobsToNotify.length} job(s) to notify`);

  let notified = 0;
  for (const job of jobsToNotify) {
    try {
      await notifyUser(formatJobMessage(job));
      await db.job.update({ where: { id: job.id }, data: { notifiedAt: new Date() } });
      notified++;
    } catch (err) {
      console.error(`[notify] failed to notify for job ${job.id}: ${(err as Error).message}`);
    }
  }

  if (notified === 0) {
    const scanned = latestRunLog?.jobsFound ?? 0;
    await sendSafely(`No new matches today (scanned ${scanned} jobs).`);
  }

  if (latestRunLog && latestRunLog.status !== "SUCCESS") {
    await sendSafely(
      `Today's collection run was ${latestRunLog.status}. ${latestRunLog.error ?? ""}`.trim()
    );
  }

  console.log(`[notify] run complete: notified ${notified}/${jobsToNotify.length}`);
}

async function sendSafely(message: string): Promise<void> {
  try {
    await notifyUser(message);
  } catch (err) {
    console.error(`[notify] failed to send status message: ${(err as Error).message}`);
  }
}

function formatJobMessage(job: {
  id: string;
  title: string;
  company: string;
  location: string | null;
  salaryText: string | null;
  score: number | null;
  scoreReason: string | null;
  url: string;
  coverNote: string | null;
}): string {
  const lines = [
    `New match: ${job.score}/10 (#${job.id})`,
    `${job.title} @ ${job.company}`,
    `Location: ${job.location ?? "not specified"}`,
    `Salary: ${job.salaryText ?? "not specified"}`,
    `Why: ${job.scoreReason ?? "n/a"}`,
    job.url,
  ];

  if (job.coverNote) {
    lines.push("", "Cover note:", job.coverNote);
  }

  lines.push("", `Reply /applied ${job.id} or /skip ${job.id}`);

  return lines.join("\n");
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  runNotify()
    .catch((err) => {
      console.error("[notify] fatal error:", err);
      process.exitCode = 1;
    })
    .finally(async () => {
      await db.$disconnect();
    });
}
```

- [ ] **Step 2: Add notify script to package.json**

In `"scripts"`, add:

```json
"notify": "tsx --env-file=.env src/worker/notify.ts"
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Run the real notifier**

At this point in the project, all 3 seed jobs already have scores (9, 7, 6) from Phase 3's live run, and the two scoring >=7 already have cover notes — but none have `notifiedAt` set yet, so this is the first real notify run.

```bash
npm run notify
```

Expected: `[notify] 2 job(s) to notify`, two real Telegram messages arrive (one per job scoring >=7), `[notify] run complete: notified 2/2`. Since the latest `RunLog` status should be `PARTIAL` (from Phase 2's live collect run against sources with data issues), a third message about that PARTIAL run should also arrive.

- [ ] **Step 5: Verify notifiedAt was set**

```bash
docker compose exec postgres psql -U jobpilot -d jobpilot -c 'SELECT title, score, ("notifiedAt" IS NOT NULL) AS notified FROM "Job" ORDER BY score DESC;'
```

Expected: the two jobs scoring >=7 have `notified = t`; the one scoring 6 has `notified = f` (it was never a notify candidate).

- [ ] **Step 6: Verify idempotency — re-running sends no duplicate job notifications**

```bash
npm run notify
```

Expected: `[notify] 0 job(s) to notify`. Since `notified` will be 0, a "No new matches today (scanned N jobs)" message IS expected and correct here — that's the "silence must always mean something is broken" rule working as designed, not a bug. Confirm this message actually arrives.

- [ ] **Step 7: Commit**

```bash
git add src/worker/notify.ts package.json package-lock.json
git commit -m "feat: add notify orchestrator with run-summary alerts and npm run notify"
```

---

### Task 3: Wire the full pipeline into the cron (`src/worker/index.ts`)

**Files:**
- Modify: `src/worker/index.ts` (replace Phase 1's temporary 1-minute test tick)
- Modify: `package.json` (add `--env-file=.env` to the `worker` script)

**Interfaces:**
- Consumes: `runCollect` from `./collect` (Phase 2), `runMatch` from `./match` (Phase 3), `runNotify` from `./notify` (Task 2), `bot` from `../lib/telegram` (Task 1).
- Produces: the real `npm run worker` entry point — starts Telegram bot polling (so commands work) and schedules `collect → match → notify` on `CRON_SCHEDULE`.

- [ ] **Step 1: Replace src/worker/index.ts**

```typescript
import cron from "node-cron";
import { runCollect } from "./collect";
import { runMatch } from "./match";
import { runNotify } from "./notify";
import { bot } from "../lib/telegram";

const schedule = process.env.CRON_SCHEDULE || "0 9 * * *";

console.log("[worker] starting, schedule:", schedule);

cron.schedule(schedule, async () => {
  console.log(`[worker] pipeline run starting @ ${new Date().toISOString()}`);
  try {
    await runCollect();
    await runMatch();
    await runNotify();
  } catch (err) {
    console.error("[worker] pipeline run failed:", err);
  }
  console.log(`[worker] pipeline run finished @ ${new Date().toISOString()}`);
});

bot.start().catch((err) => {
  console.error("[worker] telegram bot polling failed:", err);
});

console.log("[worker] telegram bot listening for commands");
console.log("[worker] scheduled, waiting for cron ticks... (Ctrl+C to stop)");
```

- [ ] **Step 2: Update the worker script in package.json**

Change the existing `"worker"` script to include `--env-file=.env` (it didn't need it in Phase 1, but now reads `CRON_SCHEDULE` directly and calls functions that need `OPENROUTER_API_KEY`, `TELEGRAM_BOT_TOKEN`, etc.):

```json
"worker": "tsx --env-file=.env src/worker/index.ts"
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Start the worker and confirm the bot responds to a live command**

```bash
npm run worker
```

Expected startup output: `[worker] starting, schedule: ...`, `[worker] telegram bot listening for commands`, `[worker] scheduled, waiting for cron ticks...`. While it's running, from the owner's Telegram account, send `/saved`. Confirm a reply arrives (either a list of saved jobs, or "No saved jobs — nothing pending action."). This proves the bot's long-polling loop is actually live, not just that `bot.start()` was called without erroring.

- [ ] **Step 5: Confirm the pipeline composition is correct without waiting for the real schedule**

Waiting for `CRON_SCHEDULE` (default once daily) isn't practical to verify live. Instead, confirm by running the three pipeline functions manually in the same order the cron callback uses:

```bash
npm run collect && npm run match && npm run notify
```

Expected: all three complete without error (collect may find 0 new sources per Phase 2's known limitation — that's fine, not this task's concern), confirming the composition order works end to end. Cross-check this matches `worker/index.ts`'s cron callback by reading the file — both should call `runCollect()` → `runMatch()` → `runNotify()` in that order.

- [ ] **Step 6: Stop the worker**

Ctrl+C the running `npm run worker` process from Step 4 once you've confirmed the command reply.

- [ ] **Step 7: Commit**

```bash
git add src/worker/index.ts package.json
git commit -m "feat: wire collect -> match -> notify into the real cron schedule, start Telegram bot polling"
```

---

## Self-Review Checklist (for whoever executes this plan)

- [ ] Every job scoring >= `SCORE_THRESHOLD` gets exactly one Telegram notification, never re-sent
- [ ] A run with zero new matches still sends "No new matches today (scanned N jobs)."
- [ ] A PARTIAL/FAILED `RunLog` status still produces a Telegram alert, independent of whether there were job matches
- [ ] `/saved`, `/applied <jobId>`, `/skip <jobId>` all work and update the DB correctly (verified live by the human)
- [ ] Messages from a Telegram user ID other than `TELEGRAM_ALLOWED_USER_ID` produce no bot response at all (verified by code review of the middleware; ideally also live-verified by the human with a second account if they have one)
- [ ] No cover note or notification message contains CTC/salary/notice period
- [ ] `npm run worker` starts, the bot responds to a live command, and stopping/restarting it doesn't re-notify already-notified jobs
- [ ] `npx tsc --noEmit` passes with no errors
- [ ] All 3 tasks committed separately
