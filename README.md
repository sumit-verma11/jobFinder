# JobPilot

Personal job-search automation: collects postings, scores them against my profile, notifies me on Telegram, and tracks applications on a local dashboard.

## Stack

Next.js 14 (App Router, TS strict) + Tailwind, PostgreSQL (Docker Compose) + Prisma, node-cron worker, OpenRouter LLM, Telegram (grammY).

## Phase 1 — Skeleton + DB

### Setup

```bash
npm install
cp .env.example .env       # defaults already match docker-compose credentials
docker compose up -d       # starts Postgres
npm run db:migrate         # creates tables, runs the seed automatically
```

If you need to re-seed manually:

```bash
npm run db:seed
```

### Run

```bash
npm run dev       # Next.js dashboard at http://localhost:3000 (placeholder Next.js splash page until Phase 5)
npm run worker     # separate terminal — ticks every 1 minute, logs "[worker] alive @ ..."
```

### Verify

- `docker compose ps` — postgres container is up
- `npm run db:seed` twice — second run does not duplicate rows (check with the psql query below)
- `docker compose exec postgres psql -U jobpilot -d jobpilot -c 'SELECT title, company FROM "Job";'` — shows 3 seeded jobs
- `npm run worker` — prints an "alive" line once per minute
- `npm run dev` — starts with no TypeScript errors

## Phase 2 — Collector

### Setup

Get a free OpenRouter API key at [openrouter.ai/keys](https://openrouter.ai/keys), then add it to `.env`:

```
OPENROUTER_API_KEY=sk-or-v1-...
OPENROUTER_MODEL=openrouter/free
```

### Run

```bash
npm run collect    # fetches all configured sources once, scores nothing yet (Phase 3), logs a RunLog row
```

### Verify

- Console prints one `[collect] fetching <source>` / `[collect] <source>: found N, M new` line per source, then a final `[collect] run complete: <STATUS>, found X, new Y` line
- `docker compose exec postgres psql -U jobpilot -d jobpilot -c 'SELECT source, count(*) FROM "Job" WHERE source != '\''seed'\'' GROUP BY source;'` — shows collected jobs by source
- `docker compose exec postgres psql -U jobpilot -d jobpilot -c 'SELECT status, "jobsFound", "jobsNew" FROM "RunLog" ORDER BY "startedAt" DESC LIMIT 1;'` — shows the latest run's outcome
- Running `npm run collect` twice does not create duplicate `Job.url` rows
- One source failing (bad URL, timeout, LLM hiccup) never stops the others — the run still completes with `PARTIAL` status and the failure recorded in `RunLog.error`

### Known limitation

`sources.config.ts` ships with 5 real company URLs, but at the time of writing 3 of them don't currently have a live, structured job-listing page (a couple point at marketing/services pages rather than an actual open-roles list, and one 404s). The collector code itself is correct and tested — it will pick up real postings as soon as `sources.config.ts` is pointed at working URLs. Edit that file directly to swap in better sources; no other code changes are needed.

## Phase 3 — Matcher + Tailor

### Setup

Copy the templates and fill in your real details — these two files are gitignored (they contain your phone, email, and salary) and are never committed:

```bash
cp src/profile/profile.example.md src/profile/profile.md
cp src/profile/style-examples.example.md src/profile/style-examples.md
# edit both with a text editor — real experience, stack, links, CTC, notice period, and a couple of natural example messages
```

### Run

```bash
npm run match    # scores every Job with score = null, generates a cover note for scores >= SCORE_THRESHOLD
npm test          # runs the Vitest suite for the matching/parsing/threshold logic
```

### Verify

- Console prints one `[match] <title> @ <company>: score X (reason)` line per job, then a final `[match] run complete: scored N/N, M cover note(s) generated` line
- `docker compose exec postgres psql -U jobpilot -d jobpilot -c 'SELECT title, score, "scoreReason" FROM "Job" WHERE score IS NOT NULL;'` — every scored job has an integer 1-10 score and a one-line reason
- `docker compose exec postgres psql -U jobpilot -d jobpilot -c 'SELECT title, score, ("coverNote" IS NOT NULL) AS has_cover_note FROM "Job" ORDER BY score DESC;'` — only jobs scoring >= `SCORE_THRESHOLD` (default 7) have a cover note
- Running `npm run match` twice is a no-op the second time (`scoring 0 job(s)`) — it only processes unscored jobs
- `npm test` — all tests pass, including the safety backstop that discards (and warns about) any generated cover note that accidentally mentions CTC/salary/notice period

### Known limitation

Cover notes are generated from whatever `Job.description` the collector captured — Phase 2's extraction prompt doesn't currently request a description, so it's `null` for every job today. Scoring and cover notes work fine off title/company/location/salary alone, but will get sharper once Phase 2's extraction is extended to pull a short description too (not required for Phase 3 to function).

## Phase 4 — Telegram Notify + Commands

### Setup

Create a bot with [@BotFather](https://t.me/BotFather), then get your own numeric Telegram user ID from [@userinfobot](https://t.me/userinfobot). Add both to `.env`:

```
TELEGRAM_BOT_TOKEN=...
TELEGRAM_ALLOWED_USER_ID=...
CRON_SCHEDULE=0 9 * * *
```

### Run

```bash
npm run worker    # starts Telegram bot polling + schedules collect -> match -> notify on CRON_SCHEDULE
npm run notify     # runs the notifier once, standalone
```

### Verify

- `npm run worker` prints `[worker] telegram bot listening for commands`, then a live `/saved` command from the owner's Telegram account gets a reply — proves long-polling is actually running
- Every `Job` scoring >= `SCORE_THRESHOLD` gets exactly one Telegram message, and re-running `npm run notify` never re-sends it (`notifiedAt` is set only after a confirmed send)
- A run with 0 new matches still sends "No new matches today (scanned N jobs)." — silence never means success
- A non-`SUCCESS` `RunLog` status sends its own alert, independent of whether there were job matches
- `/saved`, `/applied <jobId>`, `/skip <jobId>` all reply and update the `Application` table correctly (`APPLIED` sets `appliedAt`, `REJECTED` does not)
- Messages from any Telegram user ID other than `TELEGRAM_ALLOWED_USER_ID` get no reply at all — the bot doesn't confirm its own existence to strangers
- No notification or cover note ever contains CTC, salary figure beyond the posting's own `salaryText`, or notice period
