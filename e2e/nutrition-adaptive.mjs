import { chromium, devices } from "playwright";
import { mkdirSync } from "node:fs";

const OUT = new URL("./__screenshots__/", import.meta.url).pathname;
const BASE = process.env.KENKA_E2E_URL ?? "http://localhost:5199";
mkdirSync(OUT, { recursive: true });
const shot = (p, n) => p.screenshot({ path: `${OUT}/n-${n}.png`, fullPage: true });

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const ctx = await browser.newContext({ ...devices["iPhone 13"] });
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push("PAGEERROR: " + e.message));
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));

await page.goto(BASE, { waitUntil: "networkidle" });
await page.waitForTimeout(1500);

// ---- unit level: EMA trend + recalibration drift ----
const unit = await page.evaluate(async () => {
  const { trendWeight, recalibrationSuggestion } = await import("/src/lib/nutrition.ts");

  const day = (n) => {
    const d = new Date();
    d.setDate(d.getDate() - (20 - n));
    return d.toISOString().slice(0, 10);
  };

  // Poids qui oscille fort jour à jour (bruit d'hydratation) mais monte doucement.
  const weights = Array.from({ length: 15 }, (_, i) => ({
    date: day(i),
    weightKg: 70 + i * 0.1 + (i % 2 === 0 ? 0.8 : -0.6),
  }));
  const trend = trendWeight(weights);

  // La calibration ne regarde que les 10 derniers jours : ces séries doivent
  // tomber dedans, contrairement aux 15 points ci-dessus qui servent juste
  // à tester le lissage EMA sur une fenêtre plus large.
  const recentDay = (n) => {
    const d = new Date();
    d.setDate(d.getDate() - (9 - n));
    return d.toISOString().slice(0, 10);
  };
  const intake = Array.from({ length: 10 }, (_, i) => ({ date: recentDay(i), kcal: 2900 }));
  const weightsForCalib = Array.from({ length: 10 }, (_, i) => ({
    date: recentDay(i),
    weightKg: 70 + i * 0.15,
  }));

  const noStored = recalibrationSuggestion(null, intake, weightsForCalib);
  const farOff = recalibrationSuggestion(2000, intake, weightsForCalib);
  const alreadyClose = recalibrationSuggestion(
    farOff.liveMaintenanceKcal ?? 2500,
    intake,
    weightsForCalib,
  );

  return {
    trendLength: trend.length,
    // Le lissage doit amortir l'alternance +0.8/-0.6 : l'écart-type de la
    // série lissée doit être nettement plus petit que celui du poids brut.
    rawSwing: Math.max(...weights.map((w) => w.weightKg)) - Math.min(...weights.map((w) => w.weightKg)),
    trendSwing: Math.max(...trend.map((t) => t.value)) - Math.min(...trend.map((t) => t.value)),
    noStoredAvailable: noStored.available,
    farOffAvailable: farOff.available,
    farOffDelta: farOff.deltaKcal,
    alreadyCloseAvailable: alreadyClose.available,
  };
});
console.log("NUTRITION UNIT:", JSON.stringify(unit, null, 1));

// ---- rendered: chart shows both series, banner appears when stored is stale ----
await page.evaluate(async () => {
  const { db } = await import("/src/db/db.ts");
  await db.settings.put({ key: "onboarded", value: "2026-07-01" });
  await db.settings.put({ key: "maintenanceKcal", value: 1800 });
  const day = (n) => {
    const d = new Date();
    d.setDate(d.getDate() - (10 - n));
    return d.toISOString().slice(0, 10);
  };
  for (let i = 0; i < 10; i++) {
    await db.dailyWeights.put({ date: day(i), weightKg: 70 + i * 0.05 });
    await db.dailyIntake.put({ date: day(i), kcal: 2900 });
  }
});
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(1500);

await page.goto(`${BASE}/#/physique`, { waitUntil: "networkidle" });
await page.waitForTimeout(1000);
await page.click('button:has-text("Nutrition")');
await page.waitForTimeout(900);
await shot(page, "01-nutrition");

const rendered = await page.evaluate(() => ({
  hasRecalBanner: !!document.body.textContent.match(/Nouvelle estimation disponible/),
  hasTrendLabel: !!document.body.textContent.match(/kg lissé/),
  chartLines: document.querySelectorAll(".recharts-line").length,
}));
console.log("NUTRITION SCREEN:", rendered);

console.log("ERRORS:", errors.length ? errors : "none");
await browser.close();
