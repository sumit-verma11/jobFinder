export function matchesKeywords(title: string, keywords: string[]): boolean {
  const haystack = title.toLowerCase();
  return keywords.some((keyword) => haystack.includes(keyword.toLowerCase()));
}
