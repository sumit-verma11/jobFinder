const SENSITIVE_PATTERNS = [/\bCTC\b/i, /\bLPA\b/i, /notice period/i, /current salary/i, /expected salary/i];

export function sanitizeCoverNote(raw: string): string {
  return raw
    .trim()
    .replace(/^```(?:\w+)?\s*/i, "")
    .replace(/```\s*$/i, "")
    .replace(/^["']|["']$/g, "")
    .trim();
}

export function containsSensitiveInfo(text: string): boolean {
  return SENSITIVE_PATTERNS.some((pattern) => pattern.test(text));
}
