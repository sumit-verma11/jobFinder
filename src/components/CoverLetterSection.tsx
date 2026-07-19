"use client";

import { useState } from "react";
import type { Job } from "@prisma/client";
import { CopyButton } from "./CopyButton";

export function CoverLetterSection({ job }: { job: Job }) {
  const [coverNote, setCoverNote] = useState(job.coverNote);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGenerate() {
    setLoading(true);
    setError(null);
    const response = await fetch(`/api/jobs/${job.id}/cover-letter`, { method: "POST" });
    const data = (await response.json()) as { coverNote?: string; error?: string };
    if (data.coverNote) {
      setCoverNote(data.coverNote);
    } else {
      setError(data.error ?? "Failed to generate cover letter");
    }
    setLoading(false);
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-900">Cover Letter</h2>
        {coverNote && <CopyButton text={coverNote} label="Copy cover letter" />}
      </div>
      {coverNote ? (
        <p className="whitespace-pre-wrap rounded-md border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
          {coverNote}
        </p>
      ) : (
        <button
          type="button"
          onClick={handleGenerate}
          disabled={loading}
          className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          {loading ? "Generating..." : "Generate cover letter"}
        </button>
      )}
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </div>
  );
}
