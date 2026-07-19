export function sanitizeCoverNote(raw: string): string {
  return raw
    .trim()
    .replace(/^```(?:\w+)?\s*/i, "")
    .replace(/```\s*$/i, "")
    .replace(/^["']|["']$/g, "")
    .trim();
}
