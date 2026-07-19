"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { AppStatus } from "@prisma/client";
import { formatStatusLabel } from "@/lib/appStatus";

export function StatusDropdown({
  applicationId,
  currentStatus,
  statuses,
}: {
  applicationId: string;
  currentStatus: AppStatus;
  statuses: AppStatus[];
}) {
  const router = useRouter();
  const [status, setStatus] = useState(currentStatus);
  const [error, setError] = useState<string | null>(null);

  async function handleChange(event: React.ChangeEvent<HTMLSelectElement>) {
    const nextStatus = event.target.value as AppStatus;
    try {
      const response = await fetch(`/api/applications/${applicationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (!response.ok) {
        throw new Error("Failed to update status");
      }
      setStatus(nextStatus);
      setError(null);
      router.refresh();
    } catch {
      setError("Failed to update status");
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <select
        value={status}
        onChange={handleChange}
        className="rounded-md border border-slate-200 px-2 py-1 text-sm text-slate-700"
      >
        {statuses.map((s) => (
          <option key={s} value={s}>
            {formatStatusLabel(s)}
          </option>
        ))}
      </select>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}
