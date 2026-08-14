import { chromium, devices } from "playwright";
import { mkdirSync } from "node:fs";

const OUT = new URL("./__screenshots__/", import.meta.url).pathname;
const BASE = process.env.KENKA_E2E_URL ?? "http://localhost:5199";
mkdirSync(OUT, { recursive: true });
const shot = (p, n) => p.screenshot({ path: `${OUT}/f-${n}.png` });

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const ctx = await browser.newContext({ ...devices["iPhone 13"] });
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push("PAGEERROR: " + e.message));
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));

await page.goto(BASE, { waitUntil: "networkidle" });
await page.waitForTimeout(1500);

// ---- unit: tri, entrelacement, masquage ----
const unit = await page.evaluate(async () => {
  const { buildFeed, SEEN_COOLDOWN_DAYS } = await import("/src/lib/feed.ts");
  const { volumeReport } = await import("/src/lib/volume.ts");
  const { combatReport } = await import("/src/lib/combatReport.ts");
  const day = (back) => {
    const d = new Date();
    d.setDate(d.getDate() - back);
    return d.toISOString().slice(0, 10);
  };

  const exercises = [
    // Jamais loggé → carte "jamais testé".
    { id: 1, name: "Tirage nuque", type: "musculation", zones: ["dos"], priority: "primaire", equipment: [], splitDays: [], defaultReps: "8-12" },
    // Trois séances identiques → stagnation, donc carte "levier".
    { id: 2, name: "Développé militaire", type: "musculation", zones: ["epaules"], priority: "primaire", equipment: [], splitDays: [], defaultReps: "8-12" },
    // Loggé il y a longtemps → carte "sorti du programme".
    { id: 3, name: "Curl marteau", type: "musculation", zones: ["bras"], priority: "secondaire", equipment: [], splitDays: [], defaultReps: "8-12" },
  ];

  const sets = [];
  for (const back of [1, 4, 7]) {
    for (let i = 0; i < 3; i++) {
      sets.push({ workoutLogId: 1, exerciseId: 2, setIndex: i, date: day(back), reps: 10, weightKg: 10 });
    }
  }
  sets.push({ workoutLogId: 2, exerciseId: 3, setIndex: 0, date: day(90), reps: 10, weightKg: 8 });

  const base = {
    exercises,
    sets,
    combatLogs: [],
    mobilityLogs: [],
    photos: [],
    weights: [],
    volume: volumeReport(sets, exercises, 28),
    combat: combatReport([], 28),
    enabled: ["physique", "combat", "nutrition", "photos", "glow-up"],
    seen: {},
  };

  const cards = buildFeed(base);
  const ids = cards.map((c) => c.id);

  // Une section masquée ne doit produire aucune carte de cette section.
  const physiqueOff = buildFeed({ ...base, enabled: ["nutrition"] });

  // Le masquage tient, puis expire.
  const hiddenRecent = buildFeed({ ...base, seen: { "neuf-1": day(2) } });
  const hiddenOld = buildFeed({ ...base, seen: { "neuf-1": day(SEEN_COOLDOWN_DAYS + 1) } });

  // Deux cartes perso pour une carte écrite, en tête de flux.
  const firstThree = cards.slice(0, 3).map((c) => c.personal);

  // Le plafond par type doit rester stable sur la journée mais changer de
  // jour en jour : sinon on revoit exactement les mêmes cartes indéfiniment.
  const sameDayAgain = buildFeed(base).map((c) => c.id).join(",");
  const otherDay = buildFeed({ ...base, today: day(-3) }).map((c) => c.id).join(",");

  return {
    total: cards.length,
    hasJamaisTeste: ids.includes("neuf-1"),
    hasLevier: ids.includes("levier-2"),
    hasDelaisse: ids.includes("delaisse-3"),
    firstIsPersonal: cards[0]?.personal === true,
    interleavePattern: firstThree,
    everyCardHasBody: cards.every((c) => c.body.length > 40),
    physiqueOffHasNoMuscuCard: !physiqueOff.some((c) => c.id.startsWith("neuf-") || c.id.startsWith("levier-")),
    hiddenIsGone: !hiddenRecent.some((c) => c.id === "neuf-1"),
    hiddenComesBack: hiddenOld.some((c) => c.id === "neuf-1"),
    stableWithinDay: sameDayAgain === ids.join(","),
    rotatesBetweenDays: otherDay !== sameDayAgain,
  };
});
console.log("FEED UNIT:", JSON.stringify(unit, null, 1));

// ---- seed des données réelles pour l'écran ----
await page.evaluate(async () => {
  const { db } = await import("/src/db/db.ts");
  await db.settings.put({ key: "onboarded", value: "2026-07-01" });
  const day = (back) => {
    const d = new Date();
    d.setDate(d.getDate() - back);
    return d.toISOString().slice(0, 10);
  };
  const ex = await db.exercises.toArray();
  const target = ex.find((e) => e.type === "musculation");
  if (target) {
    // Trois séances strictement identiques : c'est la définition de la stagnation.
    for (const back of [2, 5, 9]) {
      const logId = await db.workoutLogs.add({
        date: day(back), type: "musculation", splitDay: "push", completed: true,
      });
      for (let s = 0; s < 3; s++) {
        await db.workoutSets.add({
          workoutLogId: logId, exerciseId: target.id, setIndex: s,
          date: day(back), reps: 12, weightKg: 10,
        });
      }
    }
  }
  await db.combatLogs.add({
    date: day(3), kind: "sac", durationMin: 40, rounds: 6, techniques: ["Jab", "Low kick"],
  });
});
// Un simple changement de hash ne recharge pas le document : sans ce reload,
// App garderait l'état « pas encore onboardé » lu avant l'insertion.
await page.goto(`${BASE}/#/decouvrir`);
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(1800);
await shot(page, "01-first-card");

const first = await page.evaluate(() => {
  const art = document.querySelector("article[data-kind]");
  return {
    cardCount: document.querySelectorAll("article[data-kind]").length,
    kind: art?.getAttribute("data-kind"),
    hasCounter: /\d+ \/ \d+/.test(document.body.textContent),
    hasPersonalBadge: /tes données/.test(document.body.textContent),
  };
});
console.log("FEED SCREEN:", first);

// ---- une carte occupe exactement un écran, et le défilement se cale dessus ----
const snap = await page.evaluate(async () => {
  const el = document.querySelector('[data-testid="feed-scroller"]');
  const card = document.querySelector("article[data-kind]");
  const before = el.scrollTop;
  el.scrollBy({ top: el.clientHeight, behavior: "instant" });
  await new Promise((r) => setTimeout(r, 600));
  return {
    cardFillsViewport: Math.abs(card.getBoundingClientRect().height - el.clientHeight) < 2,
    scrolledOneScreen: Math.abs(el.scrollTop - before - el.clientHeight) < 4,
  };
});
await page.waitForTimeout(400);
await shot(page, "02-second-card");
console.log("FEED SNAP:", snap);

const counter = await page.evaluate(() => {
  const m = document.body.textContent.match(/(\d+) \/ (\d+)/);
  return m ? { current: Number(m[1]), total: Number(m[2]) } : null;
});
console.log("FEED COUNTER AFTER SCROLL:", counter);

// ---- masquer retire la carte et persiste ----
// Le plafond par type réattribue le créneau libéré : le nombre total de
// cartes ne bouge pas, donc c'est bien la disparition de CETTE carte qu'il
// faut vérifier, pas un compteur.
const hiddenTitle = await page.locator("article[data-kind] h2").first().textContent();
await page.locator('button:has-text("Masquer")').first().click();
await page.waitForTimeout(900);
const titles = () =>
  page.locator("article[data-kind] h2").allTextContents();
const afterHide = await titles();

await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(1800);
const afterReload = await titles();
console.log("FEED HIDE:", {
  hiddenTitle,
  removed: !afterHide.includes(hiddenTitle),
  persistsAcrossReload: !afterReload.includes(hiddenTitle),
  refilled: afterHide.length === afterReload.length,
});

// ---- l'action « fiche exercice » ouvre la fiche sans quitter le flux ----
const openedDetail = await page.evaluate(async () => {
  const buttons = [...document.querySelectorAll("button")].filter(
    (b) => b.textContent.trim() === "Voir la fiche",
  );
  if (buttons.length === 0) return "aucune carte exercice";
  buttons[0].click();
  await new Promise((r) => setTimeout(r, 800));
  return {
    modalOpen: /Records|Prochaine séance|Prochain objectif/.test(document.body.textContent),
    stillOnFeed: location.hash.includes("decouvrir"),
  };
});
await shot(page, "03-exercise-detail");
console.log("FEED ACTION:", openedDetail);

// ---- la tuile du hub mène bien au flux ----
await page.goto(BASE, { waitUntil: "networkidle" });
await page.waitForTimeout(1200);
await page.click('text=Découvrir');
await page.waitForTimeout(1200);
console.log("HUB TILE:", { landsOnFeed: page.url().includes("decouvrir") });

console.log("ERRORS:", errors.length ? errors : "none");
await browser.close();
