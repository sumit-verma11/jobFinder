import { describe, expect, it, vi, afterEach, beforeEach } from "vitest";
import { collectFromAdzuna } from "../../src/lib/sources/adzuna";

describe("collectFromAdzuna", () => {
  beforeEach(() => {
    process.env.ADZUNA_APP_ID = "test-id";
    process.env.ADZUNA_APP_KEY = "test-key";
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.ADZUNA_APP_ID;
    delete process.env.ADZUNA_APP_KEY;
  });

  it("maps an Adzuna search response into ExtractedJob[]", async () => {
    const fakeResponse = {
      results: [
        {
          title: "Full Stack Developer",
          company: { display_name: "Acme Corp" },
          location: { display_name: "Noida, India" },
          redirect_url: "https://www.adzuna.in/land/ad/12345",
          created: "2026-07-19T08:00:00Z",
          salary_min: 800000,
          salary_max: 1200000,
        },
        {
          title: "Frontend Developer",
          company: null,
          location: null,
          redirect_url: "https://www.adzuna.in/land/ad/67890",
          created: null,
          salary_min: null,
          salary_max: null,
        },
      ],
    };

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(fakeResponse),
      })
    );

    const result = await collectFromAdzuna(["Full Stack Developer"]);

    expect(result).toEqual([
      {
        title: "Full Stack Developer",
        url: "https://www.adzuna.in/land/ad/12345",
        company: "Acme Corp",
        location: "Noida, India",
        salaryText: "₹800000 - ₹1200000",
        postedAt: "2026-07-19T08:00:00Z",
      },
      {
        title: "Frontend Developer",
        url: "https://www.adzuna.in/land/ad/67890",
        company: "Unknown",
        location: null,
        salaryText: null,
        postedAt: null,
      },
    ]);
  });

  it("throws if ADZUNA_APP_ID or ADZUNA_APP_KEY is missing", async () => {
    delete process.env.ADZUNA_APP_ID;
    await expect(collectFromAdzuna(["Full Stack Developer"])).rejects.toThrow(
      "ADZUNA_APP_ID / ADZUNA_APP_KEY not set"
    );
  });
});
