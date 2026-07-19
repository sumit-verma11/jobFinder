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
