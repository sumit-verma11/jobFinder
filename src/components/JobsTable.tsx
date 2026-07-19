"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Application, Job } from "@prisma/client";
import { ScoreBadge } from "./ScoreBadge";
import { SourceBadge } from "./SourceBadge";

type JobWithApplication = Job & { application: Application | null };

export function JobsTable({ jobs }: { jobs: JobWithApplication[] }) {
  const router = useRouter();
  const [minScore, setMinScore] = useState("");
  const [source, setSource] = useState("");
  const [saveErrors, setSaveErrors] = useState<Record<string, string>>({});

  const sources = useMemo(() => Array.from(new Set(jobs.map((job) => job.source))), [jobs]);

  const filtered = jobs.filter((job) => {
    if (minScore && (job.score ?? 0) < Number(minScore)) return false;
    if (source && job.source !== source) return false;
    return true;
  });

  async function handleSave(event: React.MouseEvent, jobId: string) {
    event.stopPropagation();
    try {
      const response = await fetch("/api/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId }),
      });
      if (!response.ok) {
        throw new Error("Failed to save to pipeline");
      }
      setSaveErrors((prev) => {
        const next = { ...prev };
        delete next[jobId];
        return next;
      });
      router.refresh();
    } catch {
      setSaveErrors((prev) => ({ ...prev, [jobId]: "Failed to save to pipeline" }));
    }
  }

  return (
    <div>
      <div className="mb-4 flex gap-3">
        <input
          type="number"
          placeholder="Min score"
          value={minScore}
          onChange={(event) => setMinScore(event.target.value)}
          className="w-32 rounded-md border border-slate-200 p-2 text-sm"
        />
        <select
          value={source}
          onChange={(event) => setSource(event.target.value)}
          className="rounded-md border border-slate-200 p-2 text-sm"
        >
          <option value="">All sources</option>
          {sources.map((src) => (
            <option key={src} value={src}>
              {src}
            </option>
          ))}
        </select>
      </div>

      {jobs.length === 0 ? (
        <p className="text-sm text-slate-500">
          No jobs collected yet — run <code>npm run collect</code>.
        </p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-slate-500">No jobs match the current filters.</p>
      ) : (
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-left text-xs uppercase text-slate-500">
            <th className="py-2">Title</th>
            <th className="py-2">Company</th>
            <th className="py-2">Score</th>
            <th className="py-2">Source</th>
            <th className="py-2">Collected</th>
            <th className="py-2">Action</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((job) => (
            <tr
              key={job.id}
              onClick={() => router.push(`/jobs/${job.id}`)}
              className="cursor-pointer border-b border-slate-100 hover:bg-emerald-50/50"
            >
              <td className="py-2 font-medium text-slate-900">{job.title}</td>
              <td className="py-2 text-slate-600">{job.company}</td>
              <td className="py-2">
                <ScoreBadge score={job.score} />
              </td>
              <td className="py-2">
                <SourceBadge source={job.source} />
              </td>
              <td className="py-2 text-slate-500">{new Date(job.collectedAt).toLocaleDateString()}</td>
              <td className="py-2">
                {job.application ? (
                  <span className="text-xs text-emerald-700">Saved</span>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={(event) => handleSave(event, job.id)}
                      className="rounded-md bg-emerald-600 px-2 py-1 text-xs font-medium text-white hover:bg-emerald-700"
                    >
                      Save to pipeline
                    </button>
                    {saveErrors[job.id] && (
                      <p className="mt-1 text-xs text-red-600">{saveErrors[job.id]}</p>
                    )}
                  </>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      )}
    </div>
  );
}
