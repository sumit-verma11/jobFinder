import cron from "node-cron";
import { runCollect } from "./collect";
import { runMatch } from "./match";
import { runNotify } from "./notify";
import { bot } from "../lib/telegram";

const schedule = process.env.CRON_SCHEDULE || "0 9 * * *";

console.log("[worker] starting, schedule:", schedule);

cron.schedule(schedule, async () => {
  console.log(`[worker] pipeline run starting @ ${new Date().toISOString()}`);
  try {
    await runCollect();
    await runMatch();
    await runNotify();
  } catch (err) {
    console.error("[worker] pipeline run failed:", err);
  }
  console.log(`[worker] pipeline run finished @ ${new Date().toISOString()}`);
});

bot.start().catch((err) => {
  console.error("[worker] telegram bot polling failed:", err);
});

console.log("[worker] telegram bot listening for commands");
console.log("[worker] scheduled, waiting for cron ticks... (Ctrl+C to stop)");
