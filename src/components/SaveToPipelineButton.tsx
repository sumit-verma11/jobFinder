"use client";

import { useRouter } from "next/navigation";

export function SaveToPipelineButton({ jobId }: { jobId: string }) {
  const router = useRouter();

  async function handleClick() {
    await fetch("/api/applications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jobId }),
    });
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className="w-fit rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
    >
      Save to pipeline
    </button>
  );
}
