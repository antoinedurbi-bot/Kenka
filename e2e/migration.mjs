import { chromium, devices } from "playwright";
import { mkdirSync } from "node:fs";

const OUT = new URL("./__screenshots__/", import.meta.url).pathname;
const BASE = process.env.KENKA_E2E_URL ?? "http://localhost:5199";
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const ctx = await browser.newContext({ ...devices["iPhone 13"] });
const page = await ctx.newPage();
const errors = [];

// Le blocage volontaire de main.tsx ci-dessous répond un 204 sans Content-Type :
// le navigateur log alors une erreur de type MIME sur le script de module. Elle
// est attendue, et la laisser remonter masquerait une vraie erreur dans le bruit.
const EXPECTED_BLOCKED_ENTRY =
  /Failed to load module script.*MIME type of ""/;

const errors_push = (t) => {
  if (!EXPECTED_BLOCKED_ENTRY.test(t)) errors.push(t);
};

page.on("pageerror", (e) => errors_push("PAGEERROR: " + e.message));
page.on("console", (m) => m.type() === "error" && errors_push(m.text()));

// ---- 1. Build a v1 database exactly as the shipped v1 schema would ----
// L'entrée React est bloquée pour ce premier chargement : sinon l'app ouvre la
// base en v2 avant qu'on ait pu y déposer des données v1, et le test ne
// mesurerait plus rien.
await page.route("**/src/main.tsx", (route) => route.fulfill({ status: 204, body: "" }));
await page.goto(BASE, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(500);

await page.evaluate(async () => {
  const mod = await import("/src/db/db.ts");
  const Dexie = Object.getPrototypeOf(mod.KenkaDB);
  await Dexie.delete("kenka");
  const legacy = new Dexie("kenka");
  legacy.version(1).stores({
    exercises: "++id, name, type, priority, *zones, *splitDays",
    workoutLogs: "++id, date, type, splitDay, completed",
    workoutSets: "++id, workoutLogId, exerciseId",
    measurements: "++id, date",
    nutrition: "++id, weekStart",
    combatSkills: "++id, category",
    combatCheckpoints: "++id, skillId, achieved",
    combatAssessments: "++id, skillId, date",
    combatLogs: "++id, date, kind",
    photos: "++id, date, angle",
    glowUp: "++id, category, order",
    settings: "key",
  });
  await legacy.open();
  const exId = await legacy.exercises.add({
    name: "Tractions pronation",
    type: "musculation",
    zones: ["dos", "avant-bras"],
    priority: "primaire",
    equipment: ["barre de tractions"],
    splitDays: ["pull"],
  });
  const logId = await legacy.workoutLogs.add({
    date: "2026-07-20",
    type: "musculation",
    splitDay: "pull",
    completed: true,
    feeling: 4,
  });
  // v1 sets have NO date field — this is what the migration must backfill.
  await legacy.workoutSets.bulkAdd([
    { workoutLogId: logId, exerciseId: exId, setIndex: 0, reps: 8, weightKg: 0 },
    { workoutLogId: logId, exerciseId: exId, setIndex: 1, reps: 7, weightKg: 0 },
  ]);
  await legacy.settings.put({ key: "seeded", value: "2026-07-01" });
  await legacy.settings.put({ key: "onboarded", value: "2026-07-01" });
  legacy.close();
});

// ---- 2. Load the real app: Dexie should upgrade v1 -> v2 ----
await page.unroute("**/src/main.tsx");
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(2500);

const migrated = await page.evaluate(async () => {
  const { db } = await import("/src/db/db.ts");
  const sets = await db.workoutSets.toArray();
  return {
    version: db.verno,
    setCount: sets.length,
    datesBackfilled: sets.every((s) => s.date === "2026-07-20"),
    sample: sets[0],
    newTables: {
      dailyWeights: await db.dailyWeights.count(),
      mobilityLogs: await db.mobilityLogs.count(),
      dailyIntake: await db.dailyIntake.count(),
    },
  };
});
console.log("MIGRATION:", JSON.stringify(migrated, null, 1));

// last-performance must find the migrated v1 sets via the new compound index
const perf = await page.evaluate(async () => {
  const { lastPerformance } = await import("/src/lib/performance.ts");
  const { db } = await import("/src/db/db.ts");
  const ex = await db.exercises.where("name").equals("Tractions pronation").first();
  const p = await lastPerformance(ex.id);
  return p ? { date: p.date, sets: p.sets.length, topReps: p.topReps } : null;
});
console.log("LAST PERF FROM MIGRATED v1 DATA:", perf);

await page.screenshot({ path: `${OUT}/v2-migration.png`, fullPage: true });

// ---- 3. Seed a realistic month, then check volume / readiness / plateau ----
await page.evaluate(async () => {
  const { db } = await import("/src/db/db.ts");
  const exercises = await db.exercises.toArray();
  const pick = (n) => exercises.find((e) => e.name === n);

  const pushEx = ["Pompes piquées (pike push-ups)", "Développé militaire haltères", "Élévations latérales"].map(pick);
  const pullEx = ["Tractions pronation", "Rowing haltères unilatéral", "Shrugs haltères"].map(pick);
  const armEx = ["Curl haltères", "Pompes diamant"].map(pick);

  const today = new Date();
  for (let w = 3; w >= 0; w--) {
    for (const [offset, group] of [[1, pushEx], [3, pullEx], [5, armEx]]) {
      const d = new Date(today);
      d.setDate(d.getDate() - (w * 7 + offset));
      const date = d.toISOString().slice(0, 10);
      const logId = await db.workoutLogs.add({
        date, type: "musculation", splitDay: group === pullEx ? "pull" : "push",
        completed: true, feeling: w === 0 ? 2 : 4,
      });
      for (const ex of group) {
        if (!ex) continue;
        for (let s = 0; s < 4; s++) {
          await db.workoutSets.add({
            workoutLogId: logId, exerciseId: ex.id, setIndex: s, date,
            reps: 10, weightKg: 10, // charge constante => plateau attendu
          });
        }
      }
    }
  }
  // three hard sessions in a row => deload signal
  for (let i = 0; i < 3; i++) {
    const d = new Date(today); d.setDate(d.getDate() - i);
    await db.workoutLogs.add({
      date: d.toISOString().slice(0, 10), type: "musculation", splitDay: "push",
      completed: true, feeling: 1,
    });
  }
});

const analysis = await page.evaluate(async () => {
  const { db } = await import("/src/db/db.ts");
  const { volumeReport } = await import("/src/lib/volume.ts");
  const { readiness } = await import("/src/lib/readiness.ts");
  const { detectPlateau } = await import("/src/lib/performance.ts");
  const sets = await db.workoutSets.toArray();
  const exercises = await db.exercises.toArray();
  const workouts = await db.workoutLogs.toArray();
  const combat = await db.combatLogs.toArray();
  const rep = volumeReport(sets, exercises, 28);
  const ready = readiness(workouts, combat);
  const curl = exercises.find((e) => e.name === "Curl haltères");
  const plateau = curl ? await detectPlateau(curl) : "exercice absent";
  return {
    volume: { total: rep.totalSets, ratio: rep.ratio, verdict: rep.verdict, advice: rep.advice, neglected: rep.neglected.length },
    readiness: { level: ready.level, headline: ready.headline, weekLoad: ready.weekLoad },
    plateau,
  };
});
console.log("ANALYSIS:", JSON.stringify(analysis, null, 1));

await page.goto(`${BASE}/#/physique`, { waitUntil: "networkidle" });
await page.waitForTimeout(1200);
await page.click('button:has-text("Volume")');
await page.waitForTimeout(1200);
await page.screenshot({ path: `${OUT}/v2-volume-full.png`, fullPage: true });

await page.goto(`${BASE}/#/`, { waitUntil: "networkidle" });
await page.waitForTimeout(1500);
await page.screenshot({ path: `${OUT}/v2-dashboard-full.png`, fullPage: true });

console.log("ERRORS:", errors.length ? errors : "none");
await browser.close();
