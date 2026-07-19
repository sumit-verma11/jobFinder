import { fetchJson } from "./httpJson";
import type { ExtractedJob } from "./types";

interface ArbeitnowJob {
  title: string;
  company_name: string;
  url: string;
  location?: string | null;
  created_at?: number | null;
}

interface ArbeitnowResponse {
  data: ArbeitnowJob[];
}

export async function collectFromArbeitnow(keywords: string[]): Promise<ExtractedJob[]> {
  const data = await fetchJson<ArbeitnowResponse>("https://www.arbeitnow.com/api/job-board-api");
  const needles = keywords.map((keyword) => keyword.toLowerCase());

  return data.data
    .filter((job) => needles.some((needle) => job.title.toLowerCase().includes(needle)))
    .map((job) => ({
      title: job.title,
      url: job.url,
      company: job.company_name,
      location: job.location ?? null,
      salaryText: null,
      postedAt: job.created_at ? new Date(job.created_at * 1000).toISOString() : null,
    }));
}
