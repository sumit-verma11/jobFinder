import { pathToFileURL } from "node:url";
import type { Source as DbSource } from "@prisma/client";
import { db } from "../lib/db";
import { collectFromCareersPage } from "../lib/sources/careersPage";
import { collectFromGreenhouse } from "../lib/sources/greenhouse";
import { collectFromLever } from "../lib/sources/lever";
import { collectFromAshby } from "../lib/sources/ashby";
import { collectFromWorkable } from "../lib/sources/workable";
import { collectFromAdzuna } from "../lib/sources/adzuna";
import { collectFromArbeitnow } from "../lib/sources/arbeitnow";
import { loadJobTitleKeywords } from "../lib/profile";
import type { ExtractedJob } from "../lib/sources/types";

const DELAY_BETWEEN_SOURCES_MS = 2_000;

export async function runCollect(): Promise<void> {
  // status starts FAILED so that if the process crashes before the final
  // update below, the row still truthfully signals a broken run instead of
  // silently looking like a success.
  const runLog = await db.runLog.create({ data: { status: "FAILED" } });

  let jobsFound = 0;
  let jobsNew = 0;
  const errors: string[] = [];

  const keywords = await loadJobTitleKeywords();
  const companySources = await db.source.findMany();

  for (let i = 0; i < companySources.length; i++) {
    const source = companySources[i];
    if (i > 0) {
      await sleep(DELAY_BETWEEN_SOURCES_MS);
    }

    console.log(`[collect] fetching ${source.name} (${source.kind})`);
    try {
      const extracted = await collectFromCompanySource(source);
      // ATS boards (Greenhouse/Lever/Ashby/Workable) return every open role at a
      // company, across every department — unlike careersPage (filtered by its own
      // LLM prompt) or the aggregators (filtered by keyword query), so without this
      // filter a single company can flood the Job table with irrelevant roles
      // (Legal, Sales, etc.) that then sit unscored waiting on match.ts's LLM cap.
      const relevant =
        source.kind === "ATS" && keywords.length > 0
          ? extracted.filter((job) => matchesKeywords(job.title, keywords))
          : extracted;
      jobsFound += relevant.length;
      const inserted = await saveNewJobs(source.name, relevant);
      jobsNew += inserted;
      console.log(
        `[collect] ${source.name}: found ${extracted.length}` +
          (relevant.length !== extracted.length ? ` (${relevant.length} matched keywords)` : "") +
          `, ${inserted} new`
      );
    } catch (err) {
      const message = `${source.name}: ${(err as Error).message}`;
      console.error(`[collect] ${message}`);
      errors.push(message);
    }
  }

  let aggregatorsRun = 0;

  if (keywords.length > 0) {
    const aggregators = [
      { label: "Adzuna", run: () => collectFromAdzuna(keywords) },
      { label: "Arbeitnow", run: () => collectFromArbeitnow(keywords) },
    ] as const;

    for (const aggregator of aggregators) {
      await sleep(DELAY_BETWEEN_SOURCES_MS);
      console.log(`[collect] fetching ${aggregator.label} (keywords: ${keywords.join(", ")})`);
      aggregatorsRun++;
      try {
        const extracted = await aggregator.run();
        jobsFound += extracted.length;
        const inserted = await saveNewJobs(aggregator.label, extracted);
        jobsNew += inserted;
        console.log(`[collect] ${aggregator.label}: found ${extracted.length}, ${inserted} new`);
      } catch (err) {
        const message = `${aggregator.label}: ${(err as Error).message}`;
        console.error(`[collect] ${message}`);
        errors.push(message);
      }
    }
  } else {
    console.log("[collect] skipping aggregators: no jobTitleKeywords set in /settings");
  }

  const totalSources = companySources.length + aggregatorsRun;
  const allFailed = totalSources > 0 && errors.length === totalSources;
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

async function collectFromCompanySource(source: DbSource): Promise<ExtractedJob[]> {
  if (source.kind === "CAREERS_PAGE") {
    if (!source.url) {
      throw new Error(`CAREERS_PAGE source ${source.name} has no url`);
    }
    return collectFromCareersPage({ name: source.name, type: "careersPage", url: source.url });
  }

  if (!source.platform || !source.slug) {
    throw new Error(`ATS source ${source.name} is missing platform/slug`);
  }

  switch (source.platform) {
    case "GREENHOUSE":
      return collectFromGreenhouse(source.name, source.slug);
    case "LEVER":
      return collectFromLever(source.name, source.slug);
    case "ASHBY":
      return collectFromAshby(source.name, source.slug);
    case "WORKABLE":
      return collectFromWorkable(source.name, source.slug);
  }
}

async function saveNewJobs(sourceLabel: string, extracted: ExtractedJob[]): Promise<number> {
  let inserted = 0;
  for (const job of extracted) {
    const exists = await db.job.findUnique({ where: { url: job.url } });
    if (exists) continue;

    try {
      await db.job.create({
        data: {
          url: job.url,
          title: job.title,
          company: job.company,
          location: typeof job.location === "string" ? job.location : null,
          salaryText: typeof job.salaryText === "string" ? job.salaryText : null,
          postedAt: parsePostedAt(job.postedAt),
          source: sourceLabel,
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

function matchesKeywords(title: string, keywords: string[]): boolean {
  const haystack = title.toLowerCase();
  return keywords.some((keyword) => haystack.includes(keyword.toLowerCase()));
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  runCollect()
    .catch((err) => {
      console.error("[collect] fatal error:", err);
      process.exitCode = 1;
    })
    .finally(async () => {
      await db.$disconnect();
    });
}
