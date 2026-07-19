"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function SaveToPipelineButton({ jobId }: { jobId: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    try {
      const response = await fetch("/api/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId }),
      });
      if (!response.ok) {
        throw new Error("Failed to save to pipeline");
      }
      setError(null);
      router.refresh();
    } catch {
      setError("Failed to save to pipeline");
    }
  }

  return (
    <div className="flex w-fit flex-col gap-1">
      <button
        type="button"
        onClick={handleClick}
        className="w-fit rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
      >
        Save to pipeline
      </button>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
