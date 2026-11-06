/**
 * Publish a copy of the game that works when GitHub Pages serves this branch as
 * plain static files ("deploy from a branch").
 *
 * The repository root index.html is the Vite dev entry, so publishing the branch
 * root raw leaves the game on its arrival screen. This script builds a second
 * copy under public/ (base `/Pixel-Game/public/`, so the already-committed art in
 * public/art is reused instead of duplicated) and writes the entry page to
 * public/play/index.html. The root index.html redirects there on github.io.
 *
 * Run it after any change that affects the bundle: `npm run publish:pages`.
 */
import { execFileSync } from 'node:child_process';
import { cpSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const base = process.env.VITE_BASE_PATH_FALLBACK || '/Pixel-Game/public/';
const out = '.cache/pages-build';
rmSync(out, { recursive: true, force: true });
execFileSync(
  'npx',
  ['vite', 'build', '--base', base, '--outDir', out, '--assetsDir', 'pages-assets', '--emptyOutDir'],
  { stdio: 'inherit' },
);

const html = readFileSync(resolve(out, 'index.html'), 'utf8');
for (const [, path] of html.matchAll(/(?:href|src|url)\(?["']?(\/[^"')\s#]+)/g)) {
  if (!path.startsWith(base)) throw new Error(`Fallback HTML asset escapes the base: ${path}`);
  const onDisk = resolve('public', path.slice(base.length));
  const bundled = resolve(out, path.slice(base.length));
  try {
    readFileSync(onDisk);
  } catch {
    try {
      readFileSync(bundled);
    } catch {
      throw new Error(`Fallback HTML references a missing file: ${path}`);
    }
  }
}

mkdirSync('public/play', { recursive: true });
writeFileSync('public/play/index.html', html);
rmSync('public/pages-assets', { recursive: true, force: true });
mkdirSync('public/pages-assets', { recursive: true });
for (const name of readdirSync(resolve(out, 'pages-assets')))
  cpSync(resolve(out, 'pages-assets', name), resolve('public/pages-assets', name));
console.log(
  `Fallback published: public/play/index.html + ${readdirSync('public/pages-assets').length} assets under ${base}`,
);
