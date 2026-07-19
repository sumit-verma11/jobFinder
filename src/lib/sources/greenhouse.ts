import { fetchJson } from "./httpJson";
import type { ExtractedJob } from "./types";

interface GreenhouseJob {
  title: string;
  absolute_url: string;
  location?: { name?: string | null } | null;
  updated_at?: string | null;
}

interface GreenhouseResponse {
  jobs: GreenhouseJob[];
}

export async function collectFromGreenhouse(companyName: string, slug: string): Promise<ExtractedJob[]> {
  const data = await fetchJson<GreenhouseResponse>(
    `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(slug)}/jobs`
  );

  return data.jobs.map((job) => ({
    title: job.title,
    url: job.absolute_url,
    company: companyName,
    location: job.location?.name ?? null,
    salaryText: null,
    postedAt: job.updated_at ?? null,
  }));
}
