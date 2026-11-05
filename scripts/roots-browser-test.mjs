/** Roots & Refuge: earned workbenches, dynamic pockets, whole seated state. */
import { expect } from '@playwright/test';
import { base, launchBrowser, screenshot } from './browser-helpers.mjs';

const browser = await launchBrowser(),
  errors = [];
let checks = 0,
  template;
const passed = (text) => {
  checks++;
  console.log(`✓ ${text}`);
};
const watch = (page) => {
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('response', (response) => {
    if (response.status() >= 400) errors.push(`${response.status()}: ${response.url()}`);
  });
};
const saved = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('wildpine.save.v2')));
const enter = async (page) => {
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.locator('.forest-loading').waitFor({ state: 'hidden' });
};
const menu = async (page) => {
  if (!(await page.locator('.game-shell').count())) return;
  const paused = () => page.getByRole('heading', { name: 'The forest can wait.', exact: true });
  if ((await page.getByRole('dialog').count()) && !(await paused().count()))
    await page.keyboard.press('Escape');
  if (!(await paused().count())) await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Save & return to main menu', exact: true }).click();
};
const fixture = async (page, patch = {}, settings = {}) => {
  await menu(page);
  const state = {
    ...structuredClone(template),
    player: { x: 500, y: 500 },
    resources: [],
    fires: [],
    workbenches: [],
    wolves: [],
    time: 20,
    weather: 'clear',
    lastInteract: -10,
    lastAttack: -10,
    ...patch,
  };
  state.inventory = { ...template.inventory, ...patch.inventory };
  state.needs = { health: 100, hunger: 80, thirst: 80, warmth: 90, stamina: 100, ...patch.needs };
  await page.evaluate(
    ({ state, settings }) => {
      localStorage.setItem('wildpine.save.v2', JSON.stringify(state));
      localStorage.setItem(
        'wildpine.settings.v1',
        JSON.stringify({ sound: false, compactHud: true, ...settings }),
      );
    },
    { state, settings },
  );
  await page.reload({ waitUntil: 'networkidle' });
  await enter(page);
};
const position = (page, dx, dy) =>
  page.locator('.game-canvas').evaluate(
    (node, { dx, dy }) => ({
      x: ((Math.ceil(node.width / 2) + dx) * node.clientWidth) / node.width,
      y: ((Math.ceil(node.height / 2) - 12 + dy) * node.clientHeight) / node.height,
    }),
    { dx, dy },
  );
const clickAt = async (page, dx, dy, button = 'left') =>
  page.locator('.game-canvas').click({ button, position: await position(page, dx, dy) });
const move = async (page, dx, dy) => {
  await clickAt(page, dx, dy, 'right');
  await page.waitForTimeout(((Math.abs(dx) + Math.abs(dy)) / 58) * 1000 + 180);
  await expect(page.locator('.game-canvas')).toHaveAttribute('data-animation', /^idle-/);
};
const noOverflow = async (page) => {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  for (const selector of [
    '.satchel-dialog .modal-panel',
    '.fieldwork-dialog .modal-panel',
    '.satchel-grid',
    '.satchel-detail',
    '.satchel-pocket-row',
  ]) {
    const node = page.locator(selector);
    if (await node.count())
      expect(await node.evaluate((el) => el.scrollWidth <= el.clientWidth + 1), selector).toBe(true);
  }
};
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  watch(page);
  await page.goto(base, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'New adventure', exact: true }).click();
  await page.getByRole('button', { name: 'Enter the forest', exact: true }).click();
  await page.locator('.forest-loading').waitFor({ state: 'hidden' });
  const canvas = page.locator('.game-canvas');
  template = await saved(page);
  expect(template.workbenches).toEqual([]);
  expect(template.inventory.workbench).toBe(0);
  await expect(canvas).toHaveAttribute('data-workbench-count', '0');
  await expect(canvas).toHaveAttribute('data-camp-ground', 'generated');
  await screenshot(page, 'roots-spawn');
  await page.keyboard.press('c');
  await expect(page.getByRole('heading', { name: 'Handcraft', exact: true })).toBeVisible();
  await expect(page.locator('.workshop-recipe')).toHaveCount(3);
  await expect(page.locator('.workshop-recipe').filter({ hasText: 'Forest shelter' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Craft workbench +1', exact: true })).toBeDisabled();
  await screenshot(page, 'roots-handcraft-desktop');
  await noOverflow(page);
  await page.keyboard.press('Escape');
  passed('A new forest has no free station or kit; C shows only the three hand-made essentials');

  // Earn a station with actual gathering and cardinal navigation, not edited stock.
  await page.keyboard.down('e');
  await page.waitForTimeout(1820);
  await page.keyboard.up('e');
  await expect(canvas).toHaveAttribute('data-chop-leaves', /^[1-9]/);
  await page.waitForTimeout(850);
  await expect(canvas).toHaveAttribute('data-stumps', '1');
  await screenshot(page, 'roots-stump-and-leaves');
  await page.keyboard.press('e');
  await page.waitForTimeout(730); // nearby fiber
  await move(page, -38, -21);
  for (let i = 0; i < 3; i++) {
    await clickAt(page, -37, -40);
    await page.waitForTimeout(710);
  }
  await page.keyboard.press('b');
  await expect(page.getByRole('button', { name: 'Pine wood, 8 in backpack', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Wild fiber, 3 in backpack', exact: true })).toBeVisible();
  await page.keyboard.press('c');
  await page.getByRole('button', { name: 'Craft workbench +1', exact: true }).click();
  await expect(page.locator('.workshop-feedback')).toContainText('Workbench crafted');
  await page.keyboard.press('b');
  await page.getByRole('button', { name: 'Workbench, 1 in backpack', exact: true }).click();
  await page.getByRole('button', { name: 'Pin Workbench to slot 6', exact: true }).click();
  await page.getByRole('button', { name: 'Place workbench', exact: true }).click();
  await expect(canvas).toHaveAttribute('data-held-item', 'workbench');
  await expect(canvas).toHaveAttribute('data-workbench-count', '0');
  await canvas.hover({ position: await position(page, 38, 20) });
  await expect(canvas).toHaveAttribute('data-placement', 'valid');
  await screenshot(page, 'roots-workbench-placement');
  await clickAt(page, 38, 20);
  await expect(canvas).toHaveAttribute('data-workbench-count', '1');
  await page.waitForTimeout(700);
  await page.keyboard.press('Escape');
  let state = await saved(page);
  expect(state.inventory).toMatchObject({ wood: 2, fiber: 0, workbench: 0 });
  expect(state.workbenches).toHaveLength(1);
  expect(state.hotbar[5]).toBe('workbench');
  await page.getByRole('button', { name: 'Back to the wild', exact: true }).click();
  await move(page, 18, 0);
  await move(page, 0, 15);
  await expect(page.locator('.interaction-prompt')).toContainText('Use workbench');
  await page.keyboard.press('c');
  await expect(page.locator('.workshop-recipe')).toHaveCount(3);
  await page.keyboard.press('Escape');
  await page.keyboard.press('e');
  await expect(page.getByRole('heading', { name: 'Your workbench', exact: true })).toBeVisible();
  await expect(page.locator('.workshop-recipe')).toHaveCount(8);
  await screenshot(page, 'roots-earned-workbench');
  await menu(page);
  await page.reload({ waitUntil: 'networkidle' });
  await enter(page);
  await expect(canvas).toHaveAttribute('data-workbench-count', '1');
  passed(
    'Real wood/fiber gathering earns a kit; manual placement consumes it once, E unlocks the workshop, and the station survives reload',
  );

  await fixture(page);
  await page.keyboard.press('b');
  await expect(page.locator('.satchel-slot')).toHaveCount(5);
  for (const image of await page.locator('.satchel-slot-picture .item-icon').all())
    await expect(image).toBeVisible();
  await page.getByRole('checkbox', { name: 'Show missing items', exact: true }).check();
  await expect(page.locator('.satchel-slot')).toHaveCount(16);
  await page.getByRole('button', { name: 'Workbench, 0 in backpack', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Hold workbench', exact: true })).toBeDisabled();
  await page.getByRole('checkbox', { name: 'Show missing items', exact: true }).uncheck();
  await page.getByRole('textbox', { name: 'Search backpack', exact: true }).fill('WATER');
  await expect(page.locator('.satchel-slot')).toHaveCount(1);
  await expect(page.locator('.satchel-detail h3')).toHaveText('Spring water');
  await page.getByRole('textbox', { name: 'Search backpack', exact: true }).fill('nowhere');
  await expect(page.locator('.satchel-empty')).toContainText('No finds');
  await expect(page.locator('.inventory-item-actions')).toHaveCount(0);
  await page.getByRole('button', { name: 'Clear filters', exact: true }).click();
  await page.getByRole('combobox', { name: 'Sort backpack', exact: true }).selectOption('quantity');
  await expect(page.locator('.satchel-slot').first()).toHaveAttribute('data-item', 'water');
  await page.locator('.satchel-categories button').filter({ hasText: 'Tools' }).click();
  await expect(page.locator('.satchel-slot')).toHaveCount(2);
  await page.locator('.satchel-categories button').filter({ hasText: 'All' }).click();
  await noOverflow(page);
  await screenshot(page, 'roots-satchel-desktop');
  passed(
    'The satchel shows owned stock, real icons, optional missing items, search/empty states, category counts and quantity sorting',
  );

  const berries = page.getByRole('button', { name: 'Wild berries, 3 in backpack', exact: true });
  await berries.dragTo(page.locator('[data-pocket="6"] > button').first());
  await expect(page.locator('.inventory-feedback')).toContainText('pinned to pocket 6');
  await page.getByRole('button', { name: 'Clear pocket 6', exact: true }).click();
  await expect(page.locator('[data-pocket="6"] .item-icon')).toHaveCount(0);
  await berries.focus();
  await page.keyboard.press('Enter');
  await page.getByRole('button', { name: 'Pin Wild berries to slot 6', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('[data-pocket="6"] .item-icon')).toHaveCount(1);
  await menu(page);
  state = await saved(page);
  expect(state.hotbar[5]).toBe('berries');
  expect(state.inventory.berries).toBe(3);
  expect(state.equipped).toBe('hatchet');
  passed(
    'Real drag/drop, keyboard pinning and unpinning update pockets without consuming or silently equipping items',
  );

  await fixture(page, { inventory: { nuts: 1 } }, { reducedMotion: true });
  await page.keyboard.press('b');
  expect(
    await page
      .locator('.satchel-slot-picture')
      .first()
      .evaluate((el) => getComputedStyle(el).animationName),
  ).toBe('none');
  await page.getByRole('button', { name: 'Pine nuts, 1 in backpack', exact: true }).click();
  await page.getByRole('button', { name: 'Eat pine nuts', exact: true }).click();
  await page.waitForTimeout(750);
  await page.keyboard.press('b');
  await expect(page.locator('.satchel-slot')).toHaveCount(5);
  await expect(page.getByRole('button', { name: /Pine nuts, / })).toHaveCount(0);
  await page.getByRole('checkbox', { name: 'Show missing items', exact: true }).check();
  await page.getByRole('button', { name: 'Pine nuts, 0 in backpack', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Eat pine nuts', exact: true })).toBeDisabled();
  passed(
    'Using the last supply removes its owned tile, missing-item actions stay disabled, and inventory animation obeys reduced motion',
  );

  await fixture(page, {
    player: { x: 900, y: 772 },
    resources: template.resources,
    fires: [{ id: 0, x: 900, y: 740, fuel: 30 }],
    inventory: { wood: 3 },
  });
  await expect(canvas).toHaveAttribute('data-camp-approach', 'true');
  await expect(canvas).toHaveAttribute('data-seated', 'true');
  await expect(page.locator('.campfire-scene')).toBeVisible();
  await expect(canvas).toHaveAttribute('data-animation', 'bench-seated');
  await expect(page.locator('.game-hud')).toBeHidden();
  await screenshot(page, 'roots-camp-seated');
  await page.getByRole('button', { name: 'Add one pine log', exact: true }).click();
  await expect(page.locator('.hearth-supply-line b')).toHaveText('2');
  await expect(canvas).toHaveAttribute('data-seated', 'true');
  await page.keyboard.down('s');
  await page.waitForTimeout(160);
  await page.keyboard.up('s');
  await expect(canvas).toHaveAttribute('data-seated', 'false');
  await expect(page.locator('.game-hud')).toBeVisible();
  passed(
    'The player physically approaches the camp bench, sits as one complete generated state, feeds while seated, and stands on movement',
  );

  await fixture(page, {
    time: 120,
    weather: 'wolves',
    wolves: [{ id: 1, x: 590, y: 500, hp: 4, maxHp: 4, cooldown: 0, scared: 0 }],
  });
  await expect(canvas).toHaveAttribute('data-wolf-attack', /pounce/);
  await expect(page.locator('.wolf-encounter')).toContainText('pounce');
  await screenshot(page, 'roots-wolf-pounce');
  await page.keyboard.down('w');
  await page.waitForTimeout(1300);
  await page.keyboard.up('w');
  await page.keyboard.press('Escape');
  state = await saved(page);
  expect(state.needs.health).toBe(100);
  expect(state.wolves[0].maxHp).toBe(4);
  passed('A stronger four-health wolf telegraphs a distinct pounce that a cardinal dodge can escape');
  await menu(page);
  await page.close();

  const mobile = await browser.newPage({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  watch(mobile);
  await mobile.goto(base, { waitUntil: 'networkidle' });
  const stock = Object.fromEntries(Object.keys(template.inventory).map((key) => [key, 3]));
  for (const [width, height, label] of [
    [390, 844, 'mobile'],
    [320, 568, 'small-phone'],
    [844, 390, 'landscape'],
  ]) {
    await mobile.setViewportSize({ width, height });
    await fixture(mobile, { inventory: stock });
    await mobile.getByRole('button', { name: 'Open backpack', exact: true }).tap();
    await noOverflow(mobile);
    await screenshot(mobile, `roots-satchel-${label}`);
    await mobile.getByRole('textbox', { name: 'Search backpack', exact: true }).fill('Pine wood');
    await mobile.getByRole('button', { name: 'Pine wood, 3 in backpack', exact: true }).tap();
    const pin = mobile.getByRole('button', { name: 'Pin Pine wood to slot 6', exact: true });
    await pin.scrollIntoViewIfNeeded();
    await pin.tap();
    await expect(mobile.locator('.inventory-feedback')).toContainText('pinned to pocket 6');
    await noOverflow(mobile);
    await mobile.getByRole('button', { name: 'Clear pocket 6', exact: true }).tap();
    await expect(mobile.locator('[data-pocket="6"] .item-icon')).toHaveCount(0);
    const close = mobile.getByRole('button', { name: 'Close dialog', exact: true });
    await close.scrollIntoViewIfNeeded();
    await close.tap();
    await mobile.getByRole('button', { name: 'Handcraft', exact: true }).tap();
    await noOverflow(mobile);
    await screenshot(mobile, `roots-handcraft-${label}`);
    const craft = mobile.getByRole('button', { name: 'Craft workbench +1', exact: true });
    await craft.scrollIntoViewIfNeeded();
    await expect(craft).toBeDisabled();
    await close.scrollIntoViewIfNeeded();
    await close.tap();
    await mobile.getByRole('button', { name: 'Open backpack', exact: true }).tap();
    await mobile.getByRole('button', { name: 'Workbench, 3 in backpack', exact: true }).tap();
    await mobile.getByRole('button', { name: 'Place workbench', exact: true }).tap();
    await expect(mobile.locator('.game-canvas')).toHaveAttribute('data-workbench-count', '0');
    await mobile.locator('.touch-primary').tap();
    await expect(mobile.locator('.game-canvas')).toHaveAttribute('data-workbench-count', '1');
    await mobile.keyboard.press('Escape');
    expect((await saved(mobile)).inventory.workbench).toBe(2);
    passed(
      `Satchel filtering, tap-to-pin/unpin, handcraft, touch placement and dismissal fit ${width}×${height} without horizontal clipping`,
    );
  }
  await mobile.setViewportSize({ width: 320, height: 568 });
  await fixture(mobile, {
    time: 120,
    weather: 'wolves',
    wolves: [{ id: 1, x: 590, y: 500, hp: 4, maxHp: 4, cooldown: 0, scared: 0 }],
  });
  await expect(mobile.locator('.wolf-encounter')).toContainText('Heavy pounce incoming.');
  const warning = await mobile.locator('.wolf-encounter').boundingBox(),
    vitals = await mobile.locator('.survivor-panel').boundingBox();
  expect(warning.x).toBeGreaterThanOrEqual(vitals.x + vitals.width);
  expect(warning.x + warning.width).toBeLessThanOrEqual(320);
  await screenshot(mobile, 'roots-pounce-small-phone');
  passed('The heavy-pounce warning stays readable on a 320px phone without covering survival gauges');
  await mobile.close();
  expect(errors).toEqual([]);
  console.log(`\n${checks} Roots & Refuge browser scenarios passed. No unexpected browser/network errors.`);
} finally {
  await browser.close();
}
