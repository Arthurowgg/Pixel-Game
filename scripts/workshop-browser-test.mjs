/** Loading, workbench, animation integrity, and real touch-drag regression tests. */
import { expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { base, launchBrowser, screenshot } from './browser-helpers.mjs';
const browser = await launchBrowser();
const errors = [];
let checks = 0;
const passed = (message) => {
  checks++;
  console.log(`✓ ${message}`);
};
const watch = (page, allowed = []) => {
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('response', (response) => {
    if (response.status() >= 400 && !allowed.some((path) => response.url().endsWith(path)))
      errors.push(`HTTP ${response.status()}: ${response.url()}`);
  });
};
const defer = () => {
  let release;
  const promise = new Promise((resolve) => {
    release = resolve;
  });
  return { promise, release };
};
const noOverflow = async (page) => {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  for (const selector of ['.loading-screen', '.crafting-dialog .modal-panel']) {
    const element = page.locator(selector);
    if (await element.count())
      expect(await element.evaluate((node) => node.scrollWidth <= node.clientWidth + 1)).toBe(true);
  }
};
const saved = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('wildpine.save.v2')));
const enter = async (page) => {
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.locator('.forest-loading').waitFor({ state: 'hidden' });
  await expect(page.locator('.game-shell')).toHaveAttribute('data-loading', 'false');
};
const quit = async (page) => {
  if (!(await page.getByRole('heading', { name: 'The forest can wait.', exact: true }).count())) {
    if (await page.getByRole('dialog').count()) await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Pause game', exact: true }).click();
  }
  await page.getByRole('button', { name: 'Save & return to main menu', exact: true }).click();
};
const seed = async (page, state) =>
  page.addInitScript((value) => {
    localStorage.setItem('wildpine.save.v2', JSON.stringify(value));
    localStorage.setItem('wildpine.settings.v1', JSON.stringify({ sound: false, compactHud: true }));
  }, state);
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  watch(page);
  const boot = defer();
  await page.route('**/art/alpine.png', async (route) => {
    await boot.promise;
    await route.continue();
  });
  const bundle = defer();
  await page.route(/\/(?:src\/main\.tsx|assets\/index-[\w-]+\.js)(?:\?.*)?$/, async (route) => {
    await bundle.promise;
    await route.continue();
  });
  await page.goto(base, { waitUntil: 'commit' });
  await expect(page.getByRole('region', { name: 'Opening Wildpine', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Reload if loading stops', exact: true })).toBeVisible();
  await expect(page.locator('.app')).toHaveCount(0);
  await screenshot(page, 'loading-bootstrap');
  bundle.release();
  passed(
    'A branded HTML fallback appears before JavaScript downloads, with a reload path instead of a blank page',
  );
  await expect(page.locator('.boot-loading')).toBeVisible();
  await expect
    .poll(async () =>
      Number(
        await page.getByRole('progressbar', { name: 'Preparing Wildpine' }).getAttribute('aria-valuenow'),
      ),
    )
    .toBeGreaterThan(50);
  const progress = Number(
    await page.getByRole('progressbar', { name: 'Preparing Wildpine' }).getAttribute('aria-valuenow'),
  );
  expect(progress).toBeLessThan(100);
  await page.keyboard.press('c');
  await expect(page.locator('.main-menu')).toHaveCount(0);
  await screenshot(page, 'loading-boot-desktop');
  for (const [width, height, name] of [
    [390, 844, 'mobile'],
    [844, 390, 'landscape'],
  ]) {
    await page.setViewportSize({ width, height });
    await noOverflow(page);
    const bounds = await page.locator('.loading-progress-area').boundingBox();
    expect(bounds.y).toBeGreaterThan(0);
    expect(bounds.y + bounds.height).toBeLessThanOrEqual(height);
    await screenshot(page, `loading-boot-${name}`);
  }
  boot.release();
  await page.locator('.boot-loading').waitFor({ state: 'hidden' });
  await page.unroute('**/art/alpine.png');
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(page.getByRole('navigation', { name: 'Adventure menu' })).toBeVisible();
  passed(
    'The custom opening screen tracks actual delayed assets, blocks entry, and fits desktop, portrait, and landscape',
  );

  // Menu portraits must not replay the old painted blink or detached torso bob.
  await page.getByRole('button', { name: 'New adventure', exact: true }).click();
  const portrait = page.getByRole('img', { name: 'Your forest survivor', exact: true });
  expect(await portrait.evaluate((node) => getComputedStyle(node).animationName)).toBe('none');
  await page.getByLabel('WHAT SHOULD THE FOREST CALL YOU?', { exact: false }).fill('Rowan');
  const world = defer();
  await page.route('**/art/animations/forest.png', async (route) => {
    await world.promise;
    await route.continue();
  });
  await page.getByRole('button', { name: 'Enter the forest', exact: true }).click();
  await expect(page.locator('.forest-loading')).toBeVisible();
  await expect(page.locator('.loading-kicker')).toHaveText('YOUR FIRST FOOTSTEPS');
  await expect
    .poll(async () =>
      Number(
        await page.getByRole('progressbar', { name: 'Preparing your world' }).getAttribute('aria-valuenow'),
      ),
    )
    .toBeGreaterThan(25);
  expect(
    Number(
      await page.getByRole('progressbar', { name: 'Preparing your world' }).getAttribute('aria-valuenow'),
    ),
  ).toBeLessThan(100);
  await expect(page.locator('.game-hud')).toBeHidden();
  expect(await page.locator('.game-hud').evaluate((node) => node.inert)).toBe(true);
  const beforeEntry = await saved(page);
  await page.keyboard.down('d');
  await page.keyboard.press('e');
  await page.keyboard.press('c');
  await screenshot(page, 'loading-world-desktop');
  await page.setViewportSize({ width: 390, height: 844 });
  await noOverflow(page);
  await screenshot(page, 'loading-world-mobile');
  await page.setViewportSize({ width: 844, height: 390 });
  await noOverflow(page);
  await screenshot(page, 'loading-world-landscape');
  expect(await saved(page)).toEqual(beforeEntry);
  world.release();
  await page.locator('.forest-loading').waitFor({ state: 'hidden' });
  await page.keyboard.up('d');
  await page.unroute('**/art/animations/forest.png');
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(page.locator('.game-canvas')).toHaveAttribute('data-gait-distance', '0.00');
  await expect(page.locator('.game-canvas')).toHaveAttribute('data-workbench', 'none');
  await expect(page.locator('.game-canvas')).toHaveAttribute('data-workbench-count', '0');
  await expect(page.locator('.game-canvas')).toBeFocused();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  passed(
    'World entry has its own scene and real preparation stages; inputs and simulation stay blocked until the first frame is ready',
  );

  // Compare actual decoded source pixels, not only frame numbers: head registration
  // is byte-identical through the selected walk cycle in every cardinal source.
  const manifest = JSON.parse(readFileSync('public/art/animations/manifest.json', 'utf8'));
  const spriteSource = new URL(
    'art/animations/survivor.png',
    page.url().endsWith('/') ? page.url() : `${page.url()}/`,
  ).href;
  const heads = await page.evaluate(
    async ({ clips, url }) => {
      const image = new Image();
      image.src = url;
      await image.decode();
      const canvas = document.createElement('canvas');
      canvas.width = 20;
      canvas.height = 18;
      const ctx = canvas.getContext('2d');
      return ['up', 'down', 'right'].every((direction) => {
        const clip = clips[`walk-${direction}`];
        const pixels = [0, 3, 4, 7].map((frame) => {
          ctx.clearRect(0, 0, 20, 18);
          ctx.drawImage(image, clip.x + frame * clip.w + 14, clip.y + 8, 20, 18, 0, 0, 20, 18);
          return [...ctx.getImageData(0, 0, 20, 18).data].join(',');
        });
        return pixels.every((value) => value === pixels[0]);
      });
    },
    { clips: manifest.clips, url: spriteSource },
  );
  expect(heads).toBe(true);
  await expect(page.locator('.game-canvas')).toHaveAttribute('data-frame', '0');
  await page.waitForTimeout(650);
  await expect(page.locator('.game-canvas')).toHaveAttribute('data-frame', '0');
  passed(
    'The retained source cells still share identical head pixels, while the runtime survivor now comes from the authored rig',
  );

  await quit(page);
  await page.evaluate(() => {
    const state = JSON.parse(localStorage.getItem('wildpine.save.v2'));
    state.player = { x: 940, y: 758 };
    state.workbenches = [{ id: 0, x: 940, y: 738 }];
    Object.assign(state.inventory, { wood: 50, stone: 30, fiber: 30, berries: 10, mushroom: 3, water: 5 });
    state.lastInteract = -10;
    localStorage.setItem('wildpine.save.v2', JSON.stringify(state));
  });
  await enter(page);
  await expect(page.locator('.interaction-prompt')).toContainText('Use workbench');
  await screenshot(page, 'camp-workbench');
  await page.keyboard.press('e');
  await expect(page.getByRole('heading', { name: 'Your workbench', exact: true })).toBeVisible();
  await expect(page.locator('.workshop-station-tags')).toContainText('Workbench ready');
  await expect(page.locator('.workshop-station-tags')).toContainText('Fire burning');
  await expect(page.locator('.workshop-recipe')).toHaveCount(8);
  await noOverflow(page);
  expect(
    await page
      .locator('.crafting-dialog .modal-panel')
      .evaluate((node) => getComputedStyle(node).borderImageSlice),
  ).toBe('18');
  await screenshot(page, 'workshop-desktop');
  passed(
    'The generated solid placed workbench is in the world, exposes an E prompt, and opens the full workshop',
  );

  await page.getByRole('textbox', { name: 'Find a recipe', exact: true }).fill('tea');
  await expect(page.locator('.workshop-recipe')).toHaveCount(1);
  await expect(page.locator('.workshop-result h3')).toHaveText('Berry tea');
  await page.getByRole('textbox', { name: 'Find a recipe', exact: true }).fill('not-a-recipe');
  await expect(page.locator('.workshop-empty')).toContainText('No recipes');
  await expect(page.locator('.workshop-craft-button')).toHaveCount(0);
  await page.getByRole('button', { name: 'Show all recipes', exact: true }).click();
  await page.getByRole('tab', { name: 'Cooking', exact: true }).click();
  await expect(page.locator('.workshop-recipe')).toHaveCount(2);
  await page.keyboard.press('Home');
  await expect(page.getByRole('tab', { name: 'All', exact: true })).toBeFocused();
  await expect(page.getByRole('tab', { name: 'All', exact: true })).toHaveAttribute('aria-selected', 'true');
  await page.getByRole('checkbox', { name: 'Ready to craft', exact: true }).check();
  await expect(page.locator('.workshop-recipe')).toHaveCount(8);
  await page.getByRole('checkbox', { name: 'Ready to craft', exact: true }).uncheck();
  passed(
    'Recipe search, empty states, keyboard categories, and ready-only filtering all work without stale craft actions',
  );

  await page.locator('.workshop-recipe').filter({ hasText: 'Pine torch' }).click();
  await page.getByRole('button', { name: 'Increase crafting quantity', exact: true }).click();
  await page.getByRole('button', { name: 'Increase crafting quantity', exact: true }).click();
  await expect(page.getByRole('status', { name: 'Crafting quantity', exact: true })).toHaveText('3');
  await expect(page.locator('.workshop-ingredients')).toContainText('50 / 9');
  await page.getByRole('button', { name: 'Craft pine torch +3', exact: true }).click();
  await expect(page.locator('.workshop-feedback')).toContainText('Pine torch crafted ×3');
  await expect(page.locator('.workshop-owned b')).toHaveText('×3');
  await screenshot(page, 'workshop-crafted');
  await page.getByRole('button', { name: 'Hold pine torch', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.locator('.held-item-status')).toHaveAttribute('data-item', 'torch');
  await page.getByRole('button', { name: 'Pause game', exact: true }).click();
  let state = await saved(page);
  expect(state.inventory.wood).toBe(41);
  expect(state.inventory.fiber).toBe(24);
  expect(state.inventory.torch).toBe(3);
  expect(state.torchUntil).toBe(0);
  await page.getByRole('button', { name: 'Save & return to main menu', exact: true }).click();
  await page.close();
  passed(
    'Batch crafting spends exact multiplied ingredients, reports the result, and can equip it without consuming it',
  );

  // Intentional failures are the only HTTP errors allowed in this test page.
  const recovery = await browser.newPage({ viewport: { width: 1100, height: 780 } });
  watch(recovery, ['/art/alpine.png', '/art/objects/workbench.png']);
  await seed(recovery, state);
  const requests = new Map();
  recovery.on('request', (request) => {
    requests.set(request.url(), (requests.get(request.url()) || 0) + 1);
  });
  let alpineAttempts = 0;
  await recovery.route('**/art/alpine.png', async (route) => {
    if (++alpineAttempts === 1) await route.fulfill({ status: 503, body: 'Expected offline test' });
    else await route.continue();
  });
  await recovery.goto(base, { waitUntil: 'domcontentloaded' });
  await expect(recovery.getByRole('alert')).toContainText('Missing supplies');
  await expect(recovery.getByRole('button', { name: 'Retry loading', exact: true })).toBeFocused();
  await expect(recovery.locator('.main-menu')).toHaveCount(0);
  const forestRequest = [...requests.keys()].find((url) => url.endsWith('/art/forest-menu.webp'));
  const oldRequests = requests.get(forestRequest);
  await screenshot(recovery, 'loading-boot-retry');
  await recovery.getByRole('button', { name: 'Retry loading', exact: true }).click();
  await recovery.locator('.boot-loading').waitFor({ state: 'hidden' });
  expect(alpineAttempts).toBe(2);
  expect(requests.get(forestRequest)).toBe(oldRequests);
  expect(await saved(recovery)).toEqual(state);
  passed(
    'A failed opening asset produces an accessible retry screen; retry keeps decoded successes and preserves the save',
  );

  let tableAttempts = 0;
  await recovery.route('**/art/objects/workbench.png', async (route) => {
    if (++tableAttempts === 1) await route.fulfill({ status: 503, body: 'Expected missing table test' });
    else await route.continue();
  });
  await recovery.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(recovery.getByRole('alert')).toContainText('Workbench');
  await expect(recovery.locator('.loading-kicker')).toHaveText('THE PATH BACK HOME');
  await expect(recovery.locator('.game-hud')).toBeHidden();
  expect(await saved(recovery)).toEqual(state);
  await screenshot(recovery, 'loading-world-retry');
  await recovery.getByRole('button', { name: 'Retry loading', exact: true }).click();
  await recovery.locator('.forest-loading').waitFor({ state: 'hidden' });
  expect(tableAttempts).toBe(2);
  await expect(recovery.locator('.survivor-heading h2')).toHaveText('Rowan');
  await expect(recovery.locator('.game-canvas')).toHaveAttribute('data-workbench', 'generated');
  await quit(recovery);
  await recovery.close();
  passed(
    'A failed world asset can be retried in place, rebuilding the first frame without resetting the expedition',
  );

  const cancel = await browser.newPage({ viewport: { width: 1000, height: 720 } });
  watch(cancel);
  await seed(cancel, state);
  const pending = defer();
  await cancel.route('**/art/objects/workbench.png', async (route) => {
    await pending.promise;
    await route.continue();
  });
  await cancel.goto(base, { waitUntil: 'networkidle' });
  await cancel.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(cancel.locator('.forest-loading')).toBeVisible();
  await cancel.getByRole('button', { name: 'Back to title', exact: false }).click();
  pending.release();
  await expect(cancel.getByRole('navigation', { name: 'Adventure menu' })).toBeVisible();
  await cancel.waitForTimeout(650);
  await expect(cancel.locator('.game-shell')).toHaveCount(0);
  expect(await saved(cancel)).toEqual(state);
  await cancel.close();
  passed(
    'Returning to the title cancels an in-flight world entry; late asset completion cannot reopen or overwrite it',
  );

  const mobile = await browser.newPage({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  watch(mobile);
  state = structuredClone(state);
  state.player = { x: 500, y: 500 };
  state.resources = [];
  state.fires = [];
  state.equipped = null;
  await seed(mobile, state);
  await mobile.goto(base, { waitUntil: 'networkidle' });
  await enter(mobile);
  const cdp = await mobile.context().newCDPSession(mobile);
  const pad = await mobile.locator('.touch-dpad').boundingBox();
  const cx = pad.x + pad.width / 2,
    cy = pad.y + pad.height / 2;
  const touch = async (type, dx = 0, dy = 0) =>
    cdp.send('Input.dispatchTouchEvent', {
      type,
      touchPoints:
        type === 'touchEnd' ? [] : [{ x: cx + (dx * pad.width) / 2, y: cy + (dy * pad.height) / 2, id: 1 }],
    });
  await touch('touchStart', 0, -0.7);
  await expect(mobile.locator('.game-canvas')).toHaveAttribute('data-facing', 'up');
  await touch('touchMove', 0.85, -0.6);
  await expect(mobile.locator('.game-canvas')).toHaveAttribute('data-facing', 'right');
  await expect(mobile.locator('.game-canvas')).toHaveAttribute('data-animation', 'walk-right');
  await touch('touchMove', -0.6, 0.85);
  await expect(mobile.locator('.game-canvas')).toHaveAttribute('data-facing', 'down');
  await expect(mobile.locator('.game-canvas')).toHaveAttribute('data-animation', 'walk-down');
  await touch('touchMove', 0, 0);
  await expect(mobile.locator('.game-canvas')).toHaveAttribute('data-animation', 'idle-down');
  await touch('touchMove', 0.85, 0.6);
  await expect(mobile.locator('.game-canvas')).toHaveAttribute('data-facing', 'right');
  await touch('touchMove', 1.9, 0);
  await expect(mobile.locator('.game-canvas')).toHaveAttribute('data-animation', 'idle-right');
  await touch('touchEnd');
  const stoppedGait = await mobile.locator('.game-canvas').getAttribute('data-gait-distance');
  await mobile.waitForTimeout(200);
  await expect(mobile.locator('.game-canvas')).toHaveAttribute('data-gait-distance', stoppedGait);
  // Removed diagonal buttons leave neutral corners, not click-through ground targets.
  await touch('touchStart', -0.7, -0.7);
  await touch('touchEnd');
  await mobile.waitForTimeout(200);
  await expect(mobile.locator('.game-canvas')).toHaveAttribute('data-gait-distance', stoppedGait);
  await screenshot(mobile, 'cardinal-touch');
  passed(
    'One real touch steers only four ways; the center, outside edge, and empty corners never cause diagonal or stuck movement',
  );

  await mobile.getByRole('button', { name: 'Handcraft', exact: true }).click();
  await expect(mobile.getByRole('heading', { name: 'Handcraft', exact: true })).toBeVisible();
  await expect(mobile.locator('.workshop-recipe')).toHaveCount(3);
  await expect(mobile.getByRole('tab', { name: 'Cooking', exact: true })).toHaveCount(0);
  await expect(mobile.locator('.workshop-recipe').filter({ hasText: 'Forest shelter' })).toHaveCount(0);
  await noOverflow(mobile);
  await screenshot(mobile, 'handcraft-mobile-away');
  await mobile.keyboard.press('Escape');
  await mobile.keyboard.press('m');
  await expect(mobile.locator('.map-legend')).toContainText('Workbench');
  await screenshot(mobile, 'workbench-map');
  await mobile.keyboard.press('Escape');
  await mobile.getByRole('button', { name: 'Handcraft', exact: true }).click();
  await mobile.getByRole('tab', { name: 'Trail kit', exact: true }).click();
  await mobile.locator('.workshop-recipe').filter({ hasText: 'Pine torch' }).click();
  await expect(mobile.getByRole('button', { name: 'Craft pine torch +1', exact: true })).toBeEnabled();
  passed(
    'Away from the station, the hand menu contains only three essentials; cooking/equipment stay locked and placed workbenches appear on the map',
  );

  await quit(mobile);
  await mobile.evaluate(() => {
    const state = JSON.parse(localStorage.getItem('wildpine.save.v2'));
    state.player = { x: 940, y: 758 };
    state.workbenches = [{ id: 0, x: 940, y: 738 }];
    state.lastInteract = -10;
    state.fires = [{ x: 900, y: 740, id: 0, fuel: 80 }];
    localStorage.setItem('wildpine.save.v2', JSON.stringify(state));
  });
  await enter(mobile);
  await mobile.locator('.touch-e').tap();
  await expect(mobile.getByRole('heading', { name: 'Your workbench', exact: true })).toBeVisible();
  await mobile.getByRole('textbox', { name: 'Find a recipe', exact: true }).fill('shelter');
  await expect(mobile.locator('.workshop-recipe')).toHaveCount(1);
  await mobile.getByRole('button', { name: 'Craft forest shelter +1', exact: true }).scrollIntoViewIfNeeded();
  await noOverflow(mobile);
  await screenshot(mobile, 'workshop-mobile');
  await mobile.getByRole('button', { name: 'Craft forest shelter +1', exact: true }).click();
  await expect(mobile.locator('.workshop-feedback')).toContainText('Forest shelter crafted');
  await mobile.setViewportSize({ width: 844, height: 390 });
  await mobile.getByRole('button', { name: 'Close dialog', exact: true }).scrollIntoViewIfNeeded();
  await noOverflow(mobile);
  await screenshot(mobile, 'workshop-landscape');
  await mobile.getByRole('button', { name: 'Close dialog', exact: true }).click();
  await mobile.getByRole('button', { name: 'Pause game', exact: true }).click();
  expect((await saved(mobile)).inventory.shelter).toBe(1);
  await mobile.close();
  passed(
    'Mobile workshop search, real crafting, scrolling, and landscape dismissal work with no clipped horizontal content',
  );

  expect(errors).toEqual([]);
  console.log(`\n${checks} Hearth & Hand browser scenarios passed. No unexpected browser/network errors.`);
} finally {
  await browser.close();
}
