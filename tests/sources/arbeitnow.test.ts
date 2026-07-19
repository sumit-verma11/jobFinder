import { describe, expect, it, vi, afterEach } from "vitest";
import { collectFromArbeitnow } from "../../src/lib/sources/arbeitnow";

describe("collectFromArbeitnow", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("filters by keyword and maps matching jobs into ExtractedJob[]", async () => {
    const fakeResponse = {
      data: [
        {
          title: "Full Stack Developer (React/Node)",
          company_name: "Acme Corp",
          url: "https://www.arbeitnow.com/jobs/acme/full-stack-developer-1",
          location: "Remote",
          created_at: 1752825600,
        },
        {
          title: "Marketing Manager",
          company_name: "Other Inc",
          url: "https://www.arbeitnow.com/jobs/other/marketing-manager-2",
          location: "Berlin",
          created_at: 1752739200,
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

    const result = await collectFromArbeitnow(["Full Stack Developer"]);

    expect(result).toEqual([
      {
        title: "Full Stack Developer (React/Node)",
        url: "https://www.arbeitnow.com/jobs/acme/full-stack-developer-1",
        company: "Acme Corp",
        location: "Remote",
        salaryText: null,
        postedAt: new Date(1752825600 * 1000).toISOString(),
      },
    ]);
  });
});
