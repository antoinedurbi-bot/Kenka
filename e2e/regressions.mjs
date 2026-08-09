import { chromium, devices } from "playwright";

const BASE = process.env.KENKA_E2E_URL ?? "http://localhost:5199";

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const ctx = await browser.newContext({ ...devices["iPhone 13"] });
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push("PAGEERROR: " + e.message));

await page.goto(BASE, { waitUntil: "networkidle" });
await page.waitForTimeout(2000);

const results = await page.evaluate(async () => {
  const out = {};
  const { db } = await import("/src/db/db.ts");
  const { weeklyStreak, currentWeekCount } = await import("/src/lib/streaks.ts");
  const { isoWeekStart } = await import("/src/lib/dates.ts");

  // ---- streaks are calendar-week based and stable ----
  const monday = isoWeekStart();
  const dayIn = (weeksAgo, offset) => {
    const d = new Date(`${monday}T00:00:00`);
    d.setDate(d.getDate() - weeksAgo * 7 + offset);
    return d.toISOString().slice(0, 10);
  };
  // 4 full weeks at 3 sessions (mon/wed/fri), current week partial (1 session)
  const dates = [];
  for (let w = 1; w <= 4; w++) for (const off of [0, 2, 4]) dates.push(dayIn(w, off));
  dates.push(dayIn(0, 0));
  out.streak = weeklyStreak(dates, 3);          // expect 4 (partial week doesn't break)
  out.thisWeek = currentWeekCount(dates);        // expect 1
  out.brokenStreak = weeklyStreak(
    dates.filter((d) => d !== dayIn(2, 0)), 3);   // week 2 now has 2 -> expect 1
  out.allWeeksComplete = weeklyStreak(
    [...dates, dayIn(0, 1), dayIn(0, 2)], 3);     // current week complete -> expect 5

  // ---- import runs in one transaction: a mid-file failure must roll back ----
  await db.workoutLogs.clear();
  await db.workoutLogs.add({ date: "2026-05-01", type: "musculation", splitDay: "pull", completed: true });
  const before = await db.workoutLogs.count();

  const { importBackup } = await import("/src/lib/backup.ts");
  // Envelope valide, mais `dailyWeights` viole son index unique `&date`.
  // Cette table est traitée APRÈS workoutLogs : au moment de l'échec, les
  // séances ont donc déjà été vidées puis réécrites.
  const bad = {
    format: "kenka-backup",
    version: 2,
    exportedAt: new Date().toISOString(),
    tables: {
      exercises: [],
      workoutLogs: [{ id: 99, date: "2026-01-01", type: "musculation", splitDay: "push", completed: true }],
      dailyWeights: [
        { id: 1, date: "2026-02-02", weightKg: 63 },
        { id: 2, date: "2026-02-02", weightKg: 64 },
      ],
    },
  };
  const file = new File([JSON.stringify(bad)], "bad.json", { type: "application/json" });
  try {
    await importBackup(file);
    out.importThrew = false;
  } catch (e) {
    out.importThrew = true;
    out.importError = String(e).slice(0, 80);
  }
  out.logsBefore = before;
  out.logsAfterFailedImport = await db.workoutLogs.count();
  out.originalLogSurvived =
    (await db.workoutLogs.where("date").equals("2026-05-01").count()) === 1;
  out.rolledBack = out.logsAfterFailedImport === before && out.originalLogSurvived;

  return out;
});

console.log(JSON.stringify(results, null, 1));
console.log("ERRORS:", errors.length ? errors : "none");
await browser.close();
