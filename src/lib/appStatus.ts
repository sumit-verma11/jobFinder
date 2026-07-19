import type { AppStatus } from "@prisma/client";

export const ALL_STATUSES: AppStatus[] = [
  "SAVED",
  "APPLIED",
  "RECRUITER_VIEWED",
  "OA_RECEIVED",
  "INTERVIEW_SCHEDULED",
  "INTERVIEW_COMPLETED",
  "OFFER",
  "REJECTED",
  "WITHDRAWN",
];

export const APPLICATION_STATUSES: AppStatus[] = ALL_STATUSES.filter((status) => status !== "SAVED");

export function formatStatusLabel(status: AppStatus): string {
  return status
    .toLowerCase()
    .split("_")
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join(" ");
}
