import { describe, expect, it, vi, afterEach } from "vitest";
import { collectFromWorkable } from "../../src/lib/sources/workable";

describe("collectFromWorkable", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("maps a Workable widget response into ExtractedJob[]", async () => {
    const fakeResponse = {
      name: "Acme",
      jobs: [
        {
          title: "DevOps Engineer",
          shortcode: "ABC123",
          city: "Pune",
          country: "India",
          published_on: "2026-07-16",
        },
        {
          title: "Technical Writer",
          shortcode: "DEF456",
          city: null,
          country: null,
          published_on: null,
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

    const result = await collectFromWorkable("Acme Corp", "acme");

    expect(result).toEqual([
      {
        title: "DevOps Engineer",
        url: "https://apply.workable.com/acme/j/ABC123/",
        company: "Acme Corp",
        location: "Pune, India",
        salaryText: null,
        postedAt: "2026-07-16",
      },
      {
        title: "Technical Writer",
        url: "https://apply.workable.com/acme/j/DEF456/",
        company: "Acme Corp",
        location: null,
        salaryText: null,
        postedAt: null,
      },
    ]);
  });
});
