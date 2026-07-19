import type { WorkMode } from "@prisma/client";
import { db } from "./db";

export interface Profile {
  profileText: string;
  styleExamplesText: string;
  preferredLocations: string[];
  workMode: WorkMode;
}

export interface ProfileInput {
  profileText: string;
  styleExamplesText: string;
  preferredLocations: string[];
  workMode: WorkMode;
  expectedSalary: string | null;
  noticePeriod: string | null;
  jobTitleKeywords: string[];
  resumeFileName?: string;
  resumeFilePath?: string;
}

export async function loadProfile(): Promise<Profile> {
  const row = await db.userProfile.findUnique({ where: { id: "default" } });

  if (!row) {
    throw new Error(
      "No profile found. Fill in your details at /settings before running the matcher."
    );
  }

  return {
    profileText: row.profileText,
    styleExamplesText: row.styleExamplesText ?? "",
    preferredLocations: row.preferredLocations,
    workMode: row.workMode,
  };
}

export async function saveProfile(input: ProfileInput): Promise<void> {
  const resumeFields =
    input.resumeFileName && input.resumeFilePath
      ? { resumeFileName: input.resumeFileName, resumeFilePath: input.resumeFilePath }
      : {};

  await db.userProfile.upsert({
    where: { id: "default" },
    create: {
      id: "default",
      profileText: input.profileText,
      styleExamplesText: input.styleExamplesText,
      preferredLocations: input.preferredLocations,
      workMode: input.workMode,
      expectedSalary: input.expectedSalary,
      noticePeriod: input.noticePeriod,
      jobTitleKeywords: input.jobTitleKeywords,
      ...resumeFields,
    },
    update: {
      profileText: input.profileText,
      styleExamplesText: input.styleExamplesText,
      preferredLocations: input.preferredLocations,
      workMode: input.workMode,
      expectedSalary: input.expectedSalary,
      noticePeriod: input.noticePeriod,
      jobTitleKeywords: input.jobTitleKeywords,
      ...resumeFields,
    },
  });
}

export async function loadJobTitleKeywords(): Promise<string[]> {
  const row = await db.userProfile.findUnique({ where: { id: "default" } });
  return row?.jobTitleKeywords ?? [];
}
