import { NextResponse } from "next/server";
import type { WorkMode } from "@prisma/client";
import { saveProfile } from "@/lib/profile";
import { saveResumeFile } from "@/lib/resumeStorage";

export async function POST(request: Request) {
  try {
    const form = await request.formData();

    const profileText = String(form.get("profileText") ?? "");
    const styleExamplesText = String(form.get("styleExamplesText") ?? "");
    const preferredLocations = String(form.get("preferredLocations") ?? "")
      .split(",")
      .map((location) => location.trim())
      .filter(Boolean);
    const jobTitleKeywords = String(form.get("jobTitleKeywords") ?? "")
      .split(",")
      .map((keyword) => keyword.trim())
      .filter(Boolean);
    const workMode = String(form.get("workMode") ?? "REMOTE") as WorkMode;
    const currentSalary = String(form.get("currentSalary") ?? "").trim() || null;
    const expectedSalary = String(form.get("expectedSalary") ?? "").trim() || null;
    const noticePeriod = String(form.get("noticePeriod") ?? "").trim() || null;

    const resumeFile = form.get("resume");
    const resumeFields =
      resumeFile instanceof File && resumeFile.size > 0 ? await saveResumeFile(resumeFile) : {};

    await saveProfile({
      profileText,
      styleExamplesText,
      preferredLocations,
      jobTitleKeywords,
      workMode,
      currentSalary,
      expectedSalary,
      noticePeriod,
      ...resumeFields,
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Failed to save settings" }, { status: 500 });
  }
}
