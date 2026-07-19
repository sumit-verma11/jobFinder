"use client";

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

  async function handleChange(event: React.ChangeEvent<HTMLSelectElement>) {
    await fetch(`/api/applications/${applicationId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: event.target.value }),
    });
    router.refresh();
  }

  return (
    <select
      defaultValue={currentStatus}
      onChange={handleChange}
      className="rounded-md border border-slate-200 px-2 py-1 text-sm text-slate-700"
    >
      {statuses.map((status) => (
        <option key={status} value={status}>
          {formatStatusLabel(status)}
        </option>
      ))}
    </select>
  );
}
