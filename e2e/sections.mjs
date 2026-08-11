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

// Fresh DB, no seeding: this is the real first-launch path, onboarding included.
await page.goto(BASE, { waitUntil: "networkidle" });
await page.evaluate(async () => {
  const { db } = await import("/src/db/db.ts");
  await db.delete();
});
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(1500);

const onOnboarding = await page.locator("text=/Choisis tes axes/").count();
console.log("ONBOARDING SHOWS AXES STEP:", onOnboarding > 0);
await shot(page, "10-onboarding-axes");

// Decocher Combat et Photos.
await page.click('button[aria-pressed]:has-text("Combat")');
await page.click('button[aria-pressed]:has-text("Photos")');
await page.waitForTimeout(300);
await page.click('button:has-text("Continuer")');
await page.waitForTimeout(600);
await page.click('button:has-text("Passer — je mesurerai plus tard")').catch(async () => {
  await page.click('button:has-text("Continuer")');
  await page.waitForTimeout(400);
  await page.click('button:has-text("Commencer")');
});
await page.waitForTimeout(1500);

const stored = await page.evaluate(async () => {
  const { db } = await import("/src/db/db.ts");
  const s = await db.settings.get("enabledSections");
  return s?.value;
});
console.log("ENABLED SECTIONS AFTER ONBOARDING:", stored);

// L'app doit s'ouvrir directement sur le hub — pas sur un tableau de bord.
const onHub = await page.locator("text=/Qu'est-ce qu'on fait/").count();
console.log("LANDS ON HUB AFTER ONBOARDING:", onHub > 0);
await shot(page, "11-hub-trimmed");

const tiles = await page.evaluate(() => {
  return [...document.querySelectorAll("a[href^='#/']")].map((a) => a.textContent.trim());
});
console.log("HUB TILES:", tiles);

// Un tap sur une tuile doit atterrir directement dans la section, pas dans un
// tableau de bord intermédiaire.
await page.click("text=Muscu");
await page.waitForTimeout(900);
console.log("TILE TAP LANDS ON SECTION:", page.url().endsWith("/#/physique"));
await shot(page, "12-physique-from-hub");

// Depuis une section, le seul chemin retour est le bouton explicite.
const backButton = await page.locator('header a[href="#/"]:has-text("Sections")').count();
console.log("BACK TO HUB BUTTON PRESENT:", backButton > 0);
await page.click('header a[href="#/"]');
await page.waitForTimeout(600);
console.log("BACK BUTTON RETURNS TO HUB:", page.url().endsWith("/#/"));

// Direct URL to a hidden section must bounce to the hub, not render a dangling screen.
await page.goto(`${BASE}/#/combat`, { waitUntil: "networkidle" });
await page.waitForTimeout(1000);
console.log("DIRECT URL TO HIDDEN SECTION REDIRECTS TO HUB:", page.url().endsWith("/#/"));

// Re-enable Combat from Réglages ; the hub must pick it up without a reload.
await page.goto(`${BASE}/#/reglages`, { waitUntil: "networkidle" });
await page.waitForTimeout(1000);
await page.click('button[aria-pressed]:has-text("Combat")');
await page.waitForTimeout(500);
await shot(page, "13-settings-sections");

await page.click('header a[href="#/"]');
await page.waitForTimeout(600);
const tilesAfterToggle = await page.evaluate(() => {
  return [...document.querySelectorAll("a[href^='#/']")].map((a) => a.textContent.trim());
});
console.log("HUB TILES AFTER RE-ENABLING COMBAT:", tilesAfterToggle);

// Base reste accessible comme une tuile parmi les autres, pas comme l'accueil.
console.log("BASE IS A TILE, NOT THE HOME ROUTE:", tilesAfterToggle.some((t) => t.includes("Base")));

console.log("ERRORS:", errors.length ? errors : "none");
await browser.close();
