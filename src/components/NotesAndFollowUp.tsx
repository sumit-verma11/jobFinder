"use client";

import { useRouter } from "next/navigation";
import type { Application } from "@prisma/client";

export function NotesAndFollowUp({ application }: { application: Application }) {
  const router = useRouter();

  async function handleNotesBlur(event: React.FocusEvent<HTMLTextAreaElement>) {
    await fetch(`/api/applications/${application.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notes: event.target.value }),
    });
    router.refresh();
  }

  async function handleFollowUpChange(event: React.ChangeEvent<HTMLInputElement>) {
    await fetch(`/api/applications/${application.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ followUpAt: event.target.value || null }),
    });
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium text-slate-700">Notes</span>
        <textarea
          defaultValue={application.notes ?? ""}
          onBlur={handleNotesBlur}
          rows={4}
          className="rounded-md border border-slate-200 p-2 text-sm"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium text-slate-700">Follow-up date</span>
        <input
          type="date"
          defaultValue={application.followUpAt ? application.followUpAt.toISOString().slice(0, 10) : ""}
          onChange={handleFollowUpChange}
          className="w-fit rounded-md border border-slate-200 p-2 text-sm"
        />
      </label>
    </div>
  );
}
