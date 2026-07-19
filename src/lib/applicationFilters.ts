import type { Application, AppStatus, Job } from "@prisma/client";

export type ApplicationWithJob = Application & { job: Job };

export interface ApplicationFilters {
  company: string;
  source: string;
  status: AppStatus | "";
  appliedAfter: string;
  appliedBefore: string;
  minScore: number | null;
  search: string;
}

export function filterApplications(
  apps: ApplicationWithJob[],
  filters: ApplicationFilters,
  includeArchived: boolean
): ApplicationWithJob[] {
  return apps.filter((app) => {
    if (!includeArchived && app.archived) return false;

    if (filters.company && !app.job.company.toLowerCase().includes(filters.company.toLowerCase())) {
      return false;
    }

    if (filters.source && app.job.source !== filters.source) {
      return false;
    }

    if (filters.status && app.status !== filters.status) {
      return false;
    }

    if (filters.appliedAfter && (!app.appliedAt || app.appliedAt < new Date(filters.appliedAfter))) {
      return false;
    }

    if (filters.appliedBefore && (!app.appliedAt || app.appliedAt > new Date(filters.appliedBefore))) {
      return false;
    }

    if (filters.minScore !== null && (app.job.score ?? 0) < filters.minScore) {
      return false;
    }

    if (filters.search) {
      const needle = filters.search.toLowerCase();
      const haystack = `${app.job.title} ${app.job.company}`.toLowerCase();
      if (!haystack.includes(needle)) return false;
    }

    return true;
  });
}

export type ApplicationSort = "newest" | "oldest" | "highest-score" | "company";

export function sortApplications(apps: ApplicationWithJob[], sort: ApplicationSort): ApplicationWithJob[] {
  const sorted = [...apps];

  switch (sort) {
    case "newest":
      return sorted.sort((a, b) => (b.appliedAt?.getTime() ?? 0) - (a.appliedAt?.getTime() ?? 0));
    case "oldest":
      return sorted.sort((a, b) => (a.appliedAt?.getTime() ?? 0) - (b.appliedAt?.getTime() ?? 0));
    case "highest-score":
      return sorted.sort((a, b) => (b.job.score ?? 0) - (a.job.score ?? 0));
    case "company":
      return sorted.sort((a, b) => a.job.company.localeCompare(b.job.company));
  }
}
