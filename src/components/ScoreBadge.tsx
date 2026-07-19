export function ScoreBadge({ score }: { score: number | null }) {
  if (score === null) {
    return <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">Unscored</span>;
  }

  const tone =
    score >= 7
      ? "bg-emerald-100 text-emerald-800"
      : score >= 4
        ? "bg-amber-100 text-amber-800"
        : "bg-slate-100 text-slate-600";

  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${tone}`}>{score}/10</span>;
}
