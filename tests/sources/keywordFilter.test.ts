import { describe, expect, it } from "vitest";
import { matchesKeywords } from "../../src/lib/sources/keywordFilter";

describe("matchesKeywords", () => {
  it("matches when the title contains a keyword, case-insensitively", () => {
    expect(matchesKeywords("Senior Full Stack Developer", ["full stack developer"])).toBe(true);
    expect(matchesKeywords("full stack developer", ["FULL STACK DEVELOPER"])).toBe(true);
  });

  it("matches if ANY of several keywords is present", () => {
    const keywords = ["Backend Developer", "Frontend Developer", "MERN Stack"];
    expect(matchesKeywords("Senior MERN Stack Engineer", keywords)).toBe(true);
  });

  it("does not match when no keyword appears in the title", () => {
    expect(matchesKeywords("Senior Counsel", ["Full Stack Developer", "Backend Developer"])).toBe(false);
  });

  it("returns false for every title when the keyword list is empty", () => {
    // This is the exact invariant that was missing once: an empty keyword list must
    // suppress everything, not pass everything through unfiltered.
    expect(matchesKeywords("Full Stack Developer", [])).toBe(false);
    expect(matchesKeywords("", [])).toBe(false);
  });

  it("does not match on an empty title even with real keywords", () => {
    expect(matchesKeywords("", ["Full Stack Developer"])).toBe(false);
  });
});
