export function shouldGenerateCoverNote(score: number, threshold: number): boolean {
  return score >= threshold;
}
