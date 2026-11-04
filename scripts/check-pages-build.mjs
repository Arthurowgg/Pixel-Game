/** Verify a completed Vite build is safe to publish below /RepositoryName/. */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
const base = process.env.VITE_BASE_PATH || '/Pixel-Game/';
assert(base.startsWith('/') && base.endsWith('/'), 'The base must be a root-relative directory.');
const html = readFileSync('dist/index.html', 'utf8');
for (const [, path] of html.matchAll(/(?:href|src)="(\/[^"#]+)"/g)) {
  assert(path.startsWith(base), `HTML asset escapes the repository: ${path}`);
  assert(existsSync(resolve('dist', path.slice(base.length))), `HTML asset is missing: ${path}`);
}
const manifest = JSON.parse(readFileSync('public/art/animations/manifest.json', 'utf8'));
for (const name of Object.keys(manifest.sheets))
  assert(existsSync(`dist/art/animations/${name}.png`), `Missing sheet: ${name}`);
const itemAtlas = JSON.parse(readFileSync('public/art/item-sprites.json', 'utf8'));
assert(existsSync(`dist/${itemAtlas.sheet}`), 'Missing shared inventory atlas.');
const generatedAssets = JSON.parse(readFileSync('public/art/generated-assets.json', 'utf8'));
for (const asset of [
  ...Object.values(generatedAssets.icons),
  ...Object.values(generatedAssets.textures),
  ...Object.values(generatedAssets.frames),
  ...Object.values(generatedAssets.effects),
  ...Object.values(generatedAssets.objects),
  ...Object.values(generatedAssets.scenes),
])
  assert(existsSync(`dist/${asset.file}`), `Missing generated asset: ${asset.file}`);
const js = readdirSync('dist/assets')
  .filter((name) => name.endsWith('.js'))
  .map((name) => readFileSync(`dist/assets/${name}`, 'utf8'))
  .join('\n');
assert(js.includes(base), 'Vite’s base was not compiled into the runtime asset helper.');
assert(!/(["'`])\/art\//.test(js), 'A runtime image still points at the host root.');
for (const name of readdirSync('dist/assets').filter((name) => name.endsWith('.css'))) {
  const css = readFileSync(`dist/assets/${name}`, 'utf8');
  assert(!/url\(["']?\/art\//.test(css), 'A CSS image still points at the host root.');
}
console.log(
  `Pages build verified: ${base}, ${Object.keys(manifest.sheets).length} animation sheets, no root-only art URLs.`,
);
