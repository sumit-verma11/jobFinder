import { describe, expect, it, vi, afterEach } from "vitest";
import { collectFromAshby } from "../../src/lib/sources/ashby";

describe("collectFromAshby", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("maps an Ashby job-board response into ExtractedJob[]", async () => {
    const fakeResponse = {
      jobs: [
        {
          title: "Founding Engineer",
          jobUrl: "https://jobs.ashbyhq.com/acme/abc-123",
          locationName: "Remote",
          publishedDate: "2026-07-17T00:00:00.000Z",
        },
        {
          title: "Backend Engineer",
          applyUrl: "https://jobs.ashbyhq.com/acme/def-456",
          locationName: null,
          publishedDate: null,
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

    const result = await collectFromAshby("Acme Corp", "acme");

    expect(result).toEqual([
      {
        title: "Founding Engineer",
        url: "https://jobs.ashbyhq.com/acme/abc-123",
        company: "Acme Corp",
        location: "Remote",
        salaryText: null,
        postedAt: "2026-07-17T00:00:00.000Z",
      },
      {
        title: "Backend Engineer",
        url: "https://jobs.ashbyhq.com/acme/def-456",
        company: "Acme Corp",
        location: null,
        salaryText: null,
        postedAt: null,
      },
    ]);
  });
});
