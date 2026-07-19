import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { ScoreBadge } from "@/components/ScoreBadge";
import { SourceBadge } from "@/components/SourceBadge";
import { CoverLetterSection } from "@/components/CoverLetterSection";
import { ColdMessageSection } from "@/components/ColdMessageSection";
import { NotesAndFollowUp } from "@/components/NotesAndFollowUp";
import { StatusDropdown } from "@/components/StatusDropdown";
import { SaveToPipelineButton } from "@/components/SaveToPipelineButton";
import { ALL_STATUSES } from "@/lib/appStatus";

export default async function JobDetailsPage({ params }: { params: { id: string } }) {
  const job = await db.job.findUnique({
    where: { id: params.id },
    include: { application: true },
  });

  if (!job) {
    notFound();
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <div className="mb-2 flex items-center gap-2">
          <ScoreBadge score={job.score} />
          <SourceBadge source={job.source} />
        </div>
        <h1 className="text-xl font-semibold text-slate-900">{job.title}</h1>
        <p className="text-sm text-slate-600">{job.company}</p>
        <p className="mt-1 text-xs text-slate-500">{job.scoreReason}</p>
        <a href={job.url} target="_blank" rel="noopener noreferrer" className="text-xs text-emerald-700 underline">
          {job.url}
        </a>
      </div>

      {job.description && (
        <div>
          <h2 className="mb-2 text-sm font-semibold text-slate-900">Description</h2>
          <p className="whitespace-pre-wrap text-sm text-slate-700">{job.description}</p>
        </div>
      )}

      <CoverLetterSection job={job} />
      <ColdMessageSection job={job} />

      {job.application ? (
        <>
          <div>
            <h2 className="mb-2 text-sm font-semibold text-slate-900">Status</h2>
            <StatusDropdown
              applicationId={job.application.id}
              currentStatus={job.application.status}
              statuses={ALL_STATUSES}
            />
          </div>
          <NotesAndFollowUp application={job.application} />
        </>
      ) : (
        <SaveToPipelineButton jobId={job.id} />
      )}
    </div>
  );
}
