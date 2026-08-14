import { chromium, devices } from "playwright";
import { mkdirSync } from "node:fs";

const OUT = new URL("./__screenshots__/", import.meta.url).pathname;
const BASE = process.env.KENKA_E2E_URL ?? "http://localhost:5199";
mkdirSync(OUT, { recursive: true });
const shot = (p, n) => p.screenshot({ path: `${OUT}/v-${n}.png`, fullPage: true });

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const ctx = await browser.newContext({ ...devices["iPhone 13"] });
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push("PAGEERROR: " + e.message));
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));

await page.goto(BASE, { waitUntil: "networkidle" });
await page.waitForTimeout(1500);

// ---- unit: la grille couvre les bonnes semaines et résume juste ----
const unit = await page.evaluate(async () => {
  const { trainingCalendar, summarizeCalendar } = await import("/src/lib/trainingCalendar.ts");
  const day = (back) => {
    const d = new Date();
    d.setDate(d.getDate() - back);
    return d.toISOString().slice(0, 10);
  };

  // 3 jours consécutifs, puis un trou, puis un jour combat.
  const workouts = [day(6), day(5), day(4)];
  const combat = [day(1)];
  const grid = trainingCalendar(workouts, combat, 12);
  const sum = summarizeCalendar(grid);

  // Un même jour sur les deux axes doit ressortir en "both".
  const bothGrid = trainingCalendar([day(2)], [day(2)], 4);
  const bothDay = bothGrid.flatMap((w) => w.days).find((d) => d.date === day(2));

  return {
    weeks: grid.length,
    daysPerWeek: grid[0].days.length,
    // La semaine en cours est affichée entière : des cases futures existent
    // forcément sauf si on est dimanche.
    hasFuture: grid.flatMap((w) => w.days).some((d) => d.future),
    futureExcludedFromTotals: sum.totalDays === grid.flatMap((w) => w.days).filter((d) => !d.future).length,
    activeDays: sum.activeDays,
    longestRun: sum.longestRun,
    daysSinceLast: sum.daysSinceLast,
    bothAxis: bothDay?.axis,
  };
});
console.log("CALENDAR UNIT:", JSON.stringify(unit, null, 1));

// ---- seed a realistic month + an assessed skill ----
await page.evaluate(async () => {
  const { db } = await import("/src/db/db.ts");
  await db.settings.put({ key: "onboarded", value: "2026-07-01" });
  const day = (back) => {
    const d = new Date();
    d.setDate(d.getDate() - back);
    return d.toISOString().slice(0, 10);
  };
  const ex = await db.exercises.toArray();
  const pick = (n) => ex.find((e) => e.name === n);
  const group = ["Pompes piquées (pike push-ups)", "Développé militaire haltères"].map(pick);

  for (const back of [1, 3, 5, 8, 10, 12, 15, 17, 19, 22]) {
    const logId = await db.workoutLogs.add({
      date: day(back), type: "musculation", splitDay: "push",
      completed: true, feeling: 4, durationMin: 52,
    });
    for (const e of group) {
      if (!e) continue;
      for (let s = 0; s < 4; s++) {
        await db.workoutSets.add({
          workoutLogId: logId, exerciseId: e.id, setIndex: s,
          date: day(back), reps: 10, weightKg: 10,
        });
      }
    }
  }
  for (const back of [2, 6, 9, 13, 16, 20]) {
    await db.combatLogs.add({
      date: day(back), kind: back % 4 === 0 ? "sparring" : "club",
      durationMin: 90, rounds: 5, intensity: 3, techniques: ["Jab", "Esquive"],
    });
  }

  const skill = await db.combatSkills.toArray();
  if (skill[0]?.id) {
    for (const [back, level] of [[40, 1], [25, 2], [12, 2], [3, 4]]) {
      await db.combatAssessments.add({
        skillId: skill[0].id, date: day(back), level,
        notes: back === 3 ? "Ça sort en sparring léger maintenant." : undefined,
      });
    }
  }
});
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(1500);

// ---- dashboard: calendar renders ----
await page.goto(`${BASE}/#/base`, { waitUntil: "networkidle" });
await page.waitForTimeout(1500);
await shot(page, "01-dashboard-calendar");

const dash = await page.evaluate(() => {
  const t = document.body.textContent;
  return {
    hasActiveDays: /j actifs/.test(t),
    hasLongestRun: /Plus longue série/.test(t),
    hasLastSession: /Dernière séance/.test(t),
    cells: document.querySelectorAll('span[title*="—"]').length,
  };
});
console.log("DASHBOARD CALENDAR:", dash);

// ---- sessions history: sets + tonnage on every row, no expand needed ----
await page.goto(`${BASE}/#/physique`, { waitUntil: "networkidle" });
await page.waitForTimeout(1000);
await page.click('button:has-text("Séances")');
await page.waitForTimeout(1200);
await shot(page, "02-sessions-history");

const history = await page.evaluate(() => {
  const t = document.body.textContent;
  return {
    // 8 séries × 10 reps × 10 kg = 800 kg par séance.
    showsTonnage: /800 kg/.test(t),
    showsSetCount: /séries/.test(t),
  };
});
console.log("SESSION HISTORY:", history);

// ---- combat: assessment history now visible ----
await page.goto(`${BASE}/#/combat`, { waitUntil: "networkidle" });
await page.waitForTimeout(1200);
await shot(page, "03-combat-assessments");

const assess = await page.evaluate(() => {
  const t = document.body.textContent;
  return {
    hasRessenti: /Ressenti/.test(t),
    hasLevelLabel: /Fiable en sparring/.test(t),
    hasNotes: /Ça sort en sparring léger/.test(t),
    hasCount: /4 évaluations/.test(t),
  };
});
console.log("COMBAT ASSESSMENTS:", assess);

// ---- library search must fold accents like the session picker does ----
// Les deux écrans avaient leur propre comparaison : « elevations » trouvait
// l'exercice en séance mais pas dans la bibliothèque.
await page.goto(`${BASE}/#/physique`, { waitUntil: "networkidle" });
await page.waitForTimeout(1000);
await page.click('button:has-text("Exercices")');
await page.waitForTimeout(800);

const search = page.locator('input[aria-label="Rechercher un exercice"]');
const countRows = () => page.locator('button:has-text("→")').count();

await search.fill("elevations");
await page.waitForTimeout(400);
const unaccented = await countRows();
await search.fill("élévations");
await page.waitForTimeout(400);
const accented = await countRows();
// La zone doit être cherchable aussi, pas seulement le nom.
await search.fill("epaules");
await page.waitForTimeout(400);
const byZone = await countRows();

console.log("LIBRARY SEARCH:", {
  unaccented,
  accented,
  foldingWorks: unaccented > 0 && unaccented === accented,
  zoneSearchWorks: byZone > 0,
});

console.log("ERRORS:", errors.length ? errors : "none");
await browser.close();
