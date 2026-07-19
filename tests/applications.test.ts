import { describe, expect, it } from "vitest";
import { filterApplications, sortApplications, type ApplicationFilters, type ApplicationWithJob } from "../src/lib/applicationFilters";
import { applicationsToCsv } from "../src/lib/csv";

function makeApp(overrides: Partial<ApplicationWithJob>): ApplicationWithJob {
  return {
    id: "app-1",
    jobId: "job-1",
    status: "APPLIED",
    appliedAt: new Date("2026-07-15T10:00:00Z"),
    notes: null,
    followUpAt: null,
    archived: false,
    updatedAt: new Date("2026-07-15T10:00:00Z"),
    job: {
      id: "job-1",
      url: "https://example.com/job-1",
      title: "React Developer",
      company: "Acme",
      location: "Remote",
      salaryText: "10 LPA",
      description: null,
      source: "LinkedIn",
      postedAt: null,
      collectedAt: new Date("2026-07-14T10:00:00Z"),
      score: 8,
      scoreReason: "Good fit",
      coverNote: null,
      coldMessage: null,
      notifiedAt: null,
    },
    ...overrides,
  } as ApplicationWithJob;
}

const emptyFilters: ApplicationFilters = {
  company: "",
  source: "",
  status: "",
  appliedAfter: "",
  appliedBefore: "",
  minScore: null,
  search: "",
};

describe("filterApplications", () => {
  it("returns all rows when no filters are set", () => {
    const apps = [makeApp({ id: "1" }), makeApp({ id: "2" })];
    expect(filterApplications(apps, emptyFilters, false)).toHaveLength(2);
  });

  it("excludes archived rows by default", () => {
    const apps = [makeApp({ id: "1", archived: true }), makeApp({ id: "2" })];
    expect(filterApplications(apps, emptyFilters, false)).toEqual([apps[1]]);
  });

  it("includes archived rows when includeArchived is true", () => {
    const apps = [makeApp({ id: "1", archived: true }), makeApp({ id: "2" })];
    expect(filterApplications(apps, emptyFilters, true)).toHaveLength(2);
  });

  it("filters by company (case-insensitive substring)", () => {
    const apps = [makeApp({ id: "1", job: { ...makeApp({}).job, company: "Acme Corp" } }), makeApp({ id: "2", job: { ...makeApp({}).job, company: "Other Inc" } })];
    expect(filterApplications(apps, { ...emptyFilters, company: "acme" }, false)).toEqual([apps[0]]);
  });

  it("filters by status", () => {
    const apps = [makeApp({ id: "1", status: "APPLIED" }), makeApp({ id: "2", status: "OFFER" })];
    expect(filterApplications(apps, { ...emptyFilters, status: "OFFER" }, false)).toEqual([apps[1]]);
  });

  it("filters by minimum score", () => {
    const apps = [
      makeApp({ id: "1", job: { ...makeApp({}).job, score: 5 } }),
      makeApp({ id: "2", job: { ...makeApp({}).job, score: 9 } }),
    ];
    expect(filterApplications(apps, { ...emptyFilters, minScore: 7 }, false)).toEqual([apps[1]]);
  });

  it("searches title and company", () => {
    const apps = [
      makeApp({ id: "1", job: { ...makeApp({}).job, title: "Backend Engineer", company: "Acme" } }),
      makeApp({ id: "2", job: { ...makeApp({}).job, title: "React Developer", company: "Other" } }),
    ];
    expect(filterApplications(apps, { ...emptyFilters, search: "react" }, false)).toEqual([apps[1]]);
    expect(filterApplications(apps, { ...emptyFilters, search: "acme" }, false)).toEqual([apps[0]]);
  });
});

describe("sortApplications", () => {
  const older = makeApp({ id: "1", appliedAt: new Date("2026-07-10T00:00:00Z"), job: { ...makeApp({}).job, score: 5, company: "Zeta" } });
  const newer = makeApp({ id: "2", appliedAt: new Date("2026-07-18T00:00:00Z"), job: { ...makeApp({}).job, score: 9, company: "Alpha" } });

  it("sorts newest first", () => {
    expect(sortApplications([older, newer], "newest")).toEqual([newer, older]);
  });

  it("sorts oldest first", () => {
    expect(sortApplications([newer, older], "oldest")).toEqual([older, newer]);
  });

  it("sorts by highest score", () => {
    expect(sortApplications([older, newer], "highest-score")).toEqual([newer, older]);
  });

  it("sorts by company name", () => {
    expect(sortApplications([older, newer], "company")).toEqual([newer, older]);
  });
});

describe("applicationsToCsv", () => {
  it("produces a header row plus one row per application", () => {
    const apps = [makeApp({ id: "1" })];
    const csv = applicationsToCsv(apps);
    const lines = csv.trim().split("\n");
    expect(lines).toHaveLength(2);
    expect(lines[0]).toContain("Job Title");
    expect(lines[1]).toContain("React Developer");
    expect(lines[1]).toContain("Acme");
  });

  it("quotes fields containing commas", () => {
    const apps = [makeApp({ id: "1", job: { ...makeApp({}).job, company: "Acme, Inc." } })];
    const csv = applicationsToCsv(apps);
    expect(csv).toContain('"Acme, Inc."');
  });
});
