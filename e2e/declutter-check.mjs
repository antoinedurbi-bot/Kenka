import { chromium, devices } from "playwright";
import { mkdirSync } from "node:fs";

const OUT = new URL("./__screenshots__/", import.meta.url).pathname;
const BASE = process.env.KENKA_E2E_URL ?? "http://localhost:5199";
mkdirSync(OUT, { recursive: true });
const shot = (p, n) => p.screenshot({ path: `${OUT}/d-${n}.png`, fullPage: true });

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const ctx = await browser.newContext({ ...devices["iPhone 13"] });
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push("PAGEERROR: " + e.message));
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));

await page.goto(BASE, { waitUntil: "networkidle" });
await page.evaluate(async () => {
  const { db } = await import("/src/db/db.ts");
  await db.settings.put({ key: "onboarded", value: "2026-07-01" });
  await db.glowUp.add({ category: "coiffure", title: "Coupe actuelle", content: "Mi-long, attaché en séance, lâché sinon. Retouche toutes les 6 semaines.", order: 1 });
});
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(1200);

await page.goto(`${BASE}/#/glow-up`, { waitUntil: "networkidle" });
await page.waitForTimeout(1000);
await page.click('button:has-text("Coiffure")');
await page.waitForTimeout(700);
await shot(page, "01-glowup-coiffure");

const card = await page.evaluate(() => {
  const t = document.body.textContent;
  return {
    hasKanji: !!document.querySelector('span[aria-hidden]')?.textContent,
    hasPreview: !!t.match(/Retouche toutes/),
  };
});
console.log("GLOWUP CARD:", card);

await page.goto(`${BASE}/#/physique`, { waitUntil: "networkidle" });
await page.waitForTimeout(1000);
await page.click('button:has-text("Volume")');
await page.waitForTimeout(900);
await shot(page, "02-volume");

await page.goto(`${BASE}/#/combat`, { waitUntil: "networkidle" });
await page.waitForTimeout(1000);
await page.click('button:has-text("Analyse")');
await page.waitForTimeout(900);
await shot(page, "03-combat-analyse");

await page.goto(`${BASE}/#/nutrition`, { waitUntil: "networkidle" });
await page.waitForTimeout(1000);
await shot(page, "04-nutrition");

console.log("ERRORS:", errors.length ? errors : "none");
await browser.close();
