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

// Decocher Combat et Photos : l'app doit s'ouvrir plus légère, pas juste avec
// une préférence enregistrée qui ne change rien à l'affichage.
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

await shot(page, "11-dashboard-trimmed");

const nav = await page.evaluate(() => {
  return [...document.querySelectorAll("nav a")].map((a) => a.textContent.trim());
});
console.log("BOTTOM NAV ITEMS:", nav);

// Direct URL to a hidden section must bounce home, not render a dangling screen.
await page.goto(`${BASE}/#/combat`, { waitUntil: "networkidle" });
await page.waitForTimeout(1000);
console.log("DIRECT URL TO HIDDEN SECTION REDIRECTS HOME:", page.url().endsWith("/#/"));

// Re-enable Combat from Réglages ; the nav must pick it up without a reload.
await page.goto(`${BASE}/#/reglages`, { waitUntil: "networkidle" });
await page.waitForTimeout(1000);
await page.click('button[aria-pressed]:has-text("Combat")');
await page.waitForTimeout(500);
await shot(page, "12-settings-sections");

const navAfterToggle = await page.evaluate(() => {
  return [...document.querySelectorAll("nav a")].map((a) => a.textContent.trim());
});
console.log("BOTTOM NAV AFTER RE-ENABLING COMBAT:", navAfterToggle);

console.log("ERRORS:", errors.length ? errors : "none");
await browser.close();
