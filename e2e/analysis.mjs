import { chromium, devices } from "playwright";
import { mkdirSync } from "node:fs";

const OUT = new URL("./__screenshots__/", import.meta.url).pathname;
const BASE = process.env.KENKA_E2E_URL ?? "http://localhost:5199";
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const ctx = await browser.newContext({ ...devices["iPhone 13"] });
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push("PAGEERROR: " + e.message));
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));

await page.goto(BASE, { waitUntil: "networkidle" });
await page.waitForTimeout(2000);

// Fresh seeded DB. Mark onboarding done and inject a month of arm-heavy training
// (deliberately mis-shaped for the Toji goal) to exercise the volume verdict.
await page.evaluate(async () => {
  const { db } = await import("/src/db/db.ts");
  await db.settings.put({ key: "onboarded", value: "2026-07-01" });
  await db.settings.put({ key: "heightCm", value: 169 });

  const ex = await db.exercises.toArray();
  const byName = (n) => ex.find((e) => e.name === n);
  const armDay = ["Curl haltères", "Pompes diamant", "Dips entre deux chaises"].map(byName);
  const pushDay = ["Développé militaire haltères", "Élévations latérales"].map(byName);

  const today = new Date();
  for (let w = 3; w >= 0; w--) {
    for (const [off, group, day] of [[1, armDay, "push"], [4, pushDay, "push"]]) {
      const d = new Date(today);
      d.setDate(d.getDate() - (w * 7 + off));
      const date = d.toISOString().slice(0, 10);
      const logId = await db.workoutLogs.add({
        date, type: "musculation", splitDay: day, completed: true, feeling: 4,
      });
      for (const e of group) {
        if (!e) continue;
        for (let s = 0; s < 4; s++) {
          await db.workoutSets.add({
            workoutLogId: logId, exerciseId: e.id, setIndex: s, date,
            reps: 12, weightKg: 10, // charge figée => plateau attendu
          });
        }
      }
    }
  }

  // Mesures espacées pour vérifier le lissage
  for (const [date, waist, neck, sh, wt] of [
    ["2026-06-10", 76, 37, 110, 62.0],
    ["2026-06-24", 75, 37, 111, 62.6],
    ["2026-07-08", 75.5, 37, 111.5, 63.0],
    ["2026-07-22", 74.5, 37, 112, 63.4],
  ]) {
    await db.measurements.add({ date, waistCm: waist, neckCm: neck, shouldersCm: sh, weightKg: wt,
      bfPercent: 495 / (1.0324 - 0.19077 * Math.log10(waist - neck) + 0.15456 * Math.log10(169)) - 450 });
  }
  // Pesées quotidiennes + apports, pour la calibration
  for (let i = 12; i >= 0; i--) {
    const d = new Date(today); d.setDate(d.getDate() - i);
    const date = d.toISOString().slice(0, 10);
    await db.dailyWeights.add({ date, weightKg: 63.2 + (12 - i) * 0.045 });
    await db.dailyIntake.add({ date, kcal: 2900 });
  }
});

const out = await page.evaluate(async () => {
  const { db } = await import("/src/db/db.ts");
  const { volumeReport } = await import("/src/lib/volume.ts");
  const { detectPlateau } = await import("/src/lib/performance.ts");
  const { calibrateMaintenance, weightSlopePerWeek } = await import("/src/lib/nutrition.ts");
  const { physiqueLevel, smoothBody } = await import("/src/lib/progression.ts");

  const sets = await db.workoutSets.toArray();
  const exercises = await db.exercises.toArray();
  const rep = volumeReport(sets, exercises, 28);
  const curl = exercises.find((e) => e.name === "Curl haltères");
  const measurements = await db.measurements.orderBy("date").toArray();

  return {
    volume: {
      total: rep.totalSets, prioritySets: rep.prioritySets, counterSets: rep.counterSets,
      ratio: rep.ratio ? Number(rep.ratio.toFixed(2)) : null,
      verdict: rep.verdict, advice: rep.advice,
      top: rep.byZone.slice(0, 4).map((z) => `${z.zone}:${z.sets}`),
    },
    plateau: await detectPlateau(curl),
    calibration: calibrateMaintenance(await db.dailyIntake.toArray(), await db.dailyWeights.toArray()),
    slope: Number(weightSlopePerWeek(await db.dailyWeights.toArray()).toFixed(3)),
    smooth: smoothBody(measurements),
    level: physiqueLevel(measurements),
  };
});
console.log(JSON.stringify(out, null, 1));

// L'app a décidé d'afficher l'onboarding avant que le drapeau soit posé : recharger.
await page.goto(`${BASE}/#/physique`, { waitUntil: "networkidle" });
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(1800);
await page.click('button:has-text("Volume")');
await page.waitForTimeout(1200);
await page.screenshot({ path: `${OUT}/v2-volume-full.png`, fullPage: true });

await page.click('button:has-text("Nutrition")');
await page.waitForTimeout(1000);
await page.screenshot({ path: `${OUT}/v2-nutrition-full.png`, fullPage: true });
await page.locator('button:has-text("Calibrer")').click();
await page.waitForTimeout(900);
await page.screenshot({ path: `${OUT}/v2-calibration.png`, fullPage: true });
await page.click('button[aria-label="Fermer"]');
await page.waitForTimeout(400);

await page.goto(`${BASE}/#/base`, { waitUntil: "networkidle" });
await page.waitForTimeout(1500);
await page.screenshot({ path: `${OUT}/v2-dashboard-full.png`, fullPage: true });

console.log("ERRORS:", errors.length ? errors : "none");
await browser.close();
