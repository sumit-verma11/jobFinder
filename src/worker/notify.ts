import { pathToFileURL } from "node:url";
import { db } from "../lib/db";
import { notifyUser } from "../lib/telegram";

const SCORE_THRESHOLD = Number(process.env.SCORE_THRESHOLD) || 7;

export async function runNotify(): Promise<void> {
  const latestRunLog = await db.runLog.findFirst({ orderBy: { startedAt: "desc" } });

  const jobsToNotify = await db.job.findMany({
    where: {
      score: { gte: SCORE_THRESHOLD },
      notifiedAt: null,
    },
  });

  console.log(`[notify] ${jobsToNotify.length} job(s) to notify`);

  let notified = 0;
  for (const job of jobsToNotify) {
    try {
      await notifyUser(formatJobMessage(job));
      await db.job.update({ where: { id: job.id }, data: { notifiedAt: new Date() } });
      notified++;
    } catch (err) {
      console.error(`[notify] failed to notify for job ${job.id}: ${(err as Error).message}`);
    }
  }

  if (notified === 0) {
    const scanned = latestRunLog?.jobsFound ?? 0;
    await sendSafely(`No new matches today (scanned ${scanned} jobs).`);
  }

  if (latestRunLog && latestRunLog.status !== "SUCCESS") {
    await sendSafely(
      `Today's collection run was ${latestRunLog.status}. ${latestRunLog.error ?? ""}`.trim()
    );
  }

  console.log(`[notify] run complete: notified ${notified}/${jobsToNotify.length}`);
}

async function sendSafely(message: string): Promise<void> {
  try {
    await notifyUser(message);
  } catch (err) {
    console.error(`[notify] failed to send status message: ${(err as Error).message}`);
  }
}

function formatJobMessage(job: {
  id: string;
  title: string;
  company: string;
  location: string | null;
  salaryText: string | null;
  score: number | null;
  scoreReason: string | null;
  url: string;
  coverNote: string | null;
}): string {
  const lines = [
    `New match: ${job.score}/10 (#${job.id})`,
    `${job.title} @ ${job.company}`,
    `Location: ${job.location ?? "not specified"}`,
    `Salary: ${job.salaryText ?? "not specified"}`,
    `Why: ${job.scoreReason ?? "n/a"}`,
    job.url,
  ];

  if (job.coverNote) {
    lines.push("", "Cover note:", job.coverNote);
  }

  lines.push("", `Reply /applied ${job.id} or /skip ${job.id}`);

  return lines.join("\n");
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  runNotify()
    .catch((err) => {
      console.error("[notify] fatal error:", err);
      process.exitCode = 1;
    })
    .finally(async () => {
      await db.$disconnect();
    });
}
