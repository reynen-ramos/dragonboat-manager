/**
 * Renders the app icons from one SVG source.
 *
 * The manifest needs real PNGs, and Chromium is already available for the
 * end-to-end checks, so it does the rasterising rather than pulling in an image
 * library. Run with `node scripts/make-icons.mjs` after changing the mark.
 */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const OUT_DIR = path.resolve(import.meta.dirname, '../public');
const BRAND = '#0f766e';

/** The wordmark's dragon boat, on a filled tile so it reads as an app icon. */
const icon = (size) => `
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24">
  <rect width="24" height="24" rx="5" fill="${BRAND}"/>
  <path d="M2 15c2.5 0 2.5-2 5-2s2.5 2 5 2 2.5-2 5-2 2.5 2 5 2"
        fill="none" stroke="#ffffff" stroke-width="1.6" stroke-linecap="round" opacity="0.75"/>
  <path d="M4 11h13c2 0 3-1.2 3-2.5S18.8 6 17 6h-1.5C14 6 13 7 11 7H6c-1.5 0-2 1-2 2z"
        fill="#ffffff"/>
</svg>`;

await mkdir(OUT_DIR, { recursive: true });

// The favicon stays vector — it scales to whatever the browser asks for.
await writeFile(path.join(OUT_DIR, 'favicon.svg'), `${icon(24).trim()}\n`);

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium',
});

for (const size of [192, 512]) {
  const page = await browser.newPage({ viewport: { width: size, height: size } });
  await page.setContent(
    `<body style="margin:0">${icon(size).replace('width="' + size + '"', `width="${size}"`)}</body>`,
  );
  await page.screenshot({ path: path.join(OUT_DIR, `icon-${size}.png`), omitBackground: true });
  await page.close();
  console.log(`wrote public/icon-${size}.png`);
}

await browser.close();
console.log('wrote public/favicon.svg');
