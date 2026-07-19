import { db } from "../lib/db";
import { collectFromCareersPage } from "../lib/sources/careersPage";
import { sources } from "../lib/sources/sources.config";
import type { ExtractedJob, Source } from "../lib/sources/types";

const DELAY_BETWEEN_SOURCES_MS = 2_000;

export async function runCollect(): Promise<void> {
  // status starts FAILED so that if the process crashes before the final
  // update below, the row still truthfully signals a broken run instead of
  // silently looking like a success.
  const runLog = await db.runLog.create({ data: { status: "FAILED" } });

  let jobsFound = 0;
  let jobsNew = 0;
  const errors: string[] = [];

  for (let i = 0; i < sources.length; i++) {
    const source = sources[i];
    if (i > 0) {
      await sleep(DELAY_BETWEEN_SOURCES_MS);
    }

    console.log(`[collect] fetching ${source.name} (${source.url})`);
    try {
      const extracted = await collectFromCareersPage(source);
      jobsFound += extracted.length;
      const inserted = await saveNewJobs(source, extracted);
      jobsNew += inserted;
      console.log(`[collect] ${source.name}: found ${extracted.length}, ${inserted} new`);
    } catch (err) {
      const message = `${source.name}: ${(err as Error).message}`;
      console.error(`[collect] ${message}`);
      errors.push(message);
    }
  }

  const allFailed = errors.length === sources.length;
  const status = errors.length === 0 ? "SUCCESS" : allFailed ? "FAILED" : "PARTIAL";

  await db.runLog.update({
    where: { id: runLog.id },
    data: {
      finishedAt: new Date(),
      status,
      jobsFound,
      jobsNew,
      error: errors.length > 0 ? errors.join("; ") : null,
    },
  });

  console.log(`[collect] run complete: ${status}, found ${jobsFound}, new ${jobsNew}`);
}

async function saveNewJobs(source: Source, extracted: ExtractedJob[]): Promise<number> {
  let inserted = 0;
  for (const job of extracted) {
    const exists = await db.job.findUnique({ where: { url: job.url } });
    if (exists) continue;

    try {
      await db.job.create({
        data: {
          url: job.url,
          title: job.title,
          company: source.name,
          location: typeof job.location === "string" ? job.location : null,
          salaryText: typeof job.salaryText === "string" ? job.salaryText : null,
          postedAt: parsePostedAt(job.postedAt),
          source: source.name,
        },
      });
      inserted++;
    } catch (err) {
      console.warn(`[collect] failed to insert job ${job.url}: ${(err as Error).message}`);
    }
  }
  return inserted;
}

function parsePostedAt(value: unknown): Date | null {
  if (typeof value !== "string") return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runCollect()
    .catch((err) => {
      console.error("[collect] fatal error:", err);
      process.exitCode = 1;
    })
    .finally(async () => {
      await db.$disconnect();
    });
}
