export interface ScoreResult {
  score: number;
  reason: string;
}

export function parseScoreResponse(raw: string): ScoreResult | null {
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch (err) {
    console.warn(`[match] failed to parse score response as JSON: ${(err as Error).message}`);
    return null;
  }

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    console.warn("[match] score response was not a JSON object, skipping");
    return null;
  }

  const obj = parsed as Record<string, unknown>;
  const score = obj.score;
  const reason = obj.reason;

  if (typeof score !== "number" || !Number.isInteger(score) || score < 1 || score > 10) {
    console.warn(`[match] score response had invalid score value: ${JSON.stringify(score)}`);
    return null;
  }

  if (typeof reason !== "string" || reason.trim().length === 0) {
    console.warn("[match] score response had invalid reason value");
    return null;
  }

  return { score, reason: reason.trim() };
}
