"use client";

import { useEffect, useState } from "react";
import type { Job } from "@prisma/client";
import { CopyButton } from "./CopyButton";

export function ColdMessageSection({ job }: { job: Job }) {
  const [coldMessage, setColdMessage] = useState(job.coldMessage);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (coldMessage) return;

    let cancelled = false;
    setLoading(true);

    fetch(`/api/jobs/${job.id}/cold-message`, { method: "POST" })
      .then((response) => response.json())
      .then((data: { coldMessage?: string; error?: string }) => {
        if (cancelled) return;
        if (data.coldMessage) {
          setColdMessage(data.coldMessage);
        } else {
          setError(data.error ?? "Failed to generate cold message");
        }
      })
      .catch(() => {
        if (!cancelled) setError("Failed to generate cold message");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job.id]);

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-900">Cold Message</h2>
        {coldMessage && <CopyButton text={coldMessage} label="Copy cold message" />}
      </div>
      {loading && <p className="text-xs text-slate-500">Generating...</p>}
      {coldMessage && (
        <p className="whitespace-pre-wrap rounded-md border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
          {coldMessage}
        </p>
      )}
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </div>
  );
}
