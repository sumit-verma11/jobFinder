"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Application, Job } from "@prisma/client";
import { ScoreBadge } from "./ScoreBadge";
import { SourceBadge } from "./SourceBadge";

export function SavedJobCard({ application }: { application: Application & { job: Job } }) {
  const router = useRouter();
  const { job } = application;
  const [error, setError] = useState<string | null>(null);

  async function handleMarkApplied(event: React.MouseEvent) {
    event.stopPropagation();
    try {
      const response = await fetch(`/api/applications/${application.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "APPLIED" }),
      });
      if (!response.ok) {
        throw new Error("Failed to mark as applied");
      }
      setError(null);
      router.refresh();
    } catch {
      setError("Failed to mark as applied");
    }
  }

  return (
    <div
      onClick={() => router.push(`/jobs/${job.id}`)}
      className="flex cursor-pointer flex-col gap-2 rounded-lg border border-slate-200 bg-white p-4 hover:border-emerald-300"
    >
      <div className="flex items-center gap-2">
        <ScoreBadge score={job.score} />
        <SourceBadge source={job.source} />
      </div>
      <div className="font-medium text-slate-900">{job.title}</div>
      <div className="text-sm text-slate-600">{job.company}</div>
      <div className="text-xs text-slate-500">
        {job.location ?? "Location not specified"} · {job.salaryText ?? "Salary not specified"}
      </div>
      <button
        type="button"
        onClick={handleMarkApplied}
        className="mt-2 w-fit rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700"
      >
        Mark as Applied
      </button>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
