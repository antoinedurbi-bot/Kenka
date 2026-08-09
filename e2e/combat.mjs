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

// ---- 1. Unit-level: the report must name what is missing ----
// Un mois de sac où l'on ne coche que des frappes : c'est le cas que l'onglet
// existe pour attraper, donc celui qu'il faut vérifier.
const verdicts = await page.evaluate(async () => {
  const { combatReport } = await import("/src/lib/combatReport.ts");
  const day = (back) => {
    const d = new Date();
    d.setDate(d.getDate() - back);
    return d.toISOString().slice(0, 10);
  };

  const strikesOnly = [0, 3, 6, 9, 12].map((b) => ({
    date: day(b), kind: "sac", rounds: 5, durationMin: 40,
    techniques: ["Jab", "Direct", "Low kick"],
  }));

  const balanced = [0, 3, 6, 9, 12].map((b) => ({
    date: day(b), kind: b % 6 === 0 ? "sparring" : "club", rounds: 5, durationMin: 90,
    techniques: ["Jab", "Esquive", "Déplacements"],
  }));

  const r1 = combatReport(strikesOnly, 28);
  const r2 = combatReport(balanced, 28);
  const r3 = combatReport(strikesOnly.slice(0, 2), 28);

  return {
    strikesOnly: { verdict: r1.verdict, neglected: r1.neglected, sparring: r1.daysSinceSparring },
    balanced: { verdict: r2.verdict, neglected: r2.neglected, partner: r2.partnerSessions },
    // Une famille est comptée par séance, pas par technique cochée.
    poingsSessions: r1.byFamily.find((f) => f.family === "poings").sessions,
    tooFew: r3.verdict,
    // Hors fenêtre : un vieux log ne doit plus peser dans la répartition…
    outsideWindow: combatReport([{ ...strikesOnly[0], date: day(60) }], 28).sessions,
    // … mais « dernier sparring il y a 60 jours » doit rester visible.
    staleSparringStillSeen: combatReport(
      [{ date: day(60), kind: "sparring", techniques: [] }], 28,
    ).daysSinceSparring,
  };
});
console.log("COMBAT REPORT:", JSON.stringify(verdicts, null, 1));

// ---- 2. Seed real logs and render the tab ----
await page.evaluate(async () => {
  const { db } = await import("/src/db/db.ts");
  await db.settings.put({ key: "onboarded", value: "2026-07-01" });
  await db.combatLogs.clear();
  const day = (back) => {
    const d = new Date();
    d.setDate(d.getDate() - back);
    return d.toISOString().slice(0, 10);
  };
  for (const b of [1, 4, 8, 11, 15, 18]) {
    await db.combatLogs.add({
      date: day(b),
      kind: b === 4 ? "sparring" : b % 2 === 0 ? "sac" : "club",
      durationMin: 90,
      rounds: 6,
      intensity: 3,
      techniques: b % 3 === 0 ? ["Jab", "Direct", "Esquive"] : ["Jab", "Low kick", "Crochet"],
    });
  }
});
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(1800);

await page.goto(`${BASE}/#/combat`, { waitUntil: "networkidle" });
await page.waitForTimeout(1200);
await page.click('button:has-text("Analyse")');
await page.waitForTimeout(1200);
await page.screenshot({ path: `${OUT}/combat-analysis.png`, fullPage: true });

const rendered = await page.evaluate(() => {
  const t = document.body.textContent;
  return {
    hasVerdict: /Aligné|À corriger/.test(t),
    hasFamilies: /Déplacements/.test(t) && /Clinch/.test(t),
    hasSparringRow: /Dernier sparring/.test(t),
    bars: document.querySelectorAll('[style*="width"]').length > 0,
  };
});
console.log("ANALYSIS TAB:", rendered);

// ---- 3. The log form must prefill duration from the last session of that kind ----
await page.click('button:has-text("Séances")');
await page.waitForTimeout(600);
await page.click('button:has-text("Logger une séance")');
await page.waitForTimeout(800);
await page.click('[role="dialog"] button:has-text("Club")');
await page.waitForTimeout(900);
const prefill = await page.evaluate(() => {
  const inputs = [...document.querySelectorAll('[role="dialog"] input[type="number"]')];
  return { duration: inputs[0]?.value, rounds: inputs[1]?.value };
});
console.log("PREFILL FROM LAST CLUB SESSION:", prefill);

// Les familles doivent structurer les cases à cocher, pas une liste plate.
const grouped = await page.evaluate(() => {
  const labels = [...document.querySelectorAll('[role="dialog"] .k-label')].map((e) => e.textContent);
  return labels.filter((l) => /Poings|Jambes|Défense|Déplacements|Clinch/.test(l));
});
console.log("TECHNIQUE GROUPS:", grouped);
await page.screenshot({ path: `${OUT}/combat-log-form.png`, fullPage: true });

console.log("ERRORS:", errors.length ? errors : "none");
await browser.close();
