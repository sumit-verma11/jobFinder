"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ScoreBadge } from "./ScoreBadge";
import { SourceBadge } from "./SourceBadge";
import { StatusDropdown } from "./StatusDropdown";
import { CopyButton } from "./CopyButton";
import { ConfirmDialog } from "./ConfirmDialog";
import { APPLICATION_STATUSES, formatStatusLabel } from "@/lib/appStatus";
import {
  filterApplications,
  sortApplications,
  type ApplicationFilters,
  type ApplicationSort,
  type ApplicationWithJob,
} from "@/lib/applicationFilters";
import { applicationsToCsv } from "@/lib/csv";

const EMPTY_FILTERS: ApplicationFilters = {
  company: "",
  source: "",
  status: "",
  appliedAfter: "",
  appliedBefore: "",
  minScore: null,
  search: "",
};

export function ApplicationsTable({ applications }: { applications: ApplicationWithJob[] }) {
  const router = useRouter();
  const [filters, setFilters] = useState<ApplicationFilters>(EMPTY_FILTERS);
  const [includeArchived, setIncludeArchived] = useState(false);
  const [sort, setSort] = useState<ApplicationSort>("newest");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmDelete, setConfirmDelete] = useState(false);

  const sources = useMemo(() => Array.from(new Set(applications.map((app) => app.job.source))), [applications]);

  const visible = useMemo(
    () => sortApplications(filterApplications(applications, filters, includeArchived), sort),
    [applications, filters, includeArchived, sort]
  );

  function toggleSelected(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    setSelected((prev) => (prev.size === visible.length ? new Set() : new Set(visible.map((app) => app.id))));
  }

  async function runBulkAction(action: "delete" | "archive" | "status", status?: string) {
    await fetch("/api/applications/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: Array.from(selected), action, status }),
    });
    setSelected(new Set());
    router.refresh();
  }

  function handleExport() {
    const csv = applicationsToCsv(visible.filter((app) => selected.has(app.id)));
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "applications.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-3">
        <input
          type="text"
          placeholder="Search title or company"
          value={filters.search}
          onChange={(event) => setFilters((prev) => ({ ...prev, search: event.target.value }))}
          className="rounded-md border border-slate-200 p-2 text-sm"
        />
        <input
          type="text"
          placeholder="Company"
          value={filters.company}
          onChange={(event) => setFilters((prev) => ({ ...prev, company: event.target.value }))}
          className="rounded-md border border-slate-200 p-2 text-sm"
        />
        <select
          value={filters.source}
          onChange={(event) => setFilters((prev) => ({ ...prev, source: event.target.value }))}
          className="rounded-md border border-slate-200 p-2 text-sm"
        >
          <option value="">All sources</option>
          {sources.map((src) => (
            <option key={src} value={src}>
              {src}
            </option>
          ))}
        </select>
        <select
          value={filters.status}
          onChange={(event) => setFilters((prev) => ({ ...prev, status: event.target.value as ApplicationFilters["status"] }))}
          className="rounded-md border border-slate-200 p-2 text-sm"
        >
          <option value="">All statuses</option>
          {APPLICATION_STATUSES.map((status) => (
            <option key={status} value={status}>
              {formatStatusLabel(status)}
            </option>
          ))}
        </select>
        <input
          type="number"
          placeholder="Min score"
          value={filters.minScore ?? ""}
          onChange={(event) =>
            setFilters((prev) => ({ ...prev, minScore: event.target.value ? Number(event.target.value) : null }))
          }
          className="w-28 rounded-md border border-slate-200 p-2 text-sm"
        />
        <select
          value={sort}
          onChange={(event) => setSort(event.target.value as ApplicationSort)}
          className="rounded-md border border-slate-200 p-2 text-sm"
        >
          <option value="newest">Newest First</option>
          <option value="oldest">Oldest First</option>
          <option value="highest-score">Highest Match Score</option>
          <option value="company">Company Name</option>
        </select>
        <label className="flex items-center gap-1 text-sm text-slate-600">
          <input
            type="checkbox"
            checked={includeArchived}
            onChange={(event) => setIncludeArchived(event.target.checked)}
          />
          Include archived
        </label>
      </div>

      {selected.size > 0 && (
        <div className="mb-4 flex items-center gap-3 rounded-md bg-emerald-50 p-3">
          <span className="text-sm text-emerald-800">{selected.size} selected</span>
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            className="rounded-md bg-red-600 px-3 py-1 text-xs font-medium text-white hover:bg-red-700"
          >
            Delete Selected
          </button>
          <button
            type="button"
            onClick={() => runBulkAction("archive")}
            className="rounded-md border border-slate-300 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
          >
            Archive Selected
          </button>
          <select
            onChange={(event) => event.target.value && runBulkAction("status", event.target.value)}
            defaultValue=""
            className="rounded-md border border-slate-300 px-2 py-1 text-xs"
          >
            <option value="" disabled>
              Mark Status
            </option>
            {APPLICATION_STATUSES.map((status) => (
              <option key={status} value={status}>
                {formatStatusLabel(status)}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={handleExport}
            className="rounded-md border border-slate-300 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
          >
            Export Selected (CSV)
          </button>
        </div>
      )}

      {applications.length === 0 ? (
        <p className="text-sm text-slate-500">No applications yet — mark a saved job as Applied from the board.</p>
      ) : visible.length === 0 ? (
        <p className="text-sm text-slate-500">No applications match the current filters.</p>
      ) : (
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-left text-xs uppercase text-slate-500">
            <th className="py-2">
              <input type="checkbox" checked={selected.size === visible.length && visible.length > 0} onChange={toggleSelectAll} />
            </th>
            <th className="py-2">Job Title</th>
            <th className="py-2">Company</th>
            <th className="py-2">Source</th>
            <th className="py-2">Applied</th>
            <th className="py-2">Status</th>
            <th className="py-2">Score</th>
            <th className="py-2">Cover Letter</th>
            <th className="py-2">Cold Message</th>
          </tr>
        </thead>
        <tbody>
          {visible.map((app) => (
            <tr key={app.id} className="border-b border-slate-100 hover:bg-emerald-50/50">
              <td className="py-2" onClick={(event) => event.stopPropagation()}>
                <input type="checkbox" checked={selected.has(app.id)} onChange={() => toggleSelected(app.id)} />
              </td>
              <td className="cursor-pointer py-2 font-medium text-slate-900" onClick={() => router.push(`/jobs/${app.job.id}`)}>
                {app.job.title}
              </td>
              <td className="py-2 text-slate-600">{app.job.company}</td>
              <td className="py-2">
                <SourceBadge source={app.job.source} />
              </td>
              <td className="py-2 text-slate-500">
                {app.appliedAt
                  ? `${app.appliedAt.toLocaleDateString()} ${app.appliedAt.toLocaleTimeString()} (${app.appliedAt.toLocaleDateString(
                      "en-US",
                      { weekday: "long" }
                    )})`
                  : "—"}
              </td>
              <td className="py-2" onClick={(event) => event.stopPropagation()}>
                <StatusDropdown applicationId={app.id} currentStatus={app.status} statuses={APPLICATION_STATUSES} />
              </td>
              <td className="py-2">
                <ScoreBadge score={app.job.score} />
              </td>
              <td className="py-2" onClick={(event) => event.stopPropagation()}>
                {app.job.coverNote && <CopyButton text={app.job.coverNote} label="Copy" />}
              </td>
              <td className="py-2" onClick={(event) => event.stopPropagation()}>
                {app.job.coldMessage && <CopyButton text={app.job.coldMessage} label="Copy" />}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      )}

      <ConfirmDialog
        open={confirmDelete}
        title="Delete selected applications?"
        message={`This will permanently delete ${selected.size} application(s). The underlying jobs are not affected.`}
        onConfirm={() => {
          setConfirmDelete(false);
          runBulkAction("delete");
        }}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  );
}
