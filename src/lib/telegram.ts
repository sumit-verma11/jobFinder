import { Bot } from "grammy";
import { AppStatus } from "@prisma/client";
import { db } from "./db";

const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) {
  throw new Error("TELEGRAM_BOT_TOKEN is not set");
}

const allowedUserId = Number(process.env.TELEGRAM_ALLOWED_USER_ID);
if (!allowedUserId) {
  throw new Error("TELEGRAM_ALLOWED_USER_ID is not set");
}

export const bot = new Bot(token);

bot.use(async (ctx, next) => {
  if (ctx.from?.id !== allowedUserId) {
    return;
  }
  await next();
});

bot.command("saved", async (ctx) => {
  const jobs = await db.job.findMany({
    where: {
      notifiedAt: { not: null },
      OR: [{ application: null }, { application: { status: AppStatus.SAVED } }],
    },
    orderBy: { score: "desc" },
    take: 20,
  });

  if (jobs.length === 0) {
    await ctx.reply("No saved jobs — nothing pending action.");
    return;
  }

  const lines = jobs.map(
    (job) => `#${job.id}\n${job.title} @ ${job.company} — score ${job.score}\n${job.url}`
  );
  await ctx.reply(lines.join("\n\n"));
});

bot.command("applied", async (ctx) => {
  const jobId = ctx.match?.toString().trim();
  if (!jobId) {
    await ctx.reply("Usage: /applied <jobId>");
    return;
  }

  const job = await db.job.findUnique({ where: { id: jobId } });
  if (!job) {
    await ctx.reply(`No job found with id ${jobId}`);
    return;
  }

  await db.application.upsert({
    where: { jobId },
    create: { jobId, status: AppStatus.APPLIED, appliedAt: new Date() },
    update: { status: AppStatus.APPLIED, appliedAt: new Date() },
  });

  await ctx.reply(`Marked "${job.title}" as APPLIED.`);
});

bot.command("skip", async (ctx) => {
  const jobId = ctx.match?.toString().trim();
  if (!jobId) {
    await ctx.reply("Usage: /skip <jobId>");
    return;
  }

  const job = await db.job.findUnique({ where: { id: jobId } });
  if (!job) {
    await ctx.reply(`No job found with id ${jobId}`);
    return;
  }

  await db.application.upsert({
    where: { jobId },
    create: { jobId, status: AppStatus.REJECTED },
    update: { status: AppStatus.REJECTED },
  });

  await ctx.reply(`Marked "${job.title}" as REJECTED.`);
});

export async function notifyUser(message: string): Promise<void> {
  await bot.api.sendMessage(allowedUserId, message);
}
