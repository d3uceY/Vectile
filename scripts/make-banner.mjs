// Generates docs/vectile-banner.svg — the README hero banner.
//
// The banner is drawn in the app's "field notebook" world: paper ground,
// graph-paper dots, hairline borders, one leaf-green accent, a serif-italic
// tagline, and mono data lines. The app logo is embedded as a resized inline
// PNG so the banner is fully self-contained (renders on GitHub, no repo
// cross-references) and always matches the real icon.
//
// Run:  node scripts/make-banner.mjs

import { createRequire } from "node:module";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

// playwright is installed alongside the screenshot-skill scripts, not in this
// repo — resolve it from there (dev-only asset generator).
const require = createRequire(
  "C:/Users/deuce/.copilot/skills/screenshot-skill/scripts/capture.mjs",
);
const { chromium } = require("playwright");

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const logoPath = path.join(root, "frontend", "public", "vectile-logo.png");
const outPath = path.join(root, "docs", "vectile-banner.svg");
const LOGO_TILE = 160; // render the 500px logo down to 160 for the inline PNG (shown at 88px)

const png = await readFile(logoPath);
const b64 = png.toString("base64");

// Resize the logo via a canvas so the embedded PNG stays lean.
const browser = await chromium.launch();
const page = await browser.newPage();
// Canvas must match the drawn size, or toDataURL exports a larger PNG with the
// logo crammed into the top-left and a transparent region to the right/bottom.
await page.setContent(
  `<canvas id="c" width="${LOGO_TILE}" height="${LOGO_TILE}"></canvas>`,
);
const dataUri = await page.evaluate(
  ({ b64, size }) => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const c = document.getElementById("c");
        const ctx = c.getContext("2d");
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(img, 0, 0, size, size);
        resolve(c.toDataURL("image/png"));
      };
      img.onerror = reject;
      img.src = "data:image/png;base64," + b64;
    });
  },
  { b64, size: LOGO_TILE },
);
await browser.close();

const sans = "'Instrument Sans', -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
const serif = "'Instrument Serif', Georgia, 'Times New Roman', serif";
const mono = "'IBM Plex Mono', ui-monospace, 'SF Mono', 'Cascadia Mono', Consolas, monospace";

const svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="1440" height="500" viewBox="0 0 1440 500" role="img" aria-label="vectile — your private library">
  <defs>
    <pattern id="dots" width="20" height="20" patternUnits="userSpaceOnUse">
      <circle cx="1.25" cy="1.25" r="1.25" fill="#1b2226" opacity="0.06"/>
    </pattern>
    <clipPath id="logo-clip"><rect x="72" y="206" width="88" height="88" rx="14"/></clipPath>
  </defs>

  <!-- paper ground + graph-paper dots -->
  <rect width="1440" height="500" fill="#fbfcff"/>
  <rect width="1440" height="500" fill="url(#dots)"/>

  <!-- hairline frame -->
  <rect x="0.5" y="0.5" width="1439" height="499" fill="none" stroke="#e4e8ec"/>

  <!-- logo tile: mint fill, the real mark on top, hairline border -->
  <g clip-path="url(#logo-clip)">
    <rect x="72" y="206" width="88" height="88" fill="#e5f6ec"/>
    <image x="72" y="206" width="88" height="88" preserveAspectRatio="xMidYMid meet"
           href="${dataUri}" xlink:href="${dataUri}"/>
  </g>
  <rect x="72" y="206" width="88" height="88" rx="14" fill="none" stroke="#d1d8de"/>

  <!-- wordmark -->
  <text x="184" y="252" font-family="${sans}" font-size="46" font-weight="700" letter-spacing="-1.2" fill="#1b2226">vectile</text>

  <!-- serif-italic tagline + leaf underscore -->
  <text x="187" y="301" font-family="${serif}" font-style="italic" font-size="23" fill="#56616b">your private library</text>
  <rect x="190" y="316" width="42" height="3" rx="1.5" fill="#1f8a50"/>

  <!-- vertical hairline between the lockup and the data block -->
  <line x1="1000" y1="128" x2="1000" y2="372" stroke="#e4e8ec"/>

  <!-- right data block: all local + mono notes -->
  <circle cx="1140" cy="150" r="4" fill="#1f8a50"/>
  <text x="1154" y="155" font-family="${mono}" font-size="15" fill="#56616b">all local</text>

  <text x="1140" y="225" font-family="${mono}" font-size="15" fill="#66707a">hybrid search — vector + full-text</text>
  <text x="1140" y="253" font-family="${mono}" font-size="15" fill="#66707a">bge-m3 embeddings, in-process</text>
  <text x="1140" y="281" font-family="${mono}" font-size="15" fill="#66707a">nothing leaves this machine</text>

  <text x="1140" y="360" font-family="${mono}" font-size="13" fill="#66707a">jump to search · ⌘K</text>
</svg>
`;

await mkdir(path.dirname(outPath), { recursive: true });
await writeFile(outPath, svg, "utf-8");
console.log(`wrote ${outPath} (${(svg.length / 1024).toFixed(1)} KB)`);
