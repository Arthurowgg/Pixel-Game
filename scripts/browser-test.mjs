/** Browser smoke tests. Start `npm run dev` first, or set BASE_URL. */
import { expect } from '@playwright/test';
import { base, launchBrowser, screenshot } from './browser-helpers.mjs';
const browser = await launchBrowser();
const errors = [];
let checks = 0;
const passed = (text) => {
  checks++;
  console.log(`✓ ${text}`);
};
const watch = (page) => {
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('response', (response) => {
    if (response.status() >= 400) errors.push(`HTTP ${response.status()}: ${response.url()}`);
  });
};
const saved = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('wildpine.save.v2')));
const noOverflow = async (page) =>
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
const enter = async (page) => {
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.locator('.forest-loading').waitFor({ state: 'hidden' });
};
const checkpoint = async (page, modify) => {
  // Leave the live simulation before replacing a checkpoint so beforeunload
  // cannot overwrite the fixture with an older in-memory state.
  await page.getByRole('button', { name: 'Save & return to main menu' }).click();
  await page.evaluate(modify);
  await page.reload({ waitUntil: 'networkidle' });
  await enter(page);
};
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  watch(page);
  await page.goto(base, { waitUntil: 'networkidle' });
  await expect(page.getByRole('heading', { level: 1 })).toContainText('WILDPINE');
  await expect(page.getByRole('button', { name: 'Continue', exact: true })).toBeDisabled();
  await noOverflow(page);
  expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBe(900);
  await screenshot(page, 'menu-desktop');
  passed('Main menu fits the desktop viewport and correctly disables Continue without a save');
  const adventureMenu = page.getByRole('navigation', { name: 'Adventure menu' });
  await adventureMenu.getByRole('button', { name: 'New adventure', exact: true }).focus();
  await page.keyboard.press('ArrowDown');
  await expect(adventureMenu.getByRole('button', { name: 'Survival guide', exact: true })).toBeFocused();
  await page.keyboard.press('End');
  await expect(adventureMenu.getByRole('button', { name: 'Settings', exact: true })).toBeFocused();
  await page.keyboard.press('Home');
  await expect(adventureMenu.getByRole('button', { name: 'New adventure', exact: true })).toBeFocused();
  passed('The game title screen supports arrow-key navigation and skips unavailable Continue');
  await page.getByRole('button', { name: 'Fieldcraft', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'The fieldcraft book', exact: true })).toBeVisible();
  await page.getByRole('textbox', { name: 'Find an item', exact: true }).fill('tea');
  await expect(page.locator('.fieldcraft-items > button')).toHaveCount(1);
  await page.getByRole('button', { name: 'Berry tea', exact: true }).click();
  await expect(page.locator('.fieldcraft-detail')).toContainText('25 thirst and 24 warmth');
  await screenshot(page, 'fieldcraft-supplies');
  await page.getByRole('textbox', { name: 'Find an item', exact: true }).fill('not-a-forest-item');
  await expect(page.getByRole('status')).toContainText('No supplies match');
  await page.getByRole('tab', { name: 'Camp recipes', exact: true }).click();
  await expect(page.locator('.fieldcraft-recipes > article')).toHaveCount(11);
  await expect(page.getByText('10 pine wood', { exact: true })).toBeVisible();
  await screenshot(page, 'fieldcraft-recipes');
  await page.keyboard.press('ArrowLeft');
  await expect(page.getByRole('tab', { name: 'Supplies', exact: true })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Fieldcraft', exact: true })).toBeFocused();
  passed('The new fieldcraft menu filters supplies, explains item use, and shows all eleven exact recipes');

  await page.getByRole('button', { name: 'Survival guide', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('tab', { name: 'Your controls' }).click();
  await expect(page.getByText('Stand your ground', { exact: true })).toBeVisible();
  await expect(page.getByText('Move up, down, left, or right.', { exact: false })).toBeVisible();
  await page.getByRole('tab', { name: 'Expect the unexpected' }).click();
  await expect(page.getByRole('heading', { name: 'Cold snaps' })).toBeVisible();
  const wolfRows = await page.getByRole('img', { name: 'Wolf running animation' }).evaluate(
    (element) =>
      new Promise((resolve) => {
        const rows = new Set(),
          start = performance.now();
        const sample = () => {
          rows.add(getComputedStyle(element).backgroundPositionY);
          if (performance.now() - start < 850) requestAnimationFrame(sample);
          else resolve([...rows]);
        };
        sample();
      }),
  );
  expect(wolfRows).toContain('0px');
  expect(wolfRows).toContain('-36px');
  passed('The generated wolf UI preview plays both rows of its literal sprite sheet');

  await screenshot(page, 'guide');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  passed('Survival guide tabs, keyboard dismissal, and focus restoration work');

  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('switch', { name: 'Reduce motion' }).click();
  await page.getByRole('tab', { name: 'Audio', exact: true }).click();
  await page.getByRole('slider', { name: 'Sound effects volume' }).focus();
  await page.keyboard.press('Home');
  await page.keyboard.press('ArrowRight');
  await expect
    .poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('wildpine.settings.v1')).effects))
    .toBe(0.01);
  expect(
    await page.evaluate(() => JSON.parse(localStorage.getItem('wildpine.settings.v1')).reducedMotion),
  ).toBe(true);
  await page.getByRole('tab', { name: 'Display', exact: true }).click();
  await page.getByRole('switch', { name: 'Reduce motion' }).click();
  await page.keyboard.press('Escape');
  passed('Settings controls persist and reduced-motion mode applies');

  await page.getByRole('button', { name: 'The Alpine, coming soon' }).click();
  await expect(page.getByRole('heading', { name: 'The Alpine', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'The forest is waiting' }).click();
  await page.getByRole('button', { name: 'The Dunes, coming soon' }).click();
  await expect(page.getByRole('heading', { name: 'The Dunes', exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  passed('Both future biomes clearly communicate that only the Forest is playable');

  await page.getByRole('button', { name: 'New adventure', exact: true }).click();
  await page.getByLabel('WHAT SHOULD THE FOREST CALL YOU?', { exact: false }).fill('Robin');
  await screenshot(page, 'setup');
  await page.getByRole('button', { name: 'Enter the forest' }).click();
  await page.locator('.forest-loading').waitFor({ state: 'hidden' });
  await expect(page.locator('.survivor-heading h2')).toHaveText('Robin');
  await expect(page.locator('.interaction-prompt')).toHaveCount(0);
  await expect(page.locator('.game-canvas')).toHaveAttribute('data-collecting', 'none');
  await screenshot(page, 'game-desktop');
  passed('New adventure loads the pixel world and a quiet HUD with no gathering hints over resources');
  await expect(page.getByRole('meter', { name: 'Health', exact: true })).toHaveAttribute(
    'aria-valuenow',
    '100',
  );
  await expect(page.locator('.health-pip')).toHaveCount(10);
  await expect(page.getByRole('meter', { name: 'Warmth', exact: true })).toBeVisible();
  expect(
    await page.locator('.survivor-panel').evaluate((element) => getComputedStyle(element).borderImageSource),
  ).toContain('/art/ui/status-frame.png');
  await page.keyboard.press('j');
  await expect(page.getByRole('heading', { name: 'Notes from a life outside.', exact: true })).toBeVisible();
  await expect(page.locator('.journal-objectives summary')).toContainText('0 / 7');
  await page.keyboard.press('Escape');
  await page.keyboard.press('b');
  const satchel = await page.getByRole('dialog').boundingBox();
  expect(Math.abs(satchel.x + satchel.width / 2 - 720)).toBeLessThan(2);
  await expect(page.getByRole('heading', { name: 'Your satchel', exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  passed('The framed game HUD exposes accurate heart meters, compact objectives, and a centered satchel');
  await page.getByRole('button', { name: 'Survival details', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Your condition', exact: true })).toBeVisible();
  await expect(page.locator('.condition-entry')).toHaveCount(5);
  await expect(page.getByRole('meter', { name: 'Health', exact: true })).toHaveAttribute(
    'aria-valuenow',
    '100',
  );
  await screenshot(page, 'condition');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Survival details', exact: true })).toBeFocused();
  await page.keyboard.press('h');
  await expect(page.getByRole('heading', { name: 'Your condition', exact: true })).toBeVisible();
  await page.keyboard.press('b');
  await expect(page.getByRole('heading', { name: 'Your satchel', exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  passed('Readable survival meters open a full condition menu by pointer or H, then restore focus');

  await expect(page.locator('.game-canvas')).toHaveAttribute('data-sunlight', 'on');
  await expect(page.locator('.game-canvas')).toHaveAttribute('data-ground-texture', 'generated');
  // Cosmetic undergrowth is derived from the seed, so it dresses a fresh world too.
  await expect(page.locator('.game-canvas')).toHaveAttribute('data-decor-count', /^[1-9]\d{2}$/);
  await expect(page.locator('[data-generated-icon="pack"]').first()).toHaveAttribute(
    'src',
    /art\/ui\/backpack\.png$/,
  );
  expect(
    await page
      .locator('[data-generated-icon="pack"]')
      .first()
      .evaluate((image) => image.complete && image.naturalWidth === 24),
  ).toBe(true);

  await expect(page.locator('.quick-slot .item-icon image').first()).toHaveAttribute(
    'href',
    /art\/item-sprites\.png$/,
  );
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.waitForTimeout(150);
  const litCanvas = await page.locator('.game-canvas').evaluate((canvas) => canvas.toDataURL());
  await page.getByRole('switch', { name: 'Forest atmosphere', exact: true }).click();
  await expect(page.locator('.game-canvas')).toHaveAttribute('data-sunlight', 'off');
  await expect(page.locator('.game-canvas')).toHaveAttribute('data-effects', 'off');
  await expect(page.locator('.game-canvas')).toHaveAttribute('data-embers', '0');
  expect(await page.locator('.game-canvas').evaluate((canvas) => canvas.toDataURL())).not.toBe(litCanvas);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('wildpine.settings.v1')).atmosphere)).toBe(
    false,
  );
  await page.getByRole('switch', { name: 'Forest atmosphere', exact: true }).click();
  await expect(page.locator('.game-canvas')).toHaveAttribute('data-sunlight', 'on');
  await page.getByRole('switch', { name: 'Reduce motion', exact: true }).click();
  await expect(page.locator('.game-canvas')).toHaveAttribute('data-effects', 'reduced');
  await expect(page.locator('.game-canvas')).toHaveAttribute('data-embers', '0');
  const stillCanvas = await page.locator('.game-canvas').evaluate((canvas) => canvas.toDataURL());
  await page.waitForTimeout(200);
  expect(await page.locator('.game-canvas').evaluate((canvas) => canvas.toDataURL())).toBe(stillCanvas);
  await page.getByRole('switch', { name: 'Reduce motion', exact: true }).click();
  await expect(page.locator('.game-canvas')).toHaveAttribute('data-effects', 'active');
  await expect(page.locator('.game-canvas')).toHaveAttribute('data-embers', /^[1-9]/);
  passed('Embers and extra motion obey preferences, and paused reduced-motion pixels stay frozen');
  await expect(page.locator('.game-shell')).toHaveAttribute('data-hud', 'compact');
  await expect(page.locator('.minimap-panel')).toBeHidden();
  await page.getByRole('tab', { name: 'Interface', exact: true }).click();
  await page.getByRole('switch', { name: 'Compact HUD', exact: true }).click();
  await expect(page.locator('.minimap-panel')).toBeVisible();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('wildpine.settings.v1')).compactHud)).toBe(
    false,
  );
  await page.getByRole('switch', { name: 'Compact HUD', exact: true }).click();
  await expect(page.locator('.minimap-panel')).toBeHidden();
  passed('Compact HUD removes optional clutter and the full layout remains a persisted preference');

  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Back to the wild', exact: true }).click();
  passed('Sun shafts change actual rendered pixels, can be disabled, and the HUD slices the inventory atlas');

  await page.keyboard.down('e');
  await page.waitForTimeout(4300);
  await page.keyboard.up('e');
  await page.keyboard.press('b');
  await expect(page.getByRole('button', { name: 'Pine wood, 4 in backpack', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Wild berries, 3 in backpack', exact: true }).click();
  await page.getByRole('button', { name: 'Eat berries', exact: true }).click();
  await page.waitForTimeout(800);
  await page.keyboard.press('b');
  await expect(page.getByRole('button', { name: 'Wild berries, 2 in backpack', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Spring water, 3 in backpack', exact: true }).click();
  await page.getByRole('button', { name: 'Drink water', exact: true }).click();
  await page.waitForTimeout(800);
  await page.keyboard.press('b');
  await expect(page.getByRole('button', { name: 'Spring water, 2 in backpack', exact: true })).toBeVisible();
  await screenshot(page, 'inventory');
  await page.keyboard.press('c');
  await expect(page.getByRole('button', { name: 'Craft workbench +1', exact: true })).toBeDisabled();
  await page.keyboard.press('Escape');
  passed('Keyboard gathering, backpack consumption, and missing-material recipe gates work');

  await page.keyboard.press('m');
  await expect(page.getByRole('heading', { name: 'The Forest', exact: true })).toBeVisible();
  await expect(page.locator('.chart-progress')).toContainText('%');
  await screenshot(page, 'map');
  await page.keyboard.press('Escape');
  await page.keyboard.press('j');
  await expect(page.getByText('Found pine wood in the forest.', { exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await page.keyboard.down('s');
  await expect(page.locator('.game-canvas')).toHaveAttribute('data-footprints', /^[1-9]/);
  await page.waitForTimeout(430);
  await page.keyboard.up('s');
  await page.keyboard.press('Escape');
  expect((await saved(page)).player.y).toBeGreaterThan(800);
  const time = (await saved(page)).time;
  await page.waitForTimeout(350);
  await expect(page.getByRole('heading', { name: 'The forest can wait.' })).toBeVisible();
  await page.getByRole('button', { name: 'Save & return to main menu' }).click();
  await page.reload({ waitUntil: 'networkidle' });
  await enter(page);
  expect((await saved(page)).time).toBeGreaterThanOrEqual(time);
  await expect(page.locator('.survivor-heading h2')).toHaveText('Robin');
  await page.keyboard.press('b');
  await expect(page.getByRole('button', { name: 'Wild berries, 2 in backpack', exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  passed('Map, discovered journal entries, movement, pause, save/quit, reload, and Continue work');

  await page.keyboard.press('Escape');
  await checkpoint(page, () => {
    const s = JSON.parse(localStorage.getItem('wildpine.save.v2'));
    Object.assign(s.inventory, { wood: 50, stone: 30, fiber: 30, berries: 10, mushroom: 3 });
    s.player = { x: 940, y: 758 };
    s.workbenches = [{ id: 0, x: 940, y: 738 }];
    s.resources = [];
    localStorage.setItem('wildpine.save.v2', JSON.stringify(s));
  });
  await page.keyboard.press('e');
  await page.locator('.recipe-row').filter({ hasText: 'Forest shelter' }).click();
  await page.getByRole('button', { name: 'Craft forest shelter +1', exact: true }).click();
  await page.keyboard.press('b');
  await page.getByRole('button', { name: 'Forest shelter, 1 in backpack', exact: true }).click();
  await page.getByRole('button', { name: 'Build shelter', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.waitForTimeout(850);
  await page.keyboard.press('Escape');
  expect((await saved(page)).shelters.length).toBe(1);
  expect((await saved(page)).inventory.wood).toBe(40);
  passed('Crafting consumes exact materials and building places a real shelter in the world');

  await checkpoint(page, () => {
    const s = JSON.parse(localStorage.getItem('wildpine.save.v2'));
    s.time = 260;
    s.weather = 'storm';
    s.nights = 1;
    s.player = { x: 900, y: 780 };
    s.fires[0].fuel = 100;
    Object.assign(s.needs, { health: 100, hunger: 100, thirst: 100, warmth: 100 });
    localStorage.setItem('wildpine.save.v2', JSON.stringify(s));
  });
  await expect(page.locator('.weather-chip')).toContainText('Storm');
  await expect(page.locator('.game-canvas')).toHaveAttribute('data-sunlight', 'off');
  await screenshot(page, 'storm');
  await page.keyboard.press('Escape');
  await checkpoint(page, () => {
    const s = JSON.parse(localStorage.getItem('wildpine.save.v2'));
    s.time = 299.85;
    s.weather = 'cold';
    s.wolves = [];
    s.player = { x: 1040, y: 870 };
    localStorage.setItem('wildpine.save.v2', JSON.stringify(s));
  });
  await expect(page.locator('.weather-chip')).toContainText('Howls');
  await page.keyboard.press('Escape');
  expect((await saved(page)).wolves.length).toBe(2);
  await page.getByRole('button', { name: 'Back to the wild' }).click();
  await screenshot(page, 'night');
  await page.keyboard.press('Escape');
  passed('Storm, night lighting, cold events, and wolf-pack spawning render without errors');

  await checkpoint(page, () => {
    const s = JSON.parse(localStorage.getItem('wildpine.save.v2'));
    s.time = 524.9;
    s.nights = 2;
    s.wolves = [];
    s.player = { x: 900, y: 780 };
    Object.assign(s.needs, { health: 100, hunger: 100, thirst: 100, warmth: 100 });
    localStorage.setItem('wildpine.save.v2', JSON.stringify(s));
  });
  await expect(page.getByRole('heading', { name: 'And then, there was morning.' })).toBeVisible();
  await screenshot(page, 'victory');
  await page.getByRole('button', { name: 'Keep wandering' }).click();
  await page.keyboard.press('Escape');
  expect((await saved(page)).victoryAcknowledged).toBe(true);
  await checkpoint(page, () => {
    const s = JSON.parse(localStorage.getItem('wildpine.save.v2'));
    s.player = { x: 100, y: 100 };
    Object.assign(s.needs, { health: 0, hunger: 0, thirst: 0, warmth: 0 });
    localStorage.setItem('wildpine.save.v2', JSON.stringify(s));
  });
  await expect(page.getByRole('heading', { name: 'The wild remembers you.' })).toBeVisible();
  await page.getByRole('button', { name: 'Begin again' }).click();
  await page.locator('.forest-loading').waitFor({ state: 'hidden' });
  await expect(page.locator('.health-row')).toContainText('100');
  await expect(page.getByRole('meter', { name: 'Health', exact: true })).toHaveAttribute(
    'aria-valuenow',
    '100',
  );
  passed('Victory, endless continuation, death, and restart form a complete playable loop');

  // The equipment fixture exercises every item, not just the six default pockets.
  await page.keyboard.press('Escape');
  await checkpoint(page, () => {
    const s = JSON.parse(localStorage.getItem('wildpine.save.v2'));
    for (const id of Object.keys(s.inventory)) s.inventory[id] = 3;
    s.resources = [];
    s.player = { x: 900, y: 870 };
    s.wolves = [];
    s.equipped = null;
    localStorage.setItem('wildpine.save.v2', JSON.stringify(s));
  });
  const itemNames = {
    hatchet: 'Old hatchet',
    pickaxe: 'Stone pickaxe',
    wood: 'Pine wood',
    stone: 'River stone',
    fiber: 'Wild fiber',
    berries: 'Wild berries',
    water: 'Spring water',
    mushroom: 'Golden mushroom',
    bandage: 'Herbal bandage',
    torch: 'Pine torch',
    meal: 'Forest stew',
    campfire: 'Campfire kit',
    shelter: 'Forest shelter',
    nuts: 'Pine nuts',
    tea: 'Berry tea',
    workbench: 'Workbench',
  };
  for (const [id, name] of Object.entries(itemNames)) {
    await page.keyboard.press('b');
    await page.getByRole('button', { name: `${name}, 3 in backpack`, exact: true }).click();
    await page.getByRole('button', { name: `Hold ${name.toLowerCase()}`, exact: true }).click();
    await expect(page.locator('.held-item-status')).toHaveAttribute('data-item', id);
    await expect(page.locator('.game-canvas')).toHaveAttribute('data-held-item', id);
  }
  await page.keyboard.press('Escape');
  expect(Object.values((await saved(page)).inventory).every((n) => n === 3)).toBe(true);
  expect((await saved(page)).shelters).toHaveLength(0);
  await page.getByRole('button', { name: 'Back to the wild' }).click();
  await page.keyboard.press('b');
  await page.getByRole('button', { name: 'Pine wood, 3 in backpack', exact: true }).click();
  await page.getByRole('button', { name: 'Pin Pine wood to slot 6', exact: true }).click();
  await screenshot(page, 'equipment-backpack');
  await page.getByRole('button', { name: 'Hold pine wood', exact: true }).click();
  await page.keyboard.press('6');
  await expect(page.getByRole('button', { name: 'Pine wood, shortcut 6, 3 available' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.keyboard.press('3');
  await expect(page.locator('.held-item-status')).toHaveAttribute('data-item', 'berries');
  await page.keyboard.press('Escape');
  expect((await saved(page)).inventory.berries).toBe(3);
  await page.getByRole('button', { name: 'Back to the wild' }).click();
  await page.locator('.game-canvas').click({ position: { x: 720, y: 390 } });
  await page.waitForTimeout(800);
  await page.keyboard.press('x');
  await expect(page.locator('.held-item-status')).toHaveAttribute('data-item', 'none');
  await page.keyboard.press('Escape');
  expect((await saved(page)).inventory.berries).toBe(2);
  expect((await saved(page)).hotbar[5]).toBe('wood');
  passed(
    'All 16 items can be held; pocket selection, arbitrary slot pinning, left-click use, and stowing work without accidental consumption',
  );

  await checkpoint(page, () => {
    const s = JSON.parse(localStorage.getItem('wildpine.save.v2'));
    s.resources = [{ id: 0, kind: 'tree', x: 930, y: 870, hp: 3, readyAt: 0, scale: 1, variant: 0 }];
    s.player = { x: 900, y: 870 };
    s.direction = 'right';
    s.equipped = 'hatchet';
    s.inventory.wood = 0;
    s.inventory.nuts = 0;
    s.lastInteract = -10;
    s.lastAttack = -10;
    localStorage.setItem('wildpine.save.v2', JSON.stringify(s));
  });
  await page.keyboard.down('e');
  await expect(page.locator('.game-canvas')).toHaveAttribute('data-animation', 'axe-right');
  await expect(page.locator('.game-canvas')).toHaveAttribute('data-sprite-sheet', 'survivor2-right');
  const axeFrames = await page.evaluate(
    () =>
      new Promise((resolve) => {
        const frames = new Set();
        let impacts = 0;
        const start = performance.now();
        const collect = () => {
          const canvas = document.querySelector('.game-canvas');
          if (canvas.dataset.animation === 'axe-right') frames.add(canvas.dataset.frame);
          impacts = Math.max(impacts, Number(canvas.dataset.impactFlashes));
          if (performance.now() - start < 800) requestAnimationFrame(collect);
          else resolve({ frames: [...frames], impacts });
        };
        collect();
      }),
  );
  expect(axeFrames.frames.length).toBeGreaterThanOrEqual(3);
  expect(axeFrames.impacts).toBeGreaterThan(0);
  await screenshot(page, 'axe-in-use');
  await page.waitForTimeout(1400);
  await page.keyboard.up('e');
  await page.keyboard.press('Escape');
  expect((await saved(page)).inventory.wood).toBe(4);
  expect((await saved(page)).inventory.nuts).toBe(1);
  expect((await saved(page)).resources[0].hp).toBe(0);
  passed('Real generated axe frames play through to contact and award wood only on the completed strikes');

  await checkpoint(page, () => {
    const s = JSON.parse(localStorage.getItem('wildpine.save.v2'));
    s.resources = [{ id: 0, kind: 'stone', x: 930, y: 870, hp: 2, readyAt: 0, scale: 1, variant: 0 }];
    s.player = { x: 900, y: 870 };
    s.direction = 'right';
    s.equipped = 'hatchet';
    s.inventory.stone = 0;
    s.lastInteract = -10;
    localStorage.setItem('wildpine.save.v2', JSON.stringify(s));
  });
  await page.keyboard.press('e');
  await page.waitForTimeout(750);
  await expect(page.locator('.game-canvas')).toHaveAttribute('data-held-item', 'hatchet');
  await expect(page.locator('.game-canvas')).toHaveAttribute('data-animation', 'idle-right');
  await page.keyboard.press('2');
  await page.keyboard.down('e');
  await expect(page.locator('.game-canvas')).toHaveAttribute('data-animation', 'mine-right');
  await expect(page.locator('.game-canvas')).toHaveAttribute('data-sprite-sheet', 'survivor2-right');
  await page.keyboard.up('e');
  await page.keyboard.press('b');
  const pausedFrame = await page.locator('.game-canvas').getAttribute('data-frame');
  await page.waitForTimeout(450);
  await expect(page.locator('.game-canvas')).toHaveAttribute('data-frame', pausedFrame);
  expect((await saved(page)).inventory.stone).toBe(0);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(800);
  await page.locator('.game-canvas').click({ position: { x: 780, y: 410 } });
  await expect(page.locator('.game-canvas')).toHaveAttribute('data-animation', 'mine-right');
  await screenshot(page, 'pickaxe-in-use');
  await page.waitForTimeout(800);
  await page.keyboard.press('Escape');
  expect((await saved(page)).inventory.stone).toBe(3);
  expect((await saved(page)).equipped).toBe('pickaxe');
  expect((await saved(page)).resources[0].hp).toBe(0);
  passed(
    'Wrong-tool gathering does not auto-equip; manually choosing the pickaxe enables two pause-safe mining impacts',
  );

  await checkpoint(page, () => {
    const s = JSON.parse(localStorage.getItem('wildpine.save.v2'));
    s.time = 0;
    s.lastInteract = -10;
    s.weather = 'clear';
    s.player = { x: 940, y: 758 };
    s.workbenches = [{ id: 0, x: 940, y: 738 }];
    s.fires = [{ id: 0, x: 900, y: 740, fuel: 80 }];
    s.resources = [];
    s.wolves = [];
    s.needs.hunger = 30;
    s.needs.thirst = 20;
    s.needs.warmth = 20;
    s.inventory.berries = 2;
    s.inventory.water = 1;
    s.inventory.tea = 0;
    s.inventory.nuts = 1;
    s.equipped = 'hatchet';
    localStorage.setItem('wildpine.save.v2', JSON.stringify(s));
  });
  await page.keyboard.press('e');
  await page.getByRole('button', { name: /^Berry tea/ }).click();
  await page.getByRole('button', { name: /^Craft berry tea/ }).click();
  await expect(page.locator('.workshop-feedback')).toContainText('Berry tea crafted');
  await screenshot(page, 'berry-tea-crafting');
  await page.keyboard.press('Escape');
  await page.keyboard.press('b');
  await page.getByRole('button', { name: 'Berry tea, 1 in backpack', exact: true }).click();
  await page.getByRole('button', { name: 'Pin Berry tea to slot 6', exact: true }).click();
  await screenshot(page, 'berry-tea-inventory');
  await page.getByRole('button', { name: 'Hold berry tea', exact: true }).click();
  await expect(page.locator('.held-item-status')).toHaveAttribute('data-item', 'tea');
  await page.locator('.game-canvas').click({ position: { x: 720, y: 390 } });
  await page.waitForTimeout(800);
  await page.keyboard.press('Escape');
  const afterTea = await saved(page);
  expect(afterTea.inventory).toMatchObject({ tea: 0, berries: 0, water: 0, nuts: 1 });
  expect(afterTea.needs.thirst).toBeGreaterThan(44);
  expect(afterTea.needs.warmth).toBeGreaterThan(44);
  expect(afterTea.hotbar[5]).toBe('tea');
  await page.getByRole('button', { name: 'Back to the wild', exact: true }).click();
  await page.keyboard.press('b');
  await page.getByRole('button', { name: 'Pine nuts, 1 in backpack', exact: true }).click();
  await page.getByRole('button', { name: 'Eat pine nuts', exact: true }).click();
  await page.waitForTimeout(800);
  await page.keyboard.press('Escape');
  expect((await saved(page)).inventory.nuts).toBe(0);
  expect((await saved(page)).needs.hunger).toBeGreaterThan(42);
  passed(
    'Generated new supplies work end to end: brew, hold, pin and drink berry tea; eat gathered pine nuts',
  );

  await checkpoint(page, () => {
    const s = JSON.parse(localStorage.getItem('wildpine.save.v2'));
    delete s.inventory.nuts;
    delete s.inventory.tea;
    s.hotbar = ['hatchet', 'pickaxe', 'berries', 'water', 'bandage', 'torch'];
    s.equipped = 'hatchet';
    localStorage.setItem('wildpine.save.v2', JSON.stringify(s));
  });
  await page.keyboard.press('Escape');
  expect((await saved(page)).inventory).toMatchObject({ nuts: 0, tea: 0, wood: 4 });
  passed('Existing version-two saves gain empty new-item slots without losing old resources');

  await checkpoint(page, () => {
    const s = JSON.parse(localStorage.getItem('wildpine.save.v2'));
    s.version = 1;
    delete s.equipped;
    delete s.hotbar;
    delete s.direction;
    delete s.inventory.pickaxe;
    delete s.inventory.nuts;
    delete s.inventory.tea;
    localStorage.removeItem('wildpine.save.v2');
    localStorage.setItem('wildpine.save.v1', JSON.stringify(s));
  });
  await expect(page.locator('.held-item-status')).toHaveAttribute('data-item', 'hatchet');
  await page.keyboard.press('Escape');
  expect((await saved(page)).version).toBe(2);
  expect((await saved(page)).inventory.pickaxe).toBe(1);
  expect(await page.evaluate(() => localStorage.getItem('wildpine.save.v1'))).toBeNull();
  passed('Version-one saves migrate in the real browser without losing gathered resources');

  await checkpoint(page, () => {
    const s = JSON.parse(localStorage.getItem('wildpine.save.v2'));
    s.player = { x: 500, y: 500 };
    s.resources = [];
    s.fires = [];
    s.wolves = [];
    s.direction = 'down';
    s.time = 20;
    s.needs = { health: 100, hunger: 90, thirst: 90, warmth: 90, stamina: 100 };
    localStorage.setItem('wildpine.save.v2', JSON.stringify(s));
  });
  await page.evaluate(() => {
    const canvas = document.querySelector('.game-canvas');
    for (const key of ['w', 'd']) canvas.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
  });
  await expect(page.locator('.game-canvas')).toHaveAttribute('data-facing', 'right');
  const gaitFrames = await page.evaluate(
    () =>
      new Promise((resolve) => {
        const frames = new Set(),
          start = performance.now();
        const sample = () => {
          frames.add(Number(document.querySelector('.game-canvas').dataset.frame));
          if (performance.now() - start < 450) requestAnimationFrame(sample);
          else resolve([...frames]);
        };
        sample();
      }),
  );
  expect(gaitFrames.length).toBeGreaterThan(1);
  expect(gaitFrames.every((frame) => [0, 1, 2, 3, 4, 5].includes(frame))).toBe(true);
  await page.keyboard.up('w');
  await page.keyboard.up('d');
  await page.keyboard.press('Escape');
  const cardinal = await saved(page);
  expect(cardinal.player.x).toBeGreaterThan(500);
  expect(cardinal.player.y).toBe(500);
  expect(cardinal.direction).toBe('right');
  await page.getByRole('button', { name: 'Save & return to main menu', exact: true }).click();
  await page.reload({ waitUntil: 'networkidle' });
  await enter(page);
  await expect(page.locator('.game-canvas')).toHaveAttribute('data-facing', 'right');
  await screenshot(page, 'carry-axe-outward');
  await page.keyboard.press('Escape');
  passed(
    'Held keyboard combinations move on only the latest cardinal axis, keep clean gait cells, and save correctly',
  );

  await checkpoint(page, () => {
    const state = JSON.parse(localStorage.getItem('wildpine.save.v2'));
    state.player = { x: 500, y: 500 };
    state.distance = 0;
    state.direction = 'down';
    localStorage.setItem('wildpine.save.v2', JSON.stringify(state));
  });
  const ground = page.locator('.game-canvas');
  const groundBox = await ground.boundingBox();
  // The renderer uses a two-screen-pixel world scale, with feet 24px above center.
  await ground.click({
    button: 'right',
    position: { x: groundBox.width / 2 + 60, y: groundBox.height / 2 + 8 },
  });
  await expect(ground).toHaveAttribute('data-facing', 'right');
  await expect(ground).toHaveAttribute('data-facing', 'down');
  await expect(ground).toHaveAttribute('data-animation', 'idle-down');
  await page.keyboard.press('Escape');
  const clicked = await saved(page);
  expect(clicked.player.x).toBeCloseTo(530, 5);
  expect(clicked.player.y).toBeCloseTo(516, 5);
  expect(clicked.distance).toBeCloseTo(46, 5);
  passed('Right-click movement takes two straight legs, not a diagonal or a staircase shortcut');

  await checkpoint(page, () => {
    const state = JSON.parse(localStorage.getItem('wildpine.save.v2'));
    state.player = { x: 500, y: 500 };
    state.direction = 'up-left';
    state.inventory.wood = 23;
    localStorage.setItem('wildpine.save.v2', JSON.stringify(state));
  });
  await expect(page.locator('.game-canvas')).toHaveAttribute('data-facing', 'up');
  await expect(page.locator('.game-canvas')).toHaveAttribute('data-animation', 'idle-up');
  await page.keyboard.press('Escape');
  const oldFacing = await saved(page);
  expect(oldFacing.direction).toBe('up');
  expect(oldFacing.inventory.wood).toBe(23);
  expect(oldFacing.player).toEqual({ x: 500, y: 500 });
  passed('Existing diagonal-facing saves resume with a cardinal pose without losing position or supplies');

  await checkpoint(page, () => {
    const s = JSON.parse(localStorage.getItem('wildpine.save.v2'));
    s.player = { x: 500, y: 500 };
    s.resources = [{ id: 0, kind: 'berries', x: 520, y: 500, hp: 1, readyAt: 0, scale: 1, variant: 0 }];
    s.inventory.berries = 0;
    s.inventory.fiber = 0;
    s.lastInteract = -10;
    localStorage.setItem('wildpine.save.v2', JSON.stringify(s));
  });
  await page.keyboard.down('e');
  await expect(page.locator('.game-canvas')).toHaveAttribute('data-animation', 'forage-right');
  await page.waitForTimeout(850);
  await expect(page.locator('.game-canvas')).toHaveAttribute('data-collecting', '0');
  const halfCircle = Number(await page.locator('.game-canvas').getAttribute('data-collection-progress'));
  expect(halfCircle).toBeGreaterThan(0.3);
  expect(halfCircle).toBeLessThan(0.7);
  await expect(page.locator('.quick-slot.active .torch-timer')).toHaveCount(0);
  expect((await saved(page)).inventory.berries).toBe(0);
  await screenshot(page, 'berry-gathering');
  await page.waitForTimeout(1250);
  await page.keyboard.up('e');
  await page.keyboard.press('Escape');
  const picked = await saved(page);
  expect(picked.player).toEqual({ x: 500, y: 500 });
  expect(picked.inventory.berries).toBe(3);
  expect(picked.inventory.fiber).toBe(1);
  await expect(page.locator('.game-canvas')).toHaveAttribute('data-collecting', 'none');
  passed('Wild berries take a visible timed circle and only pay out when it fills, with feet planted');

  // Release the desktop Canvas loop before measuring touch input on mobile.
  await page.close();
  const mobile = await browser.newPage({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  watch(mobile);
  await mobile.goto(base, { waitUntil: 'networkidle' });
  await noOverflow(mobile);
  await screenshot(mobile, 'menu-mobile');
  await mobile.getByRole('button', { name: 'Fieldcraft', exact: true }).click();
  await mobile.getByRole('textbox', { name: 'Find an item', exact: true }).fill('mushroom');
  await mobile.getByRole('button', { name: 'Golden mushroom', exact: true }).click();
  await expect(mobile.locator('.fieldcraft-detail')).toContainText('Restores 12 hunger');
  await noOverflow(mobile);
  await screenshot(mobile, 'fieldcraft-mobile');
  await mobile.getByRole('tab', { name: 'Camp recipes', exact: true }).click();
  await mobile.getByText('1 spring water', { exact: true }).scrollIntoViewIfNeeded();
  await expect(mobile.getByText('1 spring water', { exact: true })).toBeVisible();
  await mobile.getByRole('button', { name: 'Close dialog', exact: true }).click();

  await mobile.getByRole('button', { name: 'New adventure', exact: true }).click();
  await mobile.getByLabel('WHAT SHOULD THE FOREST CALL YOU?', { exact: false }).fill('Fern');
  await mobile.getByRole('radio', { name: 'Explorer', exact: true }).click();
  await mobile.getByRole('button', { name: 'Enter the forest' }).click();
  await mobile.locator('.forest-loading').waitFor({ state: 'hidden' });
  await mobile.getByRole('button', { name: 'Survival details', exact: true }).click();
  await noOverflow(mobile);
  await screenshot(mobile, 'condition-mobile');
  await mobile.getByRole('button', { name: 'Close dialog', exact: true }).click();

  await expect(mobile.getByRole('button', { name: 'Move down', exact: true })).toBeVisible();
  const box = await mobile.getByRole('button', { name: 'Move down', exact: true }).boundingBox();
  await mobile.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await mobile.mouse.down();
  await mobile.waitForTimeout(650);
  await mobile.mouse.up();
  await expect(mobile.locator('.touch-dpad button')).toHaveCount(4);
  await expect(mobile.getByRole('button', { name: /Move (up|down) and (left|right)/ })).toHaveCount(0);
  const rightButton = await mobile.getByRole('button', { name: 'Move right', exact: true }).boundingBox();
  await mobile.mouse.move(rightButton.x + rightButton.width / 2, rightButton.y + rightButton.height / 2);
  await mobile.mouse.down();
  await expect(mobile.locator('.game-canvas')).toHaveAttribute('data-facing', 'right');
  await mobile.waitForTimeout(450);
  await mobile.mouse.up();
  await expect(mobile.locator('.game-canvas')).toHaveAttribute('data-animation', 'idle-right');
  passed('The mobile pad has only four cardinal buttons and releases without sticky movement');
  await mobile.getByRole('button', { name: 'Wild berries, shortcut 3, 3 available', exact: true }).click();
  await expect(mobile.locator('.held-item-status')).toHaveAttribute('data-item', 'berries');
  const useButton = mobile.locator('.touch-primary');
  const useBox = await useButton.boundingBox();
  await mobile.mouse.click(useBox.x + useBox.width / 2, useBox.y + useBox.height / 2);
  await mobile.waitForTimeout(800);
  await expect(
    mobile.getByRole('button', { name: 'Wild berries, shortcut 3, 2 available', exact: true }),
  ).toBeVisible();
  await screenshot(mobile, 'game-mobile');
  await mobile.getByRole('button', { name: 'Open backpack', exact: true }).click();
  await noOverflow(mobile);
  await screenshot(mobile, 'inventory-mobile');
  await mobile.getByRole('button', { name: 'Close dialog', exact: true }).click();
  await mobile.getByRole('button', { name: 'Pause game', exact: true }).click();
  expect((await saved(mobile)).player.y).toBeGreaterThan(800);
  expect((await saved(mobile)).player.x).toBeGreaterThan(900);
  passed('Mobile layouts fit without horizontal overflow and on-screen movement/backpack controls work');
  await mobile.getByRole('button', { name: 'Back to the wild', exact: true }).click();
  await mobile.setViewportSize({ width: 844, height: 390 });
  await noOverflow(mobile);
  for (const selector of ['.quickbar', '.touch-dpad', '.touch-actions', '.survivor-panel']) {
    const bounds = await mobile.locator(selector).boundingBox();
    expect(bounds.x).toBeGreaterThanOrEqual(0);
    expect(bounds.y).toBeGreaterThanOrEqual(0);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(844);
    expect(bounds.y + bounds.height).toBeLessThanOrEqual(390);
  }
  await screenshot(mobile, 'game-landscape');
  passed('Landscape touch layouts keep the game HUD and action controls inside the viewport');
  await mobile.getByRole('button', { name: 'Pause game', exact: true }).click();
  await mobile.getByRole('button', { name: 'Your condition', exact: true }).click();
  await expect(mobile.getByRole('heading', { name: 'Your condition', exact: true })).toBeVisible();
  await mobile.getByRole('button', { name: 'Close dialog', exact: true }).click();
  await expect(mobile.getByRole('heading', { name: 'The forest can wait.', exact: true })).toBeVisible();
  await mobile.getByRole('button', { name: 'Save & return to main menu', exact: true }).click();
  await expect(mobile.locator('.camp-save-summary')).toContainText('Fern’s camp');
  await noOverflow(mobile);
  expect(await mobile.evaluate(() => document.documentElement.scrollHeight)).toBe(390);
  expect(
    await mobile.locator('.title-menu-button').evaluateAll((buttons) =>
      buttons.every((button) => {
        const label = button.querySelector('span:not(.menu-pointer)'),
          box = button.getBoundingClientRect(),
          text = label.getBoundingClientRect();
        return text.right <= box.right - 3 && text.height < box.height;
      }),
    ),
  ).toBe(true);
  await screenshot(mobile, 'menu-landscape');
  await mobile.getByRole('button', { name: "Resume Fern's camp", exact: true }).click();
  await mobile.locator('.forest-loading').waitFor({ state: 'hidden' });
  await expect(mobile.locator('.survivor-heading h2')).toHaveText('Fern');
  passed('Pause submenus return correctly and the landscape title screen resumes the saved camp');

  expect(errors).toEqual([]);
  console.log(
    `\n${checks} browser scenarios passed. No uncaught browser errors. Screenshots: .cache/screenshots/`,
  );
} finally {
  await browser.close();
}
