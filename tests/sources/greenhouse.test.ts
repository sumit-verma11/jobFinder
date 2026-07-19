import { describe, expect, it, vi, afterEach } from "vitest";
import { collectFromGreenhouse } from "../../src/lib/sources/greenhouse";

describe("collectFromGreenhouse", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("maps a Greenhouse board response into ExtractedJob[]", async () => {
    const fakeResponse = {
      jobs: [
        {
          title: "Senior Full Stack Engineer",
          absolute_url: "https://job-boards.greenhouse.io/acme/jobs/12345",
          location: { name: "Bengaluru, India" },
          updated_at: "2026-07-18T10:00:00.000Z",
        },
        {
          title: "Support Engineer",
          absolute_url: "https://job-boards.greenhouse.io/acme/jobs/12346",
          location: null,
          updated_at: null,
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

    const result = await collectFromGreenhouse("Acme Corp", "acme");

    expect(result).toEqual([
      {
        title: "Senior Full Stack Engineer",
        url: "https://job-boards.greenhouse.io/acme/jobs/12345",
        company: "Acme Corp",
        location: "Bengaluru, India",
        salaryText: null,
        postedAt: "2026-07-18T10:00:00.000Z",
      },
      {
        title: "Support Engineer",
        url: "https://job-boards.greenhouse.io/acme/jobs/12346",
        company: "Acme Corp",
        location: null,
        salaryText: null,
        postedAt: null,
      },
    ]);
  });
});
