"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Source } from "@prisma/client";

export function SourcesTable({ sources }: { sources: Source[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [kind, setKind] = useState<"CAREERS_PAGE" | "ATS">("CAREERS_PAGE");
  const [url, setUrl] = useState("");
  const [platform, setPlatform] = useState<"GREENHOUSE" | "LEVER" | "ASHBY" | "WORKABLE">("GREENHOUSE");
  const [slug, setSlug] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleAdd(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      const body =
        kind === "CAREERS_PAGE"
          ? { name, kind, url }
          : { name, kind, platform, slug };

      const response = await fetch("/api/sources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(data.error ?? "Failed to add source");
      }
      setName("");
      setUrl("");
      setSlug("");
      setError(null);
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function handleDelete(id: string) {
    try {
      const response = await fetch(`/api/sources/${id}`, { method: "DELETE" });
      if (!response.ok) {
        throw new Error("Failed to delete source");
      }
      setError(null);
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <form onSubmit={handleAdd} className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-slate-700">Company name</span>
          <input
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
            className="rounded-md border border-slate-200 p-2 text-sm"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-slate-700">Kind</span>
          <select
            value={kind}
            onChange={(event) => setKind(event.target.value as "CAREERS_PAGE" | "ATS")}
            className="rounded-md border border-slate-200 p-2 text-sm"
          >
            <option value="CAREERS_PAGE">Careers page (scraped)</option>
            <option value="ATS">ATS platform (structured)</option>
          </select>
        </label>
        {kind === "CAREERS_PAGE" ? (
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-slate-700">Careers URL</span>
            <input
              type="text"
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              required
              className="w-72 rounded-md border border-slate-200 p-2 text-sm"
            />
          </label>
        ) : (
          <>
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium text-slate-700">Platform</span>
              <select
                value={platform}
                onChange={(event) =>
                  setPlatform(event.target.value as "GREENHOUSE" | "LEVER" | "ASHBY" | "WORKABLE")
                }
                className="rounded-md border border-slate-200 p-2 text-sm"
              >
                <option value="GREENHOUSE">Greenhouse</option>
                <option value="LEVER">Lever</option>
                <option value="ASHBY">Ashby</option>
                <option value="WORKABLE">Workable</option>
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium text-slate-700">Company slug</span>
              <input
                type="text"
                value={slug}
                onChange={(event) => setSlug(event.target.value)}
                required
                className="rounded-md border border-slate-200 p-2 text-sm"
              />
            </label>
          </>
        )}
        <button
          type="submit"
          className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
        >
          Add
        </button>
      </form>
      {error && <p className="text-xs text-red-600">{error}</p>}

      {sources.length === 0 ? (
        <p className="text-sm text-slate-500">No sources yet — add one above.</p>
      ) : (
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs uppercase text-slate-500">
              <th className="py-2">Name</th>
              <th className="py-2">Kind</th>
              <th className="py-2">Details</th>
              <th className="py-2">Action</th>
            </tr>
          </thead>
          <tbody>
            {sources.map((source) => (
              <tr key={source.id} className="border-b border-slate-100">
                <td className="py-2 font-medium text-slate-900">{source.name}</td>
                <td className="py-2 text-slate-600">{source.kind}</td>
                <td className="py-2 text-slate-500">
                  {source.kind === "CAREERS_PAGE" ? source.url : `${source.platform} / ${source.slug}`}
                </td>
                <td className="py-2">
                  <button
                    type="button"
                    onClick={() => handleDelete(source.id)}
                    className="rounded-md border border-red-200 px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
                  >
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
