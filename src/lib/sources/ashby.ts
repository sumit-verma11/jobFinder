import { fetchJson } from "./httpJson";
import type { ExtractedJob } from "./types";

interface AshbyJob {
  title: string;
  jobUrl?: string | null;
  applyUrl?: string | null;
  locationName?: string | null;
  publishedDate?: string | null;
}

interface AshbyResponse {
  jobs: AshbyJob[];
}

export async function collectFromAshby(companyName: string, slug: string): Promise<ExtractedJob[]> {
  const data = await fetchJson<AshbyResponse>(
    `https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(slug)}`
  );

  return data.jobs.map((job) => ({
    title: job.title,
    url: job.jobUrl ?? job.applyUrl ?? "",
    company: companyName,
    location: job.locationName ?? null,
    salaryText: null,
    postedAt: job.publishedDate ?? null,
  }));
}
