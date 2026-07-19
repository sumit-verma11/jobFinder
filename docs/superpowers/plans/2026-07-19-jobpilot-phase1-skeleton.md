# JobPilot Phase 1 — Skeleton + DB Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the JobPilot repo skeleton — Next.js 14 (App Router, TS strict, Tailwind), Postgres via Docker Compose, Prisma schema/migrations, a worker process that ticks on a cron and logs "worker alive", and a seed script that inserts 3 fake jobs — so later phases have a running app and DB to build on.

**Architecture:** A single Next.js app (dashboard + API routes live here in later phases) sits alongside a separate long-running Node worker process (`npm run worker`) that owns cron scheduling. Both share one Prisma client pointed at the same Postgres instance (Docker Compose, local only). No Redis, no queue — node-cron in-process is enough for a single-user daily job.

**Tech Stack:** Node.js 20+, TypeScript (strict), Next.js 14 App Router, Tailwind CSS, PostgreSQL 16 (Docker Compose), Prisma ORM, node-cron, tsx (run TS worker scripts directly).

## Global Constraints

- TypeScript strict mode must be on (`tsconfig.json` → `"strict": true`) — spec requires it project-wide.
- No paid services, no packages beyond what's needed — ask before adding anything not in this plan.
- `npm run dev` must work at the end of this phase.
- Repo root (`/Volumes/Projects/JobFinder`) IS the `jobpilot/` root from the spec — do not nest another folder.
- Prisma schema fields/types must match the spec's data model verbatim (this phase only needs `Job`, `Application`, `AppStatus`, `RunLog` — no logic uses them yet beyond the seed).
- `.env.example` must match the spec's env var list verbatim; a real `.env` (gitignored) is created locally from it.

---

### Task 1: Scaffold Next.js app (TS + Tailwind + App Router)

**Files:**
- Create: entire Next.js scaffold (`package.json`, `tsconfig.json`, `next.config.*`, `tailwind.config.*`, `postcss.config.*`, `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/globals.css`, `.gitignore`, `.eslintrc*`)

**Interfaces:**
- Produces: an npm project at repo root with `npm run dev` serving Next.js on `localhost:3000`, `src/` as the source root, `@/*` import alias, Tailwind wired into `globals.css`.

- [x] **Step 1: Run create-next-app into the current (empty) directory** — DONE (commit 16cb179)

```bash
cd /Volumes/Projects/JobFinder
npx create-next-app@14 . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm --no-turbopack
```

When prompted, accept defaults (project name inferred from directory).

- [x] **Step 2: Verify strict mode is on** — DONE, confirmed `"strict": true` in tsconfig.json

- [x] **Step 3: Verify dev server boots** — DONE, Next.js 14.2.35 boots cleanly, no TS errors

- [x] **Step 4: Commit** — DONE, commit `16cb179` "chore: scaffold Next.js 14 app (TS strict, Tailwind, App Router)"

---

### Task 2: Docker Compose + Prisma schema + migration

**Files:**
- Create: `docker-compose.yml`
- Create: `.env.example`
- Create: `.env` (local only, gitignored — copy of `.env.example` with real values)
- Create: `prisma/schema.prisma`
- Modify: `package.json` (add `db:migrate`, `db:generate` scripts)
- Modify: `.gitignore` (ensure `.env` is ignored — Next.js scaffold already ignores `.env*.local`, add plain `.env` explicitly)

**Interfaces:**
- Produces: a running local Postgres container reachable at `postgresql://jobpilot:jobpilot@localhost:5432/jobpilot`, and Prisma Client generated from a schema exposing `Job`, `Application`, `AppStatus`, `RunLog` — these are the exact model/enum names `src/lib/db.ts` (Task 3) and the seed script import via `@prisma/client`.

- [ ] **Step 1: Write docker-compose.yml**

```yaml
services:
  postgres:
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      POSTGRES_USER: jobpilot
      POSTGRES_PASSWORD: jobpilot
      POSTGRES_DB: jobpilot
    ports:
      - "5432:5432"
    volumes:
      - jobpilot_pgdata:/var/lib/postgresql/data

volumes:
  jobpilot_pgdata:
```

- [ ] **Step 2: Write .env.example**

```
DATABASE_URL=postgresql://jobpilot:jobpilot@localhost:5432/jobpilot
OPENROUTER_API_KEY=
OPENROUTER_MODEL=openrouter/free
TELEGRAM_BOT_TOKEN=
TELEGRAM_ALLOWED_USER_ID=        # bot ignores everyone else — enforce this
CRON_SCHEDULE=0 9 * * *          # 9:00 AM daily
SCORE_THRESHOLD=7
```

- [ ] **Step 3: Copy to a real local .env**

```bash
cp .env.example .env
```

`DATABASE_URL` in `.env` already matches the Compose credentials — no edit needed for local dev. Leave the other keys blank for now (not used until later phases).

- [ ] **Step 4: Confirm .env is gitignored**

Check `.gitignore` contains `.env`. Next.js's default template ignores `.env*.local` but not plain `.env` — add a line `.env` if missing.

- [ ] **Step 5: Install Prisma**

```bash
npm install -D prisma
npm install @prisma/client
```

- [ ] **Step 6: Write prisma/schema.prisma**

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model Job {
  id            String   @id @default(cuid())
  url           String   @unique
  title         String
  company       String
  location      String?
  salaryText    String?
  description   String?
  source        String
  postedAt      DateTime?
  collectedAt   DateTime @default(now())
  score         Int?
  scoreReason   String?
  coverNote     String?
  notifiedAt    DateTime?
  application   Application?
}

model Application {
  id          String    @id @default(cuid())
  jobId       String    @unique
  job         Job       @relation(fields: [jobId], references: [id])
  status      AppStatus @default(SAVED)
  appliedAt   DateTime?
  notes       String?
  followUpAt  DateTime?
  updatedAt   DateTime  @updatedAt
}

enum AppStatus {
  SAVED
  APPLIED
  INTERVIEW
  OFFER
  REJECTED
}

model RunLog {
  id         String    @id @default(cuid())
  startedAt  DateTime  @default(now())
  finishedAt DateTime?
  status     String
  jobsFound  Int       @default(0)
  jobsNew    Int       @default(0)
  error      String?
}
```

- [ ] **Step 7: Add db scripts to package.json**

In `package.json` `"scripts"`, add:

```json
"db:migrate": "prisma migrate dev",
"db:generate": "prisma generate"
```

- [ ] **Step 8: Start Postgres**

```bash
docker compose up -d
```

Expected: `docker compose ps` shows the `postgres` service as `running (healthy)` or `Up`.

- [ ] **Step 9: Run the first migration**

```bash
npm run db:migrate -- --name init
```

Expected: prompts complete without error, creates `prisma/migrations/<timestamp>_init/migration.sql`, prints "Your database is now in sync with your schema."

- [ ] **Step 10: Commit**

```bash
git add docker-compose.yml .env.example .gitignore prisma package.json package-lock.json
git commit -m "feat: add Postgres via Docker Compose and Prisma schema/migration"
```

Note: `.env` itself must NOT be committed (it's gitignored) — verify with `git status` that it doesn't appear before committing.

---

### Task 3: Prisma client singleton + seed script

**Files:**
- Create: `src/lib/db.ts`
- Create: `prisma/seed.ts`
- Modify: `package.json` (add `db:seed` script, `prisma.seed` config)

**Interfaces:**
- Consumes: `PrismaClient`, `AppStatus` from `@prisma/client` (generated in Task 2).
- Produces: `db` — a singleton `PrismaClient` instance exported from `src/lib/db.ts`, imported as `import { db } from "@/lib/db"` by every later phase (worker, API routes). Seed script produces 3 `Job` rows with distinct `url` values for the dashboard to render in Phase 5.

- [ ] **Step 1: Write src/lib/db.ts**

Next.js dev mode hot-reloads modules, which would otherwise spawn a new `PrismaClient` (and new connection pool) on every reload. Cache it on `globalThis` in development.

```typescript
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const db = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}
```

- [ ] **Step 2: Install tsx (to run TS scripts directly, no build step)**

```bash
npm install -D tsx
```

- [ ] **Step 3: Write prisma/seed.ts**

```typescript
import { db } from "../src/lib/db";

async function main() {
  const jobs = [
    {
      url: "https://example.com/jobs/fullstack-dev-1",
      title: "Full Stack Developer",
      company: "Example Corp",
      location: "Noida, India",
      salaryText: "₹8-12 LPA",
      description: "Seeking a full stack developer with React and Node.js experience.",
      source: "seed",
    },
    {
      url: "https://example.com/jobs/react-dev-2",
      title: "React Developer",
      company: "Sample Inc",
      location: "Remote (India)",
      salaryText: "₹10-15 LPA",
      description: "React and TypeScript developer for a growing product team.",
      source: "seed",
    },
    {
      url: "https://example.com/jobs/backend-dev-3",
      title: "Backend Engineer (Node.js)",
      company: "Test Systems",
      location: "Gurugram, India",
      salaryText: "₹9-13 LPA",
      description: "Node.js and Postgres backend engineer, 2-4 years experience.",
      source: "seed",
    },
  ];

  for (const job of jobs) {
    await db.job.upsert({
      where: { url: job.url },
      update: {},
      create: job,
    });
  }

  console.log(`Seeded ${jobs.length} jobs.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
```

`upsert` on `url` makes the seed idempotent — running it twice must not create duplicates or crash on the unique constraint.

- [ ] **Step 4: Add seed script and Prisma seed config to package.json**

In `"scripts"`, add:

```json
"db:seed": "tsx prisma/seed.ts"
```

Add a top-level `"prisma"` key (sibling to `"scripts"`) so `prisma migrate dev` can also trigger seeding automatically:

```json
"prisma": {
  "seed": "tsx prisma/seed.ts"
}
```

- [ ] **Step 5: Run the seed script**

```bash
npm run db:seed
```

Expected output: `Seeded 3 jobs.`

- [ ] **Step 6: Verify rows landed in Postgres**

```bash
docker compose exec postgres psql -U jobpilot -d jobpilot -c "SELECT title, company, url FROM \"Job\";"
```

Expected: 3 rows returned.

- [ ] **Step 7: Verify idempotency**

```bash
npm run db:seed
docker compose exec postgres psql -U jobpilot -d jobpilot -c "SELECT count(*) FROM \"Job\";"
```

Expected: count is still `3`, not `6`.

- [ ] **Step 8: Commit**

```bash
git add src/lib/db.ts prisma/seed.ts package.json package-lock.json
git commit -m "feat: add Prisma client singleton and job seed script"
```

---

### Task 4: Worker entry point (cron tick, logs "worker alive")

**Files:**
- Create: `src/worker/index.ts`
- Modify: `package.json` (add `worker` script)

**Interfaces:**
- Consumes: nothing from earlier tasks yet (Phase 2 wires `collect.ts` in here).
- Produces: a `npm run worker` long-running process. Later phases (`collect.ts`, `match.ts`, `notify.ts`) get imported and called from the cron callback defined here — this file stays the single cron owner per the spec's architecture.

- [ ] **Step 1: Install node-cron**

```bash
npm install node-cron
npm install -D @types/node-cron
```

- [ ] **Step 2: Write src/worker/index.ts**

Uses a hardcoded 1-minute schedule for this phase only, per the spec ("set a 1-min cron temporarily for testing"). Phase 4 switches this to read `CRON_SCHEDULE` from env once there's a real pipeline to run daily.

```typescript
import cron from "node-cron";

const TEMP_TEST_SCHEDULE = "* * * * *"; // every 1 minute — Phase 1 only, replaced in Phase 4

console.log("[worker] starting, schedule:", TEMP_TEST_SCHEDULE);

cron.schedule(TEMP_TEST_SCHEDULE, () => {
  console.log(`[worker] alive @ ${new Date().toISOString()}`);
});

console.log("[worker] scheduled, waiting for ticks... (Ctrl+C to stop)");
```

- [ ] **Step 3: Add worker script to package.json**

In `"scripts"`, add:

```json
"worker": "tsx src/worker/index.ts"
```

- [ ] **Step 4: Run the worker and observe two ticks**

```bash
npm run worker
```

Expected: immediately prints `[worker] starting...` and `[worker] scheduled...`, then a `[worker] alive @ <timestamp>` line once per minute. Let it run ~2 minutes to see 2 ticks, then Ctrl+C.

- [ ] **Step 5: Commit**

```bash
git add src/worker/index.ts package.json package-lock.json
git commit -m "feat: add worker entry with temporary 1-minute cron tick"
```

---

### Task 5: README Phase 1 section + final verification pass

**Files:**
- Create: `README.md`

**Interfaces:**
- Produces: setup/run instructions a fresh clone can follow; no code interfaces (documentation only).

- [ ] **Step 1: Write README.md**

```markdown
# JobPilot

Personal job-search automation: collects postings, scores them against my profile, notifies me on Telegram, and tracks applications on a local dashboard.

## Stack

Next.js 14 (App Router, TS strict) + Tailwind, PostgreSQL (Docker Compose) + Prisma, node-cron worker, OpenRouter LLM, Telegram (grammY).

## Phase 1 — Skeleton + DB

### Setup

\`\`\`bash
npm install
cp .env.example .env       # defaults already match docker-compose credentials
docker compose up -d       # starts Postgres
npm run db:migrate         # creates tables, runs the seed automatically
\`\`\`

If you need to re-seed manually:

\`\`\`bash
npm run db:seed
\`\`\`

### Run

\`\`\`bash
npm run dev       # Next.js dashboard at http://localhost:3000 (empty until Phase 5)
npm run worker     # separate terminal — ticks every 1 minute, logs "[worker] alive @ ..."
\`\`\`

### Verify

- \`docker compose ps\` — postgres container is up
- \`npm run db:seed\` twice — second run does not duplicate rows (check with the psql query below)
- \`docker compose exec postgres psql -U jobpilot -d jobpilot -c 'SELECT title, company FROM "Job";'\` — shows 3 seeded jobs
- \`npm run worker\` — prints an "alive" line once per minute
- \`npm run dev\` — starts with no TypeScript errors
```

- [ ] **Step 2: Full clean-slate verification**

```bash
docker compose down -v
docker compose up -d
sleep 3
npm run db:migrate -- --name init_verify
npm run dev &
sleep 5
curl -sf http://localhost:3000 > /dev/null && echo "dev server OK"
kill %1
```

Expected: migration runs clean against a fresh DB, dev server responds 200.

Note: if `db:migrate` complains the migration already exists from Task 2, that's fine — it means the schema is already applied; just confirm `docker compose exec postgres psql -U jobpilot -d jobpilot -c '\dt'` lists `Job`, `Application`, `RunLog`.

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: add Phase 1 README section"
```

---

## Self-Review Checklist (for whoever executes this plan)

- [ ] `docker compose up -d` + `npm run db:migrate` works from a clean clone
- [ ] Worker ticks and logs "alive" every minute
- [ ] Seed inserts exactly 3 jobs, idempotently
- [ ] `npm run dev` compiles and serves with no TS errors
- [ ] `.env` is gitignored, `.env.example` matches the spec's var list verbatim
- [ ] `strict: true` in tsconfig.json
- [ ] All 5 tasks committed separately
