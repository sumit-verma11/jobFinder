import { describe, expect, it } from "vitest";
import { parseScoreResponse } from "../src/lib/matching/parseScore";
import { shouldGenerateCoverNote } from "../src/lib/matching/threshold";
import { sanitizeCoverNote, containsSensitiveInfo } from "../src/lib/matching/sanitizeCoverNote";

describe("parseScoreResponse", () => {
  it("parses a valid plain JSON response", () => {
    const result = parseScoreResponse('{"score": 8, "reason": "Strong React/Node overlap"}');
    expect(result).toEqual({ score: 8, reason: "Strong React/Node overlap" });
  });

  it("parses a response wrapped in ```json fences", () => {
    const result = parseScoreResponse('```json\n{"score": 6, "reason": "Decent fit"}\n```');
    expect(result).toEqual({ score: 6, reason: "Decent fit" });
  });

  it("parses a response wrapped in fences without the json language tag", () => {
    const result = parseScoreResponse('```\n{"score": 3, "reason": "Senior role, poor fit"}\n```');
    expect(result).toEqual({ score: 3, reason: "Senior role, poor fit" });
  });

  it("returns null for malformed JSON", () => {
    expect(parseScoreResponse("this is not json at all")).toBeNull();
  });

  it("returns null for a JSON array instead of an object", () => {
    expect(parseScoreResponse('[{"score": 8, "reason": "x"}]')).toBeNull();
  });

  it("returns null when score is out of range (too high)", () => {
    expect(parseScoreResponse('{"score": 15, "reason": "too high"}')).toBeNull();
  });

  it("returns null when score is zero or negative", () => {
    expect(parseScoreResponse('{"score": 0, "reason": "x"}')).toBeNull();
    expect(parseScoreResponse('{"score": -1, "reason": "x"}')).toBeNull();
  });

  it("returns null when score is not an integer", () => {
    expect(parseScoreResponse('{"score": 7.5, "reason": "x"}')).toBeNull();
  });

  it("returns null when reason is missing", () => {
    expect(parseScoreResponse('{"score": 8}')).toBeNull();
  });

  it("returns null when reason is an empty string", () => {
    expect(parseScoreResponse('{"score": 8, "reason": "  "}')).toBeNull();
  });
});

describe("shouldGenerateCoverNote", () => {
  it("returns true when score is above threshold", () => {
    expect(shouldGenerateCoverNote(9, 7)).toBe(true);
  });

  it("returns true when score equals threshold", () => {
    expect(shouldGenerateCoverNote(7, 7)).toBe(true);
  });

  it("returns false when score is below threshold", () => {
    expect(shouldGenerateCoverNote(6, 7)).toBe(false);
  });

  it("returns false for the lowest possible score against the default threshold", () => {
    expect(shouldGenerateCoverNote(1, 7)).toBe(false);
  });
});

describe("sanitizeCoverNote", () => {
  it("returns plain text unchanged aside from trimming", () => {
    expect(sanitizeCoverNote("  Hi, saw the opening...  ")).toBe("Hi, saw the opening...");
  });

  it("strips markdown code fences", () => {
    expect(sanitizeCoverNote("```\nHi, saw the opening...\n```")).toBe("Hi, saw the opening...");
  });

  it("strips surrounding quotes", () => {
    expect(sanitizeCoverNote('"Hi, saw the opening..."')).toBe("Hi, saw the opening...");
  });
});

describe("containsSensitiveInfo", () => {
  it("returns false for a clean cover note", () => {
    expect(containsSensitiveInfo("Hi, saw the opening for React Developer and wanted to reach out.")).toBe(false);
  });

  it("detects CTC mentions", () => {
    expect(containsSensitiveInfo("My current CTC is 7.5 LPA.")).toBe(true);
  });

  it("detects LPA mentions on their own", () => {
    expect(containsSensitiveInfo("Looking for roughly 12 LPA.")).toBe(true);
  });

  it("detects notice period mentions", () => {
    expect(containsSensitiveInfo("I have a 30 day notice period.")).toBe(true);
  });

  it("is case-insensitive", () => {
    expect(containsSensitiveInfo("my ctc is negotiable")).toBe(true);
  });
});
