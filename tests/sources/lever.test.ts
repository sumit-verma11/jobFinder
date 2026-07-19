import { describe, expect, it, vi, afterEach } from "vitest";
import { collectFromLever } from "../../src/lib/sources/lever";

describe("collectFromLever", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("maps a Lever postings response into ExtractedJob[]", async () => {
    const fakeResponse = [
      {
        text: "Product Engineer",
        hostedUrl: "https://jobs.lever.co/acme/abc-123",
        categories: { location: "Remote - India" },
        createdAt: 1752825600000,
      },
      {
        text: "QA Engineer",
        hostedUrl: "https://jobs.lever.co/acme/def-456",
        categories: {},
        createdAt: null,
      },
    ];

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(fakeResponse),
      })
    );

    const result = await collectFromLever("Acme Corp", "acme");

    expect(result).toEqual([
      {
        title: "Product Engineer",
        url: "https://jobs.lever.co/acme/abc-123",
        company: "Acme Corp",
        location: "Remote - India",
        salaryText: null,
        postedAt: new Date(1752825600000).toISOString(),
      },
      {
        title: "QA Engineer",
        url: "https://jobs.lever.co/acme/def-456",
        company: "Acme Corp",
        location: null,
        salaryText: null,
        postedAt: null,
      },
    ]);
  });
});
