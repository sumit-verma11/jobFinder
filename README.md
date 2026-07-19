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
