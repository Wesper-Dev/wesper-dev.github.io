// Default share images (contract lot 4, Q6; decision S2): one per language, public/og-arbre-en.jpg and
// public/og-arbre-fr.jpg (1200×630 JPEG, < 300 kB each). Run from site/ without arguments: node scripts/share-image.mjs.
// Each is a capture of the tree of the home page of its language, with the name and the professional title (jobTitle
// of content/experiences.ts) set over the left third, in the hierarchy of the home header: name in Inter Tight 500
// and --ink, title in IBM Plex Mono capitals and --muted. No other text, no logo.
// Fixed for reproducibility: default palette and seed (no query string), Halo backdrop, reduced motion (the tree is
// drawn fully grown and the scene does not move), viewport 1200×702 at DPR 1 (the tree block is then exactly
// 1200×630 under the 72 px header), fonts loaded, then a pause. Every text, label and control of the page over the
// block is removed or hidden before the scene starts. The text block is centred on the height of the tree, measured on
// a first capture without text, then corrected on the ink actually drawn. The script refuses to write when a site font
// did not load (no fallback font in a capture), and writes the two images only once both captures succeeded.
// Serves dist/client (built first if absent) on a free loopback port, never 4173 (the owner's preview server).
// Playwright is not a dependency of the site: it is looked up in LOT4_OUTILS, NODE_PATH, then
// ../tmp/refonte-arbre/outils/node_modules (repository layout).
// Next to this script it also writes og-arbre.json (palette, seed, and for each image its name and the SHA-256 of the
// JPEG): npm test checks it against DEFAULT_PALETTE, DEFAULT_SEED and the two images of public/, so a palette change
// without new images fails (audit Fable C6). Kept in scripts/, outside public/, so it never enters the export.
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, writeFileSync } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { homedir } from 'node:os';
import { delimiter, extname, join, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { DEFAULT_PALETTE } from '../content/palettes.ts';
import { DEFAULT_SEED } from '../lib/tree/skeleton.ts';
import { jobTitle } from '../content/experiences.ts';

const site = fileURLToPath(new URL('..', import.meta.url));
const root = join(site, 'dist', 'client');
// The two file names are written in full (npm test and verif-4 look them up in this script).
const IMAGES = [
  { file: 'og-arbre-en.jpg', path: '/', title: jobTitle.en },
  { file: 'og-arbre-fr.jpg', path: '/fr/', title: jobTitle.fr },
];
const sidecar = join(site, 'scripts', 'og-arbre.json');
const SIZE = { width: 1200, height: 630 };
const HEADER = 72;
// Text over the left third (x < 400): left edge, sizes and gap between the two lines.
const TEXT = { left: 72, name: 46, title: 22, gap: 14, maxRight: 380 };
const HIDE = '.tree-ui,.tree-copy,.tree-fallback,.tree-atelier{display:none!important}.tree-labels,[data-tree-tip]{visibility:hidden!important}';

function findPlaywright() {
  const dirs = [process.env.LOT4_OUTILS, ...(process.env.NODE_PATH ?? '').split(delimiter), join(site, '..', 'tmp', 'refonte-arbre', 'outils', 'node_modules'), join(site, 'node_modules')].filter(Boolean);
  for (const d of dirs) {
    const f = join(d, 'playwright', 'index.mjs');
    if (existsSync(f)) return f;
  }
  throw new Error(`Playwright not found in ${dirs.join(', ')}`);
}

// Chromium expected by Playwright, else the newest Chromium of the Playwright cache.
function cachedChromium() {
  const cache = process.env.PLAYWRIGHT_BROWSERS_PATH ?? (process.platform === 'darwin' ? join(homedir(), 'Library', 'Caches', 'ms-playwright') : join(homedir(), '.cache', 'ms-playwright'));
  if (!existsSync(cache)) return undefined;
  const dirs = readdirSync(cache).filter((d) => /^chromium-\d+$/.test(d)).sort((a, b) => Number(b.split('-')[1]) - Number(a.split('-')[1]));
  for (const d of dirs) {
    for (const exe of [
      join(cache, d, 'chrome-mac-arm64', 'Google Chrome for Testing.app', 'Contents', 'MacOS', 'Google Chrome for Testing'),
      join(cache, d, 'chrome-mac', 'Google Chrome for Testing.app', 'Contents', 'MacOS', 'Google Chrome for Testing'),
      join(cache, d, 'chrome-linux', 'chrome'),
      join(cache, d, 'chrome-linux64', 'chrome'),
    ]) if (existsSync(exe)) return exe;
  }
  return undefined;
}

const mime = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.rsc': 'text/x-component' };
function serve() {
  const server = createServer(async (req, res) => {
    const path = decodeURIComponent(new URL(req.url, 'http://127.0.0.1').pathname);
    let file = resolve(root, '.' + path);
    if (!file.startsWith(resolve(root) + sep) && file !== resolve(root)) return res.writeHead(403).end();
    try {
      if ((await stat(file)).isDirectory()) file = join(file, 'index.html');
      const data = await readFile(file);
      res.writeHead(200, { 'Content-Type': mime[extname(file)] ?? 'application/octet-stream' }).end(data);
    } catch {
      res.writeHead(404).end();
    }
  });
  const wanted = Number(process.env.PORTFOLIO_PORT);
  const port = Number.isInteger(wanted) && wanted > 0 && wanted !== 4173 ? wanted : 0;
  return new Promise((ok, ko) => {
    server.once('error', (e) => (port ? server.listen(0, '127.0.0.1', () => ok(server)) : ko(e)));
    server.listen(port, '127.0.0.1', () => ok(server));
  });
}

if (!existsSync(join(root, 'index.html'))) {
  const r = spawnSync('npm', ['run', 'build'], { cwd: site, stdio: 'inherit' });
  if (r.status !== 0) process.exit(r.status ?? 1);
}
const { chromium } = await import(pathToFileURL(findPlaywright()).href);
const args = ['--ignore-gpu-blocklist', '--enable-gpu', ...(process.platform === 'darwin' ? ['--use-angle=metal'] : [])];
let browser;
try {
  browser = await chromium.launch({ args });
} catch (e) {
  const exe = cachedChromium();
  if (!exe) throw e;
  browser = await chromium.launch({ args, executablePath: exe });
}
// Rows [top, bottom] of a PNG capture holding at least `min` pixels at a contrast ≥ `ratio` with the corner colour,
// between columns x0 and x1. Decoded in a blank page (canvas), so nothing of the site is involved.
async function inkRows(scratch, png, { x0, x1, ratio, min }) {
  return scratch.evaluate(async ({ src, x0, x1, ratio, min }) => {
    const img = new Image();
    img.src = src;
    await img.decode();
    const c = Object.assign(document.createElement('canvas'), { width: img.width, height: img.height });
    const g = c.getContext('2d', { willReadFrequently: true });
    g.drawImage(img, 0, 0);
    const { data } = g.getImageData(0, 0, img.width, img.height);
    const lin = (v) => ((v /= 255) <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
    const lum = (i) => 0.2126 * lin(data[i]) + 0.7152 * lin(data[i + 1]) + 0.0722 * lin(data[i + 2]);
    const bg = lum(0);
    let top = -1, bottom = -1;
    for (let y = 0; y < img.height; y++) {
      let n = 0;
      for (let x = x0; x < x1; x++) if ((lum((y * img.width + x) * 4) + 0.05) / (bg + 0.05) >= ratio) n++;
      if (n >= min) { if (top < 0) top = y; bottom = y; }
    }
    return top < 0 ? null : [top, bottom];
  }, { src: 'data:image/png;base64,' + png.toString('base64'), x0, x1, ratio, min });
}

const server = await serve();
try {
  const base = `http://127.0.0.1:${server.address().port}`;
  const scratch = await (await browser.newContext()).newPage();
  const clip = { x: 0, y: HEADER, ...SIZE };
  const entries = [];
  let treeMid;
  for (const img of IMAGES) {
    const ctx = await browser.newContext({ viewport: { width: SIZE.width, height: SIZE.height + HEADER }, deviceScaleFactor: 1, reducedMotion: 'reduce', colorScheme: 'dark' });
    // Before any script of the page: the controls and texts over the block leave the layout, so that the scene frames
    // the tree in the whole block; the skill labels stay in place but are not painted.
    await ctx.addInitScript((css) => document.addEventListener('DOMContentLoaded', () => document.head.append(Object.assign(document.createElement('style'), { textContent: css }))), HIDE);
    const page = await ctx.newPage();
    await page.goto(base + img.path, { waitUntil: 'networkidle' });
    await page.waitForSelector('[data-tree-hero][data-tree-state="ready"]', { timeout: 60000 });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(1500);
    const box = await page.locator('[data-tree-hero]').boundingBox();
    if (!box || Math.round(box.y) !== HEADER || Math.round(box.width) !== SIZE.width || Math.round(box.height) !== SIZE.height) throw new Error(`tree block ${JSON.stringify(box)}, ${SIZE.width}×${SIZE.height} at y=${HEADER} expected`);
    // Height of the tree, measured once (English page) so that the name sits at the same place on both images.
    if (treeMid === undefined) {
      const tree = await inkRows(scratch, await page.screenshot({ type: 'png', clip }), { x0: 400, x1: SIZE.width, ratio: 2, min: 6 });
      if (!tree) throw new Error('no tree found right of x = 400');
      treeMid = (tree[0] + tree[1]) / 2;
      console.log(`tree rows ${tree[0]}–${tree[1]}, middle ${treeMid}`);
    }
    // Name and title in the fonts of the site, in the hierarchy of the home header; refuse any fallback font.
    const fonts = await page.evaluate(async ({ name, title, t, top }) => {
      const wrap = document.createElement('div');
      wrap.setAttribute('data-share-text', '');
      wrap.style.cssText = `position:fixed;left:${t.left}px;top:${top}px;display:flex;flex-direction:column;align-items:flex-start;gap:${t.gap}px;z-index:2147483647;pointer-events:none;white-space:nowrap`;
      const a = document.createElement('div');
      a.textContent = name;
      a.style.cssText = `font-family:'Inter Tight';font-weight:500;font-size:${t.name}px;line-height:1;letter-spacing:-.01em;color:var(--ink)`;
      const b = document.createElement('div');
      b.textContent = title;
      b.style.cssText = `font-family:'IBM Plex Mono';font-weight:400;font-size:${t.title}px;line-height:1;letter-spacing:.08em;text-transform:uppercase;color:var(--muted)`;
      wrap.append(a, b);
      document.querySelector('[data-home]').append(wrap);
      const inter = await document.fonts.load(`500 ${t.name}px 'Inter Tight'`, name);
      const mono = await document.fonts.load(`400 ${t.title}px 'IBM Plex Mono'`, title.toUpperCase());
      await document.fonts.ready;
      const status = (fam) => [...document.fonts].filter((f) => f.family.replace(/["']/g, '') === fam).map((f) => f.status);
      const right = Math.max(...[a, b].map((e) => { const r = document.createRange(); r.selectNodeContents(e); return r.getBoundingClientRect().right; }));
      return { inter: inter.length, mono: mono.length, interStatus: status('Inter Tight'), monoStatus: status('IBM Plex Mono'), right };
    }, { name: 'Arnaud Durand', title: img.title, t: TEXT, top: HEADER });
    if (!fonts.inter || !fonts.mono || !fonts.interStatus.includes('loaded') || !fonts.monoStatus.includes('loaded') || fonts.interStatus.includes('error') || fonts.monoStatus.includes('error')) throw new Error(`site fonts not loaded, refusing a fallback capture: ${JSON.stringify(fonts)}`);
    if (fonts.right > TEXT.maxRight) throw new Error(`${img.file}: text ends at x = ${fonts.right}, beyond ${TEXT.maxRight} (left third)`);
    // Centre the ink of the two lines (not their line boxes) on the middle of the tree.
    const ink = await inkRows(scratch, await page.screenshot({ type: 'png', clip }), { x0: 0, x1: 400, ratio: 1.5, min: 1 });
    if (!ink) throw new Error(`${img.file}: no text found left of x = 400`);
    const shift = Math.round(treeMid - (ink[0] + ink[1]) / 2);
    await page.evaluate(({ top }) => { document.querySelector('[data-share-text]').style.top = `${top}px`; }, { top: HEADER + shift });
    await page.waitForTimeout(300);
    const jpeg = await page.screenshot({ type: 'jpeg', quality: 86, clip });
    console.log(`${img.file}: text ink rows ${ink[0] + shift}–${ink[1] + shift}, right edge ${Math.ceil(fonts.right)}`);
    entries.push({ img, jpeg });
    await ctx.close();
  }
  // Written only once both captures succeeded.
  for (const { img, jpeg } of entries) writeFileSync(join(site, 'public', img.file), jpeg);
  const images = entries.map(({ img, jpeg }) => ({ image: img.file, sha256: createHash('sha256').update(jpeg).digest('hex') }));
  writeFileSync(sidecar, JSON.stringify({ palette: DEFAULT_PALETTE, seed: DEFAULT_SEED, images }, null, 1) + '\n');
  console.log(entries.map(({ img, jpeg }) => `${img.file} : ${jpeg.length} bytes`).join(', ') + `, ${sidecar}`);
} finally {
  server.close();
  await browser.close();
}
