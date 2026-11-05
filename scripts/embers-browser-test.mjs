/** Ember & Instinct: real settings, input, campfire and combat regressions. */
import { expect } from '@playwright/test';
import { base, launchBrowser, screenshot } from './browser-helpers.mjs';

const browser = await launchBrowser(),
  errors = [];
let checks = 0,
  template;
const passed = (message) => {
  checks++;
  console.log(`✓ ${message}`);
};
const watch = (page) => {
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('response', (response) => {
    if (response.status() >= 400) errors.push(`HTTP ${response.status()}: ${response.url()}`);
  });
};
const preferences = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('wildpine.settings.v1')));
const saved = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('wildpine.save.v2')));
const noOverflow = async (page) => {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  for (const selector of ['.settings-dialog .modal-panel', '.hearth-panel']) {
    if (!(await page.locator(selector).count())) continue;
    const viewport = page.viewportSize(),
      bounds = await page.locator(selector).boundingBox();
    expect(bounds.x).toBeGreaterThanOrEqual(0);
    expect(bounds.y).toBeGreaterThanOrEqual(0);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(viewport.width + 1);
    expect(bounds.y + bounds.height).toBeLessThanOrEqual(viewport.height + 1);
    expect(await page.locator(selector).evaluate((node) => node.scrollWidth <= node.clientWidth + 1)).toBe(
      true,
    );
  }
};
const menu = async (page) => {
  if (await page.locator('.game-shell').count()) {
    if (
      (await page.getByRole('dialog').count()) &&
      !(await page.getByRole('heading', { name: 'The forest can wait.', exact: true }).count())
    )
      await page.keyboard.press('Escape');
    if (!(await page.getByRole('heading', { name: 'The forest can wait.', exact: true }).count()))
      await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Save & return to main menu', exact: true }).click();
  } else if (await page.getByRole('dialog').count()) await page.keyboard.press('Escape');
};
const enter = async (page) => {
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.locator('.forest-loading').waitFor({ state: 'hidden' });
  await expect(page.locator('.game-shell')).toHaveAttribute('data-loading', 'false');
};
const fixture = async (page, patch = {}, settings) => {
  await menu(page);
  const state = {
    ...structuredClone(template),
    player: { x: 500, y: 500 },
    resources: [],
    fires: [],
    shelters: [],
    wolves: [],
    time: 20,
    weather: 'clear',
    lastAttack: -10,
    lastInteract: -10,
    distance: 0,
    kills: 0,
    direction: 'down',
    equipped: 'hatchet',
    ...patch,
  };
  state.inventory = { ...template.inventory, ...patch.inventory };
  state.needs = { health: 100, hunger: 90, thirst: 90, warmth: 90, stamina: 100, ...patch.needs };
  await page.evaluate(
    ({ state, settings }) => {
      localStorage.setItem('wildpine.save.v2', JSON.stringify(state));
      if (settings) localStorage.setItem('wildpine.settings.v1', JSON.stringify(settings));
    },
    { state, settings },
  );
  await page.reload({ waitUntil: 'networkidle' });
  await enter(page);
};
const clickAt = async (page, dx, dy, button = 'left') => {
  const canvas = page.locator('.game-canvas');
  const position = await canvas.evaluate(
    (node, { dx, dy }) => ({
      x: ((Math.ceil(node.width / 2) + dx) * node.clientWidth) / node.width,
      y: ((Math.ceil(node.height / 2) - 12 + dy) * node.clientHeight) / node.height,
    }),
    { dx, dy },
  );
  await canvas.click({ button, position });
};
const volume = async (page, name, value) => {
  await page.getByRole('slider', { name, exact: true }).focus();
  await page.keyboard.press('Home');
  for (let i = 0; i < value; i++) await page.keyboard.press('ArrowRight');
};
const campPatch = {
  player: { x: 900, y: 772 },
  fires: [{ id: 0, x: 900, y: 740, fuel: 30 }],
  inventory: { wood: 3 },
};
const enemy = (hp = 2, x = 560, y = 500) => ({ id: 1, x, y, hp, cooldown: 0, scared: 0 });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  watch(page);
  await page.goto(base, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await expect(page.getByRole('tab', { name: 'Display', exact: true })).toBeFocused();
  await expect(page.getByRole('tab')).toHaveCount(4);
  expect(
    await page.getByRole('dialog').evaluate((node) => getComputedStyle(node).borderImageSource),
  ).toContain('settings-frame.png');
  await noOverflow(page);
  await screenshot(page, 'settings-display-desktop');
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('tab', { name: 'Audio', exact: true })).toBeFocused();
  await volume(page, 'Master volume', 37);
  await volume(page, 'Sound effects volume', 61);
  await volume(page, 'Forest ambience volume', 14);
  expect(await preferences(page)).toMatchObject({ masterVolume: 0.37, effects: 0.61, ambience: 0.14 });
  await page.getByRole('button', { name: 'Test sound', exact: true }).click();
  await expect(page.locator('.settings-feedback')).toContainText('Playing a sound check');
  await screenshot(page, 'settings-audio-desktop');
  await page.getByRole('switch', { name: 'Forest sounds', exact: true }).click();
  await expect(page.getByRole('slider', { name: 'Master volume', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Test sound', exact: true })).toBeDisabled();
  expect((await preferences(page)).masterVolume).toBe(0.37);
  await page.getByRole('switch', { name: 'Forest sounds', exact: true }).click();
  passed(
    'The new pixel-framed settings have keyboard tabs, three persistent volume controls, mute, and a real sound check',
  );

  await page.getByRole('tab', { name: 'Display', exact: true }).click();
  await page.getByRole('radio', { name: 'Quiet', exact: true }).click();
  expect(await preferences(page)).toMatchObject({
    reducedMotion: true,
    atmosphere: false,
    damageFlash: false,
    pixelScale: 2,
  });
  await page.getByRole('radio', { name: 'Close-up', exact: true }).click();
  expect(await preferences(page)).toMatchObject({
    reducedMotion: false,
    atmosphere: true,
    damageFlash: true,
    pixelScale: 3,
  });
  await page.getByRole('radio', { name: '3× pixel scale', exact: true }).focus();
  await page.keyboard.press('ArrowLeft');
  await expect(page.getByRole('radio', { name: '2× pixel scale', exact: true })).toHaveAttribute(
    'aria-checked',
    'true',
  );
  await page.getByRole('switch', { name: 'Soft vignette', exact: true }).click();
  await page.getByRole('tab', { name: 'Interface', exact: true }).click();
  await page.getByRole('switch', { name: 'Floating numbers', exact: true }).click();
  await page.getByRole('switch', { name: 'Field objectives', exact: true }).click();
  await screenshot(page, 'settings-interface-desktop');
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  await page.reload({ waitUntil: 'networkidle' });
  expect(await preferences(page)).toMatchObject({
    masterVolume: 0.37,
    vignette: false,
    floatingText: false,
    showHints: false,
  });
  passed(
    'Visual presets and keyboard scale selection apply real preferences and survive a full browser reload',
  );

  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('button', { name: 'Restore defaults', exact: true }).click();
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  expect((await preferences(page)).masterVolume).toBe(0.37);
  await page.getByRole('button', { name: 'Restore defaults', exact: true }).click();
  await page.getByRole('button', { name: 'Reset all preferences', exact: true }).click();
  expect(await preferences(page)).toMatchObject({
    masterVolume: 1,
    pixelScale: 2,
    vignette: true,
    floatingText: true,
    showHints: true,
  });
  await page.evaluate(() => {
    document.documentElement.requestFullscreen = () => Promise.reject(Error('Preview permission denied'));
  });
  await page.getByRole('button', { name: 'Enter fullscreen', exact: true }).click();
  await expect(page.locator('.settings-feedback')).toContainText('Fullscreen is unavailable');
  await page.getByRole('tab', { name: 'Controls', exact: true }).click();
  await expect(page.getByRole('tabpanel')).toContainText('LEFT CLICK');
  await expect(page.getByRole('tabpanel')).toContainText('RIGHT CLICK');
  await expect(page.getByRole('tabpanel')).toContainText('F is unbound');
  await screenshot(page, 'settings-controls-desktop');
  await page.getByRole('button', { name: 'Done', exact: true }).focus();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Close dialog', exact: true })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Settings', exact: true })).toBeFocused();
  passed(
    'Reset requires confirmation, fullscreen rejection is handled, controls are accurate, and modal focus stays accessible',
  );

  await page.getByRole('button', { name: 'New adventure', exact: true }).click();
  await page.getByLabel('WHAT SHOULD THE FOREST CALL YOU?', { exact: false }).fill('Ash');
  await page.getByRole('button', { name: 'Enter the forest', exact: true }).click();
  await page.locator('.forest-loading').waitFor({ state: 'hidden' });
  await page.keyboard.press('Escape');
  template = await saved(page);
  await fixture(page);
  await expect(page.locator('.quickbar-hints')).toHaveCount(0);
  await page.keyboard.press('3');
  await page.keyboard.press('f');
  await page.waitForTimeout(400);
  await expect(page.locator('.game-canvas')).toHaveAttribute('data-animation', 'idle-down');
  await page.keyboard.press('Escape');
  expect((await saved(page)).inventory.berries).toBe(3);
  expect((await saved(page)).distance).toBe(0);
  await page.getByRole('button', { name: 'Back to the wild', exact: true }).click();
  await clickAt(page, 45, 0);
  await page.waitForTimeout(750);
  await page.keyboard.press('Escape');
  expect((await saved(page)).inventory.berries).toBe(2);
  expect((await saved(page)).distance).toBe(0);
  passed(
    'F does nothing, left-click uses the held item without moving, and the permanent controls tutorial is gone',
  );

  await fixture(page, {}, { sound: false, pixelScale: 3 });
  await expect(page.locator('.game-canvas')).toHaveAttribute('data-pixel-scale', '3');
  expect(await page.locator('.game-canvas').evaluate((node) => [node.width, node.height])).toEqual([
    480, 300,
  ]);
  await clickAt(page, 30, 16, 'right');
  await expect(page.locator('.game-canvas')).toHaveAttribute('data-facing', 'right');
  await expect(page.locator('.game-canvas')).toHaveAttribute('data-facing', 'down');
  await expect(page.locator('.game-canvas')).toHaveAttribute('data-animation', 'idle-down');
  await page.keyboard.press('Escape');
  let state = await saved(page);
  expect(state.player.x).toBeCloseTo(530, 5);
  expect(state.player.y).toBeCloseTo(516, 5);
  expect(state.distance).toBeCloseTo(46, 5);
  passed(
    'Right-click remains a cardinal two-leg route with accurate pointer coordinates at the new 3× scale',
  );

  await fixture(
    page,
    { resources: [{ id: 0, kind: 'tree', x: 530, y: 500, hp: 3, readyAt: 0, scale: 1, variant: 0 }] },
    { sound: false, pixelScale: 2 },
  );
  const canvas = page.locator('.game-canvas'),
    box = await canvas.boundingBox();
  await page.mouse.move(box.x + box.width / 2 + 60, box.y + box.height / 2 - 70);
  await page.mouse.down();
  await expect(canvas).toHaveAttribute('data-animation', 'axe-right');
  await page.keyboard.press('Escape');
  await page.mouse.up();
  await page.getByRole('button', { name: 'Back to the wild', exact: true }).click();
  await page.waitForTimeout(1400);
  await page.keyboard.press('Escape');
  state = await saved(page);
  expect(state.resources[0].hp).toBe(2);
  expect(state.inventory.wood).toBe(0);
  passed('Opening a menu clears held mouse input; resuming finishes at most the one pending swing');

  await fixture(page, { ...campPatch, resources: template.resources }, { sound: false, pixelScale: 2 });
  await expect(page.getByRole('region', { name: 'By the campfire', exact: true })).toBeVisible();
  await expect(page.locator('.game-hud')).toBeHidden();
  expect(await page.locator('.game-hud').evaluate((node) => node.inert)).toBe(true);
  await expect(page.locator('.hearth-feed')).toHaveCount(1);
  await expect(page.getByRole('meter', { name: 'Campfire fuel', exact: true })).toBeVisible();
  const fireTime = await page.locator('.hearth-supply-line > span').last().textContent();
  await page.waitForTimeout(1250);
  expect(await page.locator('.hearth-supply-line > span').last().textContent()).not.toBe(fireTime);
  await noOverflow(page);
  await screenshot(page, 'campfire-desktop');
  passed(
    'Sitting on the camp bench reveals live fuel and exactly one large log action, hides the clutter, and does not pause the world',
  );

  await page.getByRole('button', { name: 'Add one pine log', exact: true }).click();
  await expect(page.locator('.game-canvas')).toHaveAttribute('data-feeding', 'true');
  await expect(page.locator('.hearth-feed')).toBeDisabled();
  await expect(page.locator('.hearth-supply-line b')).toHaveText('3');
  await page.waitForTimeout(230);
  await screenshot(page, 'campfire-log-placement');
  await expect(page.locator('.hearth-supply-line b')).toHaveText('2');
  await expect
    .poll(async () =>
      Number(
        await page.getByRole('meter', { name: 'Campfire fuel', exact: true }).getAttribute('aria-valuenow'),
      ),
    )
    .toBeGreaterThan(60);
  await expect(page.locator('.game-canvas')).toHaveAttribute('data-feeding', 'false');
  await page.getByRole('button', { name: 'Add one pine log', exact: true }).click();
  await page.waitForTimeout(100);
  await clickAt(page, 80, 0, 'right');
  await expect(page.locator('.game-hud')).toBeVisible();
  await page.waitForTimeout(800);
  await page.keyboard.press('Escape');
  expect((await saved(page)).inventory.wood).toBe(2);
  expect((await saved(page)).equipped).toBe('hatchet');
  passed(
    'A log travels to the fire and is spent once at contact; right-click cancels an unplaced log and restores the HUD',
  );

  await fixture(page, { ...campPatch, inventory: { wood: 0 }, fires: [{ id: 0, x: 900, y: 740, fuel: 95 }] });
  await expect(page.locator('.hearth-feed')).toBeVisible();
  await expect(page.locator('.hearth-feed')).toBeDisabled();
  await page.getByRole('button', { name: 'Leave campfire view', exact: true }).click();
  await page.waitForTimeout(850);
  await expect(page.locator('.campfire-scene')).toHaveCount(0);
  await page.keyboard.press('e');
  await expect(page.locator('.campfire-scene')).toBeVisible();
  await expect(page.locator('.hearth-feed')).toBeDisabled();
  await page.keyboard.down('d');
  await page.waitForTimeout(150);
  await page.keyboard.up('d');
  await expect(page.locator('.game-hud')).toBeVisible();
  passed('Camp can be dismissed, reopened with E even with no logs, and exited immediately with movement');

  await fixture(page, { ...campPatch, needs: { health: 10 } });
  await page.waitForTimeout(850);
  await expect(page.locator('.campfire-scene')).toHaveCount(0);
  await expect(page.getByRole('meter', { name: 'Health', exact: true })).toBeVisible();
  passed('Critical needs keep the survival HUD visible rather than trapping the player in a quiet camp view');

  await fixture(page, { time: 120, weather: 'wolves', wolves: [enemy()] });
  await expect(canvas).toHaveAttribute('data-wolf-phases', /windup/);
  await expect(page.locator('.wolf-encounter')).toContainText('about to lunge');
  const warningBounds = await page.locator('.wolf-encounter').boundingBox();
  const noticeBounds = await page.locator('.toast-stack').boundingBox();
  expect(warningBounds.y + warningBounds.height).toBeLessThanOrEqual(noticeBounds.y);
  await screenshot(page, 'wolf-warning');
  await page.waitForFunction(
    () => document.querySelector('.game-canvas').dataset.wolfPhases.includes('lunge'),
    null,
    { polling: 'raf' },
  );
  await page.waitForTimeout(300);
  await page.keyboard.press('Escape');
  expect((await saved(page)).needs.health).toBeLessThan(100);
  passed('Wolves show an actual warning phase, run into a committed lunge, and apply one bite at contact');

  await fixture(page, { time: 120, weather: 'wolves', wolves: [enemy()] });
  await expect(canvas).toHaveAttribute('data-wolf-phases', /windup/);
  await page.keyboard.down('w');
  await page.waitForTimeout(950);
  await page.keyboard.up('w');
  await page.keyboard.press('Escape');
  state = await saved(page);
  expect(state.needs.health).toBe(100);
  expect(state.player.x).toBe(500);
  expect(state.player.y).toBeLessThan(470);
  passed('A straight cardinal dodge escapes the locked lunge without taking a guaranteed tracking bite');

  await fixture(page, { time: 120, weather: 'wolves', wolves: [{ ...enemy(1), cooldown: 5 }] });
  await clickAt(page, 60, -18);
  await page.waitForFunction(() => document.querySelector('.game-canvas').dataset.wolfFallen === '1', null, {
    polling: 'raf',
  });
  await expect(canvas).toHaveAttribute('data-wolf-count', '0');
  await screenshot(page, 'wolf-defeat-feedback');
  await expect(canvas).toHaveAttribute('data-wolf-fallen', '0');
  await page.keyboard.press('Escape');
  expect((await saved(page)).kills).toBe(1);
  await menu(page);
  await page.reload({ waitUntil: 'networkidle' });
  await enter(page);
  await expect(canvas).toHaveAttribute('data-wolf-fallen', '0');
  await expect(canvas).toHaveAttribute('data-wolf-count', '0');
  passed(
    'The wider aimed axe hit leaves brief whole-frame defeat feedback, counts one kill, and never saves a ghost corpse',
  );
  await page.close();

  const mobile = await browser.newPage({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  watch(mobile);
  await mobile.goto(base, { waitUntil: 'networkidle' });
  await mobile.getByRole('button', { name: 'Settings', exact: true }).click();
  await noOverflow(mobile);
  await screenshot(mobile, 'settings-mobile');
  await mobile.getByRole('tab', { name: 'Audio', exact: true }).tap();
  await mobile.getByRole('slider', { name: 'Master volume', exact: true }).scrollIntoViewIfNeeded();
  await volume(mobile, 'Master volume', 25);
  await expect(mobile.getByRole('slider', { name: 'Master volume', exact: true })).toHaveValue('25');
  await noOverflow(mobile);
  await screenshot(mobile, 'settings-audio-mobile');
  await mobile.getByRole('tab', { name: 'Controls', exact: true }).tap();
  await mobile.getByRole('button', { name: 'Done', exact: true }).scrollIntoViewIfNeeded();
  await mobile.getByRole('button', { name: 'Done', exact: true }).tap();
  passed(
    'The new settings fit portrait phones; touch tabs, volume input, scrolling and dismissal remain usable',
  );

  await fixture(mobile, { ...campPatch, resources: template.resources }, { sound: false, pixelScale: 2 });
  await expect(mobile.locator('.campfire-scene')).toBeVisible();
  await noOverflow(mobile);
  await screenshot(mobile, 'campfire-mobile');
  await mobile.getByRole('button', { name: 'Add one pine log', exact: true }).tap();
  await expect(mobile.locator('.hearth-supply-line b')).toHaveText('2');
  await expect(mobile.locator('.game-canvas')).toHaveAttribute('data-feeding', 'false');
  await mobile.setViewportSize({ width: 844, height: 390 });
  await noOverflow(mobile);
  await screenshot(mobile, 'campfire-landscape');
  await mobile.getByRole('button', { name: 'Leave campfire view', exact: true }).tap();
  await expect(mobile.locator('.touch-dpad')).toBeVisible();
  await expect(mobile.locator('.touch-primary')).toBeVisible();
  await mobile.locator('.touch-e').tap();
  await expect(mobile.locator('.campfire-scene')).toBeVisible();
  await expect(mobile.locator('.hearth-supply-line b')).toHaveText('2');
  await mobile.getByRole('button', { name: 'Add one pine log', exact: true }).tap();
  await expect(mobile.locator('.hearth-supply-line b')).toHaveText('1');
  await mobile.waitForTimeout(1200);
  await expect(mobile.locator('.hearth-supply-line b')).toHaveText('1');
  await mobile.getByRole('button', { name: 'Leave campfire view', exact: true }).tap();
  await mobile.getByRole('button', { name: 'Settings', exact: true }).tap();
  await noOverflow(mobile);
  await screenshot(mobile, 'settings-landscape');
  await mobile.getByRole('button', { name: 'Close dialog', exact: true }).scrollIntoViewIfNeeded();
  await mobile.getByRole('button', { name: 'Close dialog', exact: true }).tap();
  await expect(mobile.getByRole('heading', { name: 'The forest can wait.', exact: true })).toBeVisible();
  passed(
    'Portrait and landscape camp panels fit, feed by touch, restore movement controls, and never stick E after hiding the HUD',
  );
  await mobile.setViewportSize({ width: 390, height: 844 });
  await fixture(mobile, { time: 120, weather: 'wolves', wolves: [enemy()] });
  await expect(mobile.locator('.wolf-encounter')).toBeVisible();
  const threat = await mobile.locator('.wolf-encounter').boundingBox();
  const vitals = await mobile.locator('.survivor-panel').boundingBox();
  expect(
    threat.x < vitals.x + vitals.width &&
      threat.x + threat.width > vitals.x &&
      threat.y < vitals.y + vitals.height &&
      threat.y + threat.height > vitals.y,
  ).toBe(false);
  await noOverflow(mobile);
  await screenshot(mobile, 'wolf-warning-mobile');
  await mobile.setViewportSize({ width: 320, height: 568 });
  const smallThreat = await mobile.locator('.wolf-encounter').boundingBox();
  const smallVitals = await mobile.locator('.survivor-panel').boundingBox();
  expect(smallThreat.x).toBeGreaterThanOrEqual(smallVitals.x + smallVitals.width);
  await noOverflow(mobile);
  await screenshot(mobile, 'wolf-warning-small-phone');
  passed('The mobile wolf warning occupies the weather slot instead of covering survival gauges or notices');
  await mobile.close();

  expect(errors).toEqual([]);
  console.log(`\n${checks} Ember & Instinct browser scenarios passed. No unexpected browser/network errors.`);
} finally {
  await browser.close();
}
