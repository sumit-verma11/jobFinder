import { pathToFileURL } from "node:url";
import { db } from "../lib/db";
import { chatCompletion } from "../lib/llm";
import { loadProfile } from "../lib/profile";
import { buildScorePrompt, buildCoverNotePrompt } from "../lib/matching/prompts";
import { parseScoreResponse } from "../lib/matching/parseScore";
import { shouldGenerateCoverNote } from "../lib/matching/threshold";
import { sanitizeCoverNote } from "../lib/matching/sanitizeCoverNote";
import type { JobForMatching } from "../lib/matching/types";

const SCORE_THRESHOLD = Number(process.env.SCORE_THRESHOLD) || 7;

export async function runMatch(): Promise<void> {
  const { profileText, styleExamplesText } = loadProfile();
  const jobs = await db.job.findMany({ where: { score: null } });

  console.log(`[match] scoring ${jobs.length} job(s)`);

  let scored = 0;
  let coverNotesGenerated = 0;

  for (const job of jobs) {
    const jobForMatching: JobForMatching = {
      title: job.title,
      company: job.company,
      location: job.location,
      salaryText: job.salaryText,
      description: job.description,
    };

    try {
      const scoreRaw = await chatCompletion(buildScorePrompt(profileText, jobForMatching));
      const scoreResult = parseScoreResponse(scoreRaw);

      if (!scoreResult) {
        console.warn(`[match] skipping job ${job.id} (${job.title}): could not parse score response`);
        continue;
      }

      let coverNote: string | null = null;
      if (shouldGenerateCoverNote(scoreResult.score, SCORE_THRESHOLD)) {
        try {
          const coverNoteRaw = await chatCompletion(
            buildCoverNotePrompt(profileText, styleExamplesText, jobForMatching)
          );
          coverNote = sanitizeCoverNote(coverNoteRaw);
          coverNotesGenerated++;
        } catch (err) {
          console.error(`[match] failed to generate cover note for job ${job.id}: ${(err as Error).message}`);
        }
      }

      await db.job.update({
        where: { id: job.id },
        data: {
          score: scoreResult.score,
          scoreReason: scoreResult.reason,
          coverNote,
        },
      });
      scored++;
      console.log(`[match] ${job.title} @ ${job.company}: score ${scoreResult.score} (${scoreResult.reason})`);
    } catch (err) {
      console.error(`[match] failed to score job ${job.id} (${job.title}): ${(err as Error).message}`);
    }
  }

  console.log(
    `[match] run complete: scored ${scored}/${jobs.length}, ${coverNotesGenerated} cover note(s) generated`
  );
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  runMatch()
    .catch((err) => {
      console.error("[match] fatal error:", err);
      process.exitCode = 1;
    })
    .finally(async () => {
      await db.$disconnect();
    });
}
