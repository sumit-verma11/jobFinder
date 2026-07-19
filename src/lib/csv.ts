import type { ApplicationWithJob } from "./applicationFilters";

const HEADERS = [
  "Job Title",
  "Company",
  "Source",
  "Applied Date",
  "Status",
  "Match Score",
  "Job URL",
];

function escapeCsvField(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function applicationsToCsv(apps: ApplicationWithJob[]): string {
  const rows = apps.map((app) =>
    [
      app.job.title,
      app.job.company,
      app.job.source,
      app.appliedAt ? app.appliedAt.toISOString().slice(0, 10) : "",
      app.status,
      app.job.score !== null ? String(app.job.score) : "",
      app.job.url,
    ]
      .map(escapeCsvField)
      .join(",")
  );

  return [HEADERS.join(","), ...rows].join("\n");
}
