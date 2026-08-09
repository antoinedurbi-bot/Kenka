import sharp from "sharp";
import { mkdirSync } from "node:fs";

mkdirSync("public/icons", { recursive: true });

const src = "scripts/icon-source.svg";

const sizes = [
  ["icon-192.png", 192],
  ["icon-512.png", 512],
  ["icon-maskable-512.png", 512],
  ["apple-touch-icon.png", 180],
];

for (const [name, size] of sizes) {
  await sharp(src, { density: 384 }).resize(size, size).png().toFile(`public/icons/${name}`);
  console.log("wrote", name);
}
