import { chromium, devices } from "playwright";
import { mkdirSync } from "node:fs";

const OUT = new URL("./__screenshots__/", import.meta.url).pathname;
const BASE = process.env.KENKA_E2E_URL ?? "http://localhost:5199";
mkdirSync(OUT, { recursive: true });
const shot = (p, n) => p.screenshot({ path: `${OUT}/u-${n}.png`, fullPage: true });

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const ctx = await browser.newContext({ ...devices["iPhone 13"] });
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push("PAGEERROR: " + e.message));
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));

await page.goto(BASE, { waitUntil: "networkidle" });
await page.waitForTimeout(1500);
await page.evaluate(async () => {
  const { db } = await import("/src/db/db.ts");
  await db.settings.put({ key: "onboarded", value: "2026-07-01" });
});
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(1800);

// ---- Skill tree ----
await page.click('nav a[href="#/combat"]');
await page.waitForTimeout(1200);
await shot(page, "01-skilltree");

// validate first checkpoint of first branch, verify tree updates
const firstNode = page.locator('button[aria-label*="Palier 1"]').first();
await firstNode.click();
await page.waitForTimeout(500);
await shot(page, "02-skilltree-checked");
const checkedLabel = await firstNode.getAttribute("aria-label");
console.log("FIRST NODE STATE:", checkedLabel);

// ---- Reference gallery ----
await page.click('nav a[href="#/glow-up"]');
await page.waitForTimeout(1000);
await page.click('button:has-text("Coiffure")');
await page.waitForTimeout(700);
await shot(page, "03-reference-empty");

// upload a tiny fake image via file input
const buf = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);
await page.setInputFiles('input[type="file"][accept="image/*"]', {
  name: "ref.png",
  mimeType: "image/png",
  buffer: buf,
});
await page.waitForTimeout(1000);
await shot(page, "04-reference-added");
const thumbCount = await page.locator('button:has(img[alt="Référence"])').count();
console.log("REFERENCE THUMBS:", thumbCount);

// ---- Video demo link ----
await page.click('nav a[href="#/physique"]');
await page.waitForTimeout(1000);
await page.click('button:has-text("Exercices")');
await page.waitForTimeout(600);
await page.click('button:has-text("Développé militaire haltères")');
await page.waitForTimeout(900);
const demoHref = await page.locator('a:has-text("Démo")').first().getAttribute("href");
console.log("DEMO LINK:", demoHref);
await shot(page, "05-exercise-demo-link");

console.log("ERRORS:", errors.length ? errors : "none");
await browser.close();
