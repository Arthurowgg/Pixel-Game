/** Shared sandbox/system Chromium launcher for both real-browser regression suites. */
import { chromium as playwright } from '@playwright/test';
import chromium from '@sparticuz/chromium';
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { brotliDecompressSync } from 'node:zlib';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';

export const base = process.env.BASE_URL || 'http://localhost:5173';
export const artifacts = resolve('.cache/screenshots');
mkdirSync(artifacts, { recursive: true });
export async function launchBrowser() {
  let executablePath = process.env.CHROME_EXECUTABLE;
  const env = { ...process.env };
  if (!executablePath && process.platform === 'linux') {
    const libs = resolve('.cache/chromium-libs');
    mkdirSync(libs, { recursive: true });
    if (!existsSync(`${libs}/lib/libnss3.so`)) {
      writeFileSync(
        `${libs}/al2023.tar`,
        brotliDecompressSync(readFileSync('node_modules/@sparticuz/chromium/bin/al2023.tar.br')),
      );
      execFileSync('tar', ['-xf', `${libs}/al2023.tar`, '-C', libs]);
    }
    env.LD_LIBRARY_PATH = `${libs}/lib:${env.LD_LIBRARY_PATH || ''}`;
    executablePath = await chromium.executablePath();
  }
  return playwright.launch({
    executablePath,
    env,
    headless: true,
    args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage', '--no-zygote'],
  });
}
export async function screenshot(page, name) {
  await page.screenshot({
    path: `${artifacts}/${name}.png`,
    fullPage: true,
    animations: 'disabled',
    timeout: 10000,
  });
}
