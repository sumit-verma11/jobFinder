import cron from "node-cron";

const TEMP_TEST_SCHEDULE = "* * * * *"; // every 1 minute — Phase 1 only, replaced in Phase 4

console.log("[worker] starting, schedule:", TEMP_TEST_SCHEDULE);

cron.schedule(TEMP_TEST_SCHEDULE, () => {
  console.log(`[worker] alive @ ${new Date().toISOString()}`);
});

console.log("[worker] scheduled, waiting for ticks... (Ctrl+C to stop)");
