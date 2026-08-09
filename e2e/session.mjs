import { chromium, devices } from "playwright";
import { mkdirSync } from "node:fs";

const OUT = new URL("./__screenshots__/", import.meta.url).pathname;
const BASE = process.env.KENKA_E2E_URL ?? "http://localhost:5199";
mkdirSync(OUT, { recursive: true });
const shot = (p, n) => p.screenshot({ path: `${OUT}/s-${n}.png`, fullPage: true });

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const ctx = await browser.newContext({ ...devices["iPhone 13"] });
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push("PAGEERROR: " + e.message));
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));

await page.goto(BASE, { waitUntil: "networkidle" });
await page.waitForTimeout(2000);

// Skip onboarding and seed prior history so "last performance" has something to show.
await page.evaluate(async () => {
  const { db } = await import("/src/db/db.ts");
  await db.settings.put({ key: "onboarded", value: "2026-07-01" });
  await db.sessionDraft.clear();
  const ex = await db.exercises.toArray();
  const pick = (n) => ex.find((e) => e.name === n);
  const group = ["Pompes piquées (pike push-ups)", "Développé militaire haltères"].map(pick);
  const logId = await db.workoutLogs.add({
    date: "2026-07-28", type: "musculation", splitDay: "push", completed: true, feeling: 4,
  });
  for (const e of group) {
    for (let s = 0; s < 3; s++) {
      await db.workoutSets.add({
        workoutLogId: logId, exerciseId: e.id, setIndex: s,
        date: "2026-07-28", reps: 10, weightKg: 8,
      });
    }
  }
});
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(1800);

// ---- start a session ----
await page.goto(`${BASE}/#/physique`, { waitUntil: "networkidle" });
await page.waitForTimeout(1200);
await page.click('button:has-text("Séances")');
await page.waitForTimeout(500);
await page.click('button:has-text("Démarrer")');
await page.waitForTimeout(1200);
// Forcer Push : c'est le jour pour lequel un historique a été semé, donc le seul
// qui permette de vérifier la reprise des charges précédentes.
await page.selectOption('select:near(:text("Séance"))', "push").catch(() => {});
await page.waitForTimeout(1000);
await shot(page, "01-start-modal");
await page.click('button:has-text("Démarrer"):below(:text("Composition"))').catch(async () => {
  await page.locator('.k-btn-primary:has-text("Démarrer")').last().click();
});
await page.waitForTimeout(1500);
await shot(page, "02-session-live");

console.log("ON SESSION SCREEN:", page.url().includes("/seance"));

// ---- tick off sets; rest timer should auto-start ----
const checks = page.locator('button[aria-label*="à valider"]');
console.log("SET CHECKBOXES:", await checks.count());
await checks.nth(0).click();
await page.waitForTimeout(600);
const restRunning = await page.locator('text=/^0[01]:/').count();
console.log("REST TIMER AUTO-STARTED:", restRunning > 0);
await shot(page, "03-set-done-rest-running");

// validating an empty set should adopt last session's numbers
const firstReps = await page.locator('input[aria-label*="série 1 répétitions"]').first().inputValue();
const firstWeight = await page.locator('input[aria-label*="série 1 charge"]').first().inputValue();
console.log("AUTO-FILLED FROM LAST:", { reps: firstReps, weight: firstWeight });

await checks.nth(0).click(); // second remaining set
await page.waitForTimeout(400);

// ---- push a record: beat 8 kg ----
const wPlus = page.locator('button[aria-label*="série 2 charge : augmenter"]').first();
for (let i = 0; i < 6; i++) await wPlus.click();
await page.waitForTimeout(500);
const recordTags = await page.locator('text=/Record/').count();
console.log("RECORD BADGES VISIBLE:", recordTags);
await shot(page, "04-record");

// ---- SIMULATE SAFARI KILLING THE TAB ----
await page.waitForTimeout(700); // let the debounced write land
await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
await page.waitForTimeout(300);

const draftOnDisk = await page.evaluate(async () => {
  const { db } = await import("/src/db/db.ts");
  const d = await db.sessionDraft.get("current");
  return d && {
    splitDay: d.splitDay,
    exercises: d.exercises.length,
    filled: d.exercises.reduce((n, e) => n + e.sets.filter((s) => s.done || s.reps).length, 0),
  };
});
console.log("DRAFT PERSISTED BEFORE KILL:", draftOnDisk);

// Hard reload = the tab was destroyed and reopened
await page.goto(`${BASE}/#/`, { waitUntil: "networkidle" });
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(2000);
await shot(page, "05-after-kill-dashboard");

const resumeVisible = await page.locator('text=/Séance en cours/').count();
console.log("RESUME BANNER AFTER KILL:", resumeVisible > 0);

await page.click('a[href="#/seance"]');
await page.waitForTimeout(1800);
await shot(page, "06-resumed");

const recovered = await page.evaluate(() => {
  const done = document.querySelectorAll('button[aria-label*="validée"]').length;
  const inputs = [...document.querySelectorAll('input[aria-label*="répétitions"]')]
    .map((i) => i.value).filter(Boolean);
  return { doneSets: done, filledReps: inputs.length };
});
console.log("RECOVERED STATE:", recovered);

// ---- finish and verify it lands in history ----
// Terminer ouvre d'abord le débrief : rien n'est écrit tant qu'il n'est pas confirmé.
await page.click('button:has-text("Terminer la séance")');
await page.waitForTimeout(800);

const debrief = await page.evaluate(async () => {
  const { db } = await import("/src/db/db.ts");
  const dialog = document.querySelector('[role="dialog"]');
  return {
    open: !!dialog,
    showsMetrics: !!dialog?.textContent.match(/Durée/),
    // Le débrief ne doit rien avoir enregistré avant confirmation.
    draftStillThere: (await db.sessionDraft.get("current")) !== undefined,
  };
});
console.log("DEBRIEF BEFORE CONFIRM:", debrief);
await shot(page, "06b-debrief");

await page.click('button:has-text("Enregistrer")');
await page.waitForTimeout(2000);

const saved = await page.evaluate(async () => {
  const { db } = await import("/src/db/db.ts");
  const logs = await db.workoutLogs.orderBy("date").reverse().toArray();
  const latest = logs[0];
  const sets = await db.workoutSets.where("workoutLogId").equals(latest.id).toArray();
  const draft = await db.sessionDraft.get("current");
  return {
    savedSets: sets.length,
    duration: latest.durationMin,
    draftCleared: draft === undefined,
  };
});
console.log("AFTER FINISH:", saved);
await shot(page, "07-finished");

// ---- race: finishing immediately after an edit must not resurrect the draft ----
// L'écriture du brouillon est différée : terminer avant son échéance ne doit pas
// laisser l'écriture s'exécuter après la suppression.
await page.goto(`${BASE}/#/physique`, { waitUntil: "networkidle" });
await page.waitForTimeout(1200);
await page.click('button:has-text("Séances")');
await page.waitForTimeout(500);
await page.click('button:has-text("Démarrer")');
await page.waitForTimeout(1000);
await page.locator('.k-btn-primary:has-text("Démarrer")').last().click();
await page.waitForTimeout(1500);

// ---- exercise picker: la recherche doit ignorer les accents ----
// Le sélecteur natif a été remplacé par une recherche maison : si le pliage des
// accents casse, taper « elevations » ne trouve plus « Élévations latérales »
// et l'ajout en cours de séance redevient impraticable.
const exercisesBefore = await page.locator('button[aria-label^="Retirer"]').count();
await page.click('button:has-text("Ajouter un exercice")');
await page.waitForTimeout(600);

const search = page.locator('input[aria-label="Chercher un exercice"]');
const countResults = () => page.locator('[role="dialog"] li').count();

const libraryTotal = await countResults();
await search.fill("elevations");
await page.waitForTimeout(400);
const unaccented = await countResults();
await search.fill("élévations");
await page.waitForTimeout(400);
const accented = await countResults();
await shot(page, "09-picker-search");

await page.locator('[role="dialog"] li button').first().click();
await page.waitForTimeout(700);
const exercisesAfter = await page.locator('button[aria-label^="Retirer"]').count();

console.log("EXERCISE PICKER:", {
  libraryTotal,
  unaccented,
  accented,
  foldingWorks: unaccented > 0 && unaccented === accented,
  added: exercisesAfter - exercisesBefore,
});

await page.locator('button[aria-label*="à valider"]').first().click();
// Aucune attente : on termine dans la fenêtre de l'écriture différée.
await page.click('button:has-text("Terminer la séance")');
await page.click('button:has-text("Enregistrer")');
await page.waitForTimeout(2500);

const zombie = await page.evaluate(async () => {
  const { db } = await import("/src/db/db.ts");
  return { draft: await db.sessionDraft.get("current") };
});
console.log("ZOMBIE DRAFT AFTER FAST FINISH:", zombie.draft === undefined ? "none" : zombie.draft);

// ---- exercise detail: chart, records, next target ----
await page.goto(`${BASE}/#/physique`, { waitUntil: "networkidle" });
await page.waitForTimeout(1200);
await page.click('button:has-text("Exercices")');
await page.waitForTimeout(600);
await page.click('button:has-text("Développé militaire haltères")');
await page.waitForTimeout(1200);
await shot(page, "08-exercise-detail");
const detail = await page.evaluate(() => ({
  hasTarget: !!document.body.textContent.match(/Prochaine séance/),
  hasRecords: !!document.body.textContent.match(/Records/),
}));
console.log("EXERCISE DETAIL:", detail);

console.log("ERRORS:", errors.length ? errors : "none");
await browser.close();
