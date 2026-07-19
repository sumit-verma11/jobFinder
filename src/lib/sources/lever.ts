import { fetchJson } from "./httpJson";
import type { ExtractedJob } from "./types";

interface LeverPosting {
  text: string;
  hostedUrl: string;
  categories?: { location?: string | null } | null;
  createdAt?: number | null;
}

type LeverResponse = LeverPosting[];

export async function collectFromLever(companyName: string, slug: string): Promise<ExtractedJob[]> {
  const postings = await fetchJson<LeverResponse>(
    `https://api.lever.co/v0/postings/${encodeURIComponent(slug)}?mode=json`
  );

  return postings.map((posting) => ({
    title: posting.text,
    url: posting.hostedUrl,
    company: companyName,
    location: posting.categories?.location ?? null,
    salaryText: null,
    postedAt: posting.createdAt ? new Date(posting.createdAt).toISOString() : null,
  }));
}
