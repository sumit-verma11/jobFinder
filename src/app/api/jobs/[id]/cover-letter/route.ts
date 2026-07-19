import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { chatCompletion } from "@/lib/llm";
import { loadProfile } from "@/lib/profile";
import { buildCoverNotePrompt } from "@/lib/matching/prompts";
import { sanitizeCoverNote, containsSensitiveInfo } from "@/lib/matching/sanitizeCoverNote";
import type { JobForMatching } from "@/lib/matching/types";

export async function POST(_request: Request, { params }: { params: { id: string } }) {
  const job = await db.job.findUnique({ where: { id: params.id } });

  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  if (job.coverNote) {
    return NextResponse.json({ coverNote: job.coverNote });
  }

  const { profileText, styleExamplesText } = await loadProfile();
  const jobForMatching: JobForMatching = {
    title: job.title,
    company: job.company,
    location: job.location,
    salaryText: job.salaryText,
    description: job.description,
  };

  try {
    const raw = await chatCompletion(buildCoverNotePrompt(profileText, styleExamplesText, jobForMatching));
    const sanitized = sanitizeCoverNote(raw);

    if (containsSensitiveInfo(sanitized)) {
      return NextResponse.json(
        { error: "Generated cover letter mentioned sensitive info — try again" },
        { status: 422 }
      );
    }

    await db.job.update({ where: { id: job.id }, data: { coverNote: sanitized } });
    return NextResponse.json({ coverNote: sanitized });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 });
  }
}
