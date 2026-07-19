import { fetchJson } from "./httpJson";
import type { ExtractedJob } from "./types";

interface WorkableJob {
  title: string;
  shortcode: string;
  city?: string | null;
  country?: string | null;
  published_on?: string | null;
}

interface WorkableResponse {
  jobs: WorkableJob[];
}

export async function collectFromWorkable(companyName: string, slug: string): Promise<ExtractedJob[]> {
  const data = await fetchJson<WorkableResponse>(
    `https://apply.workable.com/api/v1/widget/accounts/${encodeURIComponent(slug)}`
  );

  return data.jobs.map((job) => ({
    title: job.title,
    url: `https://apply.workable.com/${slug}/j/${job.shortcode}/`,
    company: companyName,
    location: [job.city, job.country].filter((part): part is string => Boolean(part)).join(", ") || null,
    salaryText: null,
    postedAt: job.published_on ?? null,
  }));
}
