import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { chatCompletion } from "@/lib/llm";
import { loadProfile } from "@/lib/profile";
import { buildColdMessagePrompt } from "@/lib/matching/prompts";
import { sanitizeCoverNote, containsSensitiveInfo } from "@/lib/matching/sanitizeCoverNote";
import type { JobForMatching } from "@/lib/matching/types";

export async function POST(_request: Request, { params }: { params: { id: string } }) {
  const job = await db.job.findUnique({ where: { id: params.id } });

  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  if (job.coldMessage) {
    return NextResponse.json({ coldMessage: job.coldMessage });
  }

  try {
    const { profileText, styleExamplesText } = await loadProfile();
    const jobForMatching: JobForMatching = {
      title: job.title,
      company: job.company,
      location: job.location,
      salaryText: job.salaryText,
      description: job.description,
    };

    const raw = await chatCompletion(buildColdMessagePrompt(profileText, styleExamplesText, jobForMatching));
    const sanitized = sanitizeCoverNote(raw);

    if (containsSensitiveInfo(sanitized)) {
      return NextResponse.json(
        { error: "Generated cold message mentioned sensitive info — try again" },
        { status: 422 }
      );
    }

    await db.job.update({ where: { id: job.id }, data: { coldMessage: sanitized } });
    return NextResponse.json({ coldMessage: sanitized });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 });
  }
}
