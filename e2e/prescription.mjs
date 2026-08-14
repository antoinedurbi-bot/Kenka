import { chromium, devices } from "playwright";
import { mkdirSync } from "node:fs";

const OUT = new URL("./__screenshots__/", import.meta.url).pathname;
const BASE = process.env.KENKA_E2E_URL ?? "http://localhost:5199";
mkdirSync(OUT, { recursive: true });
const shot = (p, n) => p.screenshot({ path: `${OUT}/p-${n}.png`, fullPage: true });

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const ctx = await browser.newContext({ ...devices["iPhone 13"] });
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push("PAGEERROR: " + e.message));
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));

await page.goto(BASE, { waitUntil: "networkidle" });
await page.waitForTimeout(1500);

// ---- unit: prévu vs réel ----
const adh = await page.evaluate(async () => {
  const { adherence } = await import("/src/lib/adherence.ts");
  const { DEFAULT_SPLIT } = await import("/src/lib/split.ts");
  const day = (back) => {
    const d = new Date();
    d.setDate(d.getDate() - back);
    return d.toISOString().slice(0, 10);
  };

  // Split par défaut : 4 jours muscu loggables hors mobilité + 2 jours muay thai
  // par semaine, soit 24 séances prévues sur 4 semaines.
  const allDays = Array.from({ length: 28 }, (_, i) => day(i));

  const none = adherence(DEFAULT_SPLIT, [day(1), day(2)], [], 4);
  const half = adherence(DEFAULT_SPLIT, allDays.filter((_, i) => i % 4 === 0), [], 4);
  const full = adherence(DEFAULT_SPLIT, allDays, allDays, 4);

  // Une fenêtre trop courte ne doit pas produire de verdict.
  const fresh = adherence(DEFAULT_SPLIT, [day(0), day(1)], [], 4);

  return {
    plannedTotal: full.plannedTotal,
    freshIsInsufficient: fresh.verdict === "insuffisant",
    decrocheDetected: none.verdict === "decroche" || half.verdict === "decroche",
    fullIsTenu: full.verdict === "tenu",
    // Faire plus que prévu ne doit pas gonfler le taux au-delà de 100 %.
    rateCapped: full.rate <= 1,
    extraCounted: full.extra > 0,
    namesWorstAxis: /musculation|combat/.test(half.detail),
  };
});
console.log("ADHERENCE UNIT:", JSON.stringify(adh, null, 1));

// ---- seed : un exercice avec trois séances strictement identiques ----
const seeded = await page.evaluate(async () => {
  const { db } = await import("/src/db/db.ts");
  await db.settings.put({ key: "onboarded", value: "2026-07-01" });
  await db.sessionDraft.clear();
  const day = (back) => {
    const d = new Date();
    d.setDate(d.getDate() - back);
    return d.toISOString().slice(0, 10);
  };

  const ex = (await db.exercises.toArray()).find(
    (e) => e.type === "musculation" && !e.bodyweight && e.defaultReps,
  );
  // Répétitions qui montent : ce n'est PAS un plateau, donc la prescription
  // doit sortir des chiffres applicables (« 3 × 11 à 6 kg »).
  // Étalées sur plus de 14 jours : en dessous, l'assiduité ne mesurerait que
  // la date d'installation et le panneau resterait au verdict « pas de recul ».
  for (const [back, reps] of [[20, 8], [12, 9], [3, 10]]) {
    const logId = await db.workoutLogs.add({
      date: day(back), type: "musculation", splitDay: "push", completed: true,
    });
    for (let s = 0; s < 3; s++) {
      await db.workoutSets.add({
        workoutLogId: logId, exerciseId: ex.id, setIndex: s,
        date: day(back), reps, weightKg: 6,
      });
    }
  }

  const { startDraft } = await import("/src/lib/sessionDraft.ts");
  await startDraft({
    date: day(0),
    splitDay: "push",
    fromHistory: true,
    exercises: [
      { exerciseId: ex.id, sets: [0, 1, 2].map(() => ({ reps: "", weightKg: "", done: false })) },
    ],
  });
  return { name: ex.name, defaultReps: ex.defaultReps };
});
console.log("SEED:", seeded);

await page.goto(`${BASE}/#/seance`);
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(1500);
await shot(page, "01-objectif");

const objective = await page.evaluate(() => {
  const t = document.body.textContent;
  return {
    hasObjectifLabel: /Objectif/.test(t),
    // Trois séances identiques à 8 reps / 6 kg : la prescription doit demander
    // quelque chose de différent, pas répéter la dernière séance.
    prescribesMore: /9|Monter|levier|bloqu/i.test(t),
    hasRemplir: [...document.querySelectorAll("button")].some(
      (b) => b.textContent.trim() === "Remplir",
    ),
  };
});
console.log("OBJECTIVE SHOWN:", objective);

// Le cas plateau ne doit PAS être applicable : « changer de levier » se lit,
// ne se remplit pas. C'est la distinction qui empêche le bouton « Remplir »
// de proposer de refaire à l'identique une séance déjà bloquée trois fois.
const plateauCase = await page.evaluate(async () => {
  const { nextTarget } = await import("/src/lib/records.ts");
  const { isPlateaued, historyByExercise } = await import("/src/lib/exerciseHistory.ts");
  const day = (back) => {
    const d = new Date();
    d.setDate(d.getDate() - back);
    return d.toISOString().slice(0, 10);
  };
  const ex = { id: 1, name: "X", type: "musculation", zones: [], priority: "primaire", equipment: [], splitDays: [], defaultReps: "10-14" };
  const sets = [];
  for (const back of [3, 7, 11]) {
    for (let i = 0; i < 3; i++) {
      sets.push({ workoutLogId: 1, exerciseId: 1, setIndex: i, date: day(back), reps: 8, weightKg: 6 });
    }
  }
  const h = historyByExercise(sets).get(1);
  const t = nextTarget(ex, { sets: sets.slice(-3), topWeightKg: 6, topReps: 8 }, isPlateaued(h));
  return { plateaued: isPlateaued(h), headline: t.headline, applicable: t.reps !== undefined };
});
console.log("PLATEAU CASE:", plateauCase);

// ---- « Remplir » pré-remplit les séries vides ----
const beforeFill = await page.locator('input[aria-label*="répétitions"]').first().inputValue();
await page.locator('button:has-text("Remplir")').first().click();
await page.waitForTimeout(500);
const afterFill = await page.locator('input[aria-label*="répétitions"]').allTextContents().then(
  () => page.locator('input[aria-label*="répétitions"]').first().inputValue(),
);
console.log("FILL:", { beforeFill, afterFill, filled: beforeFill === "" && afterFill !== "" });

// ---- une série déjà saisie ne doit pas être écrasée par l'objectif ----
const noOverwrite = await page.evaluate(async () => {
  const { db } = await import("/src/db/db.ts");
  const draft = await db.sessionDraft.get("current");
  return draft.exercises[0].sets.map((s) => s.reps);
});
console.log("DRAFT AFTER FILL:", noOverwrite);

// ---- valider une série à la hauteur de l'objectif le marque atteint ----
await page.locator('button[aria-label*="à valider"]').first().click();
await page.waitForTimeout(800);
await shot(page, "02-atteint");
const met = await page.evaluate(() => /Atteint/.test(document.body.textContent));
console.log("TARGET MET:", { showsAtteint: met });

// ---- le miroir d'adhérence est sur la Base ----
await page.goto(`${BASE}/#/base`, { waitUntil: "networkidle" });
await page.waitForTimeout(1500);
await shot(page, "03-adherence");
const dash = await page.evaluate(() => {
  const t = document.body.textContent;
  return {
    hasPanel: /Prévu vs réel/.test(t),
    hasRatio: /séances sur \d+ prévues|assez de recul/.test(t),
    hasBreakdown: /MUSCU \d+\/\d+/.test(t),
  };
});
console.log("ADHERENCE PANEL:", dash);

console.log("ERRORS:", errors.length ? errors : "none");
await browser.close();
