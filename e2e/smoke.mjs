import { chromium, devices } from "playwright";
import { mkdirSync } from "node:fs";

const OUT = new URL("./__screenshots__/", import.meta.url).pathname;
const BASE = process.env.KENKA_E2E_URL ?? "http://localhost:5199";
mkdirSync(OUT, { recursive: true });
const shot = (p, n) => p.screenshot({ path: `${OUT}/v2-${n}.png`, fullPage: true });

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const ctx = await browser.newContext({ ...devices["iPhone 13"] });
const page = await ctx.newPage();
const errors = [];
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
page.on("pageerror", (e) => errors.push("PAGEERROR: " + e.message));

await page.goto(BASE, { waitUntil: "networkidle" });
await page.waitForTimeout(1500);

// ---------- ONBOARDING ----------
await shot(page, "01-onboarding");
await page.click('button:has-text("Continuer")');
await page.waitForTimeout(400);
await page.fill('input[placeholder="63"]', "63");
const cm = page.locator('input[step="0.5"]');
await cm.nth(0).fill("74");  // taille
await cm.nth(1).fill("37");  // cou
await cm.nth(2).fill("112"); // épaules
await cm.nth(3).fill("33");  // bras
await page.waitForTimeout(400);
await shot(page, "02-onboarding-mesures");
await page.click('button:has-text("Continuer")');
await page.waitForTimeout(400);
await shot(page, "03-onboarding-guide");
await page.click('button:has-text("Commencer")');
await page.waitForTimeout(1500);
await shot(page, "04-dashboard");

// ---------- Le déroulé d'une séance est couvert par e2e/session.mjs ----------
await page.click('a[href="#/physique"]');
await page.waitForTimeout(700);

// ---------- VOLUME ----------
await page.click('button:has-text("Volume")');
await page.waitForTimeout(900);
await shot(page, "11-volume");

// ---------- NUTRITION ----------
// Nutrition a sa propre tuile depuis le hub, plus une route dédiée.
await page.goto(`${BASE}/#/nutrition`, { waitUntil: "networkidle" });
await page.waitForTimeout(800);
await shot(page, "12-nutrition");
const kcalPlus = page.locator('button[aria-label="Apport calorique du jour : augmenter"]');
for (let k = 0; k < 5; k++) await kcalPlus.click();
await page.waitForTimeout(300);
await page.locator('button:has-text("OK")').last().click();
await page.waitForTimeout(700);
await shot(page, "13-nutrition-logged");

// ---------- MEASURES ----------
await page.goto(`${BASE}/#/physique`, { waitUntil: "networkidle" });
await page.waitForTimeout(700);
await page.click('button:has-text("Mesures")');
await page.waitForTimeout(800);
await page.click('button:has-text("Protocole de mesure")');
await page.waitForTimeout(400);
await shot(page, "14-measures-protocol");

// ---------- MOBILITY ----------
// Pas de barre de navigation entre sections : on repasse par le hub.
await page.click('header a[href="#/"]');
await page.waitForTimeout(600);
await page.click('a[href="#/glow-up"]');
await page.waitForTimeout(800);
await shot(page, "15-mobility");
await page.locator('button:has-text("Relever")').first().click();
await page.waitForTimeout(600);
await page.locator('input[step="0.5"]').last().fill("35");
await page.waitForTimeout(200);
await shot(page, "16-mobility-modal");
await page.click('button:has-text("Enregistrer")');
await page.waitForTimeout(800);
await shot(page, "17-mobility-saved");

// ---------- SETTINGS / STORAGE ----------
await page.click('header a[href="#/reglages"]');
await page.waitForTimeout(900);
await shot(page, "18-settings");

console.log("ERRORS:", errors.length ? errors : "none");
await browser.close();
