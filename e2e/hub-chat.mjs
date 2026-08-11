import { chromium, devices } from "playwright";
import { mkdirSync } from "node:fs";

const OUT = new URL("./__screenshots__/", import.meta.url).pathname;
const BASE = process.env.KENKA_E2E_URL ?? "http://localhost:5199";
mkdirSync(OUT, { recursive: true });
const shot = (p, n) => p.screenshot({ path: `${OUT}/h-${n}.png`, fullPage: true });

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const ctx = await browser.newContext({ ...devices["iPhone 13"] });
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push("PAGEERROR: " + e.message));
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));

await page.goto(BASE, { waitUntil: "networkidle" });
await page.waitForTimeout(1500);

// ---- OpenRouter request/response shape — pure, no network ----
const or = await page.evaluate(async () => {
  const { buildOpenRouterRequest, parseOpenRouterResponse } = await import(
    "/src/lib/openrouter.ts"
  );
  const req = buildOpenRouterRequest("sk-test-123", "anthropic/claude-3.5-haiku", [
    { role: "system", content: "ctx" },
    { role: "user", content: "hello" },
  ]);
  const body = JSON.parse(req.body);

  let threwOnEmpty = false;
  try {
    parseOpenRouterResponse({ choices: [{ message: { content: "" } }] });
  } catch {
    threwOnEmpty = true;
  }
  let threwOnApiError = false;
  try {
    parseOpenRouterResponse({ error: { message: "invalid key" } });
  } catch (e) {
    threwOnApiError = e.message === "invalid key";
  }

  return {
    url: req.url,
    hasAuthHeader: req.headers.Authorization === "Bearer sk-test-123",
    bodyModel: body.model,
    bodyMessages: body.messages.length,
    parsedOk: parseOpenRouterResponse({ choices: [{ message: { content: "Salut." } }] }),
    threwOnEmpty,
    threwOnApiError,
  };
});
console.log("OPENROUTER REQUEST/RESPONSE:", JSON.stringify(or, null, 1));

// ---- unit: dailyTip priority order ----
const tip = await page.evaluate(async () => {
  const { dailyTip } = await import("/src/lib/coaching.ts");
  const base = {
    physique: { level: 0, levelMax: 6, progress: 0, title: "Civil", detail: "" },
    skills: { level: 0, levelMax: 5, progress: 0, title: "Débutant", detail: "" },
    volume: { windowDays: 28, totalSets: 0, byZone: [], prioritySets: 0, counterSets: 0, verdict: "insuffisant", advice: "", neglected: [] },
    combat: { windowDays: 28, sessions: 0, rounds: 0, minutes: 0, byFamily: [], partnerSessions: 0, partnerHealthy: true, sparringSessions: 0, sparringFresh: true, neglected: [], verdict: "insuffisant", advice: "" },
    maintenanceKcal: null,
    recalibration: { available: false },
  };

  const deload = dailyTip(
    { ...base, readiness: { level: "deload", headline: "Décharge conseillée", detail: "d", weekLoad: 7, consecutiveLowFeeling: 3 } },
    ["physique", "combat"],
  );
  const volumeIssue = dailyTip(
    {
      ...base,
      readiness: { level: "ok", headline: "", detail: "", weekLoad: 3, consecutiveLowFeeling: 0 },
      volume: { ...base.volume, verdict: "a-corriger", advice: "trop de pecs" },
    },
    ["physique"],
  );
  const fallback = dailyTip(
    { ...base, readiness: { level: "ok", headline: "", detail: "", weekLoad: 3, consecutiveLowFeeling: 0 } },
    ["physique", "combat"],
  );

  return {
    deloadWins: deload.tone === "blood" && deload.headline === "Décharge conseillée",
    volumeSurfaces: volumeIssue.headline === "Répartition à corriger",
    fallbackHasContent: fallback.headline.length > 0 && fallback.detail.length > 0,
  };
});
console.log("DAILY TIP PRIORITY:", tip);

// ---- rendered: hub shows today's session card + conseil ----
await page.evaluate(async () => {
  const { db } = await import("/src/db/db.ts");
  await db.settings.put({ key: "onboarded", value: "2026-07-01" });
  await db.settings.put({ key: "split", value: { lun: "push", mar: "muaythai", mer: "pull", jeu: "legs", ven: "muaythai", sam: "fullbody", dim: "mobilite" } });
});
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(1500);
await shot(page, "01-hub");

const hub = await page.evaluate(() => ({
  hasToday: !!document.body.textContent.match(/Aujourd'hui/),
  hasConseil: !!document.body.textContent.match(/Conseil/),
  hasChatTile: !!document.querySelector('a[href="#/chat"]'),
  hasNutritionTile: !!document.querySelector('a[href="#/nutrition"]'),
}));
console.log("HUB CONTENT:", hub);

// ---- chat without a key configured: setup prompt, no crash ----
await page.goto(`${BASE}/#/chat`, { waitUntil: "networkidle" });
await page.waitForTimeout(1000);
const noKeyState = await page.evaluate(() => ({
  hasSetupPrompt: !!document.body.textContent.match(/Aucune clé API/),
  hasTextarea: !!document.querySelector("textarea"),
}));
console.log("CHAT WITHOUT KEY:", noKeyState);
await shot(page, "02-chat-no-key");

// ---- settings: API key persists and chat unlocks ----
await page.goto(`${BASE}/#/reglages`, { waitUntil: "networkidle" });
await page.waitForTimeout(1000);
await page.fill('input[placeholder="sk-or-…"]', "sk-or-test-key");
await page.locator('input[placeholder="sk-or-…"]').blur();
await page.waitForTimeout(500);
await shot(page, "03-settings-ai");

const stored = await page.evaluate(async () => {
  const { db } = await import("/src/db/db.ts");
  const k = await db.settings.get("openrouterApiKey");
  return k?.value;
});
console.log("API KEY STORED:", stored);

await page.goto(`${BASE}/#/chat`, { waitUntil: "networkidle" });
await page.waitForTimeout(1000);
const withKeyState = await page.evaluate(() => ({
  hasTextarea: !!document.querySelector("textarea"),
  hasSetupPrompt: !!document.body.textContent.match(/Aucune clé API/),
}));
console.log("CHAT WITH KEY:", withKeyState);
await shot(page, "04-chat-with-key");

console.log("ERRORS:", errors.length ? errors : "none");
await browser.close();
