"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { FormEvent } from "react";
import type { UserProfile } from "@prisma/client";

export function SettingsForm({ profile }: { profile: UserProfile | null }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/settings", { method: "POST", body: formData });
      if (!response.ok) {
        throw new Error("Failed to save settings");
      }
      setError(null);
      router.refresh();
    } catch {
      setError("Failed to save settings — please try again");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex max-w-2xl flex-col gap-5">
      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium text-slate-700">Profile</span>
        <textarea
          name="profileText"
          defaultValue={profile?.profileText ?? ""}
          rows={8}
          className="rounded-md border border-slate-200 p-2 text-sm"
          placeholder="Experience, stack, links, and anything else the matcher should know about you."
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium text-slate-700">Style examples</span>
        <textarea
          name="styleExamplesText"
          defaultValue={profile?.styleExamplesText ?? ""}
          rows={5}
          className="rounded-md border border-slate-200 p-2 text-sm"
          placeholder="A couple of past outreach messages, so generated notes match your natural tone."
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium text-slate-700">Preferred locations</span>
        <input
          type="text"
          name="preferredLocations"
          defaultValue={profile?.preferredLocations.join(", ") ?? ""}
          className="rounded-md border border-slate-200 p-2 text-sm"
          placeholder="Noida, NCR, Remote"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium text-slate-700">Work mode</span>
        <select
          name="workMode"
          defaultValue={profile?.workMode ?? "REMOTE"}
          className="rounded-md border border-slate-200 p-2 text-sm"
        >
          <option value="REMOTE">Remote</option>
          <option value="HYBRID">Hybrid</option>
          <option value="ONSITE">Onsite</option>
        </select>
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium text-slate-700">Expected salary</span>
        <input
          type="text"
          name="expectedSalary"
          defaultValue={profile?.expectedSalary ?? ""}
          className="rounded-md border border-slate-200 p-2 text-sm"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium text-slate-700">Notice period</span>
        <input
          type="text"
          name="noticePeriod"
          defaultValue={profile?.noticePeriod ?? ""}
          className="rounded-md border border-slate-200 p-2 text-sm"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium text-slate-700">Resume</span>
        {profile?.resumeFileName && (
          <a href="/api/settings/resume" className="text-sm text-emerald-700 underline">
            Current: {profile.resumeFileName}
          </a>
        )}
        <input type="file" name="resume" className="text-sm" />
      </label>

      <button
        type="submit"
        className="w-fit rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
      >
        Save
      </button>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </form>
  );
}
