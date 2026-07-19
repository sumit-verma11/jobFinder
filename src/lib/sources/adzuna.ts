import { fetchJson } from "./httpJson";
import type { ExtractedJob } from "./types";

interface AdzunaResult {
  title: string;
  company?: { display_name?: string | null } | null;
  location?: { display_name?: string | null } | null;
  redirect_url: string;
  created?: string | null;
  salary_min?: number | null;
  salary_max?: number | null;
}

interface AdzunaResponse {
  results: AdzunaResult[];
}

const ADZUNA_COUNTRY = "in";

export async function collectFromAdzuna(keywords: string[]): Promise<ExtractedJob[]> {
  const appId = process.env.ADZUNA_APP_ID;
  const appKey = process.env.ADZUNA_APP_KEY;
  if (!appId || !appKey) {
    throw new Error("ADZUNA_APP_ID / ADZUNA_APP_KEY not set");
  }

  const what = encodeURIComponent(keywords.join(" "));
  const url =
    `https://api.adzuna.com/v1/api/jobs/${ADZUNA_COUNTRY}/search/1` +
    `?app_id=${encodeURIComponent(appId)}&app_key=${encodeURIComponent(appKey)}&what=${what}&content-type=application/json`;

  const data = await fetchJson<AdzunaResponse>(url);

  return data.results.map((result) => ({
    title: result.title,
    url: result.redirect_url,
    company: result.company?.display_name ?? "Unknown",
    location: result.location?.display_name ?? null,
    salaryText: formatSalary(result.salary_min, result.salary_max),
    postedAt: result.created ?? null,
  }));
}

function formatSalary(min?: number | null, max?: number | null): string | null {
  if (!min && !max) return null;
  if (min && max) return `₹${Math.round(min)} - ₹${Math.round(max)}`;
  return `₹${Math.round(min ?? max ?? 0)}`;
}
