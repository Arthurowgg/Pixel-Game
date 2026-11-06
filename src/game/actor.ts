import { drawItem } from './animation';
import type { Direction, ItemId } from './types';

/**
 * The survivor is drawn from one small, hand-authored pixel rig instead of the
 * stitched AI pose cells. Every frame therefore shares the same head, eye, arm
 * and boot geometry: the walk cycle cannot detach a leg, a swing cannot rotate
 * the axe into the character, and the tool always turns around one grip point.
 *
 * Motion is interpolated from continuous simulation time, so limbs animate at
 * display refresh rate instead of stepping through eight fixed cells.
 */

export interface ActorAction {
  kind: string;
  item: ItemId | null;
  progress: number;
  direction: Direction;
}

export interface ActorInput {
  x: number;
  y: number;
  time: number;
  gait: number;
  moving: boolean;
  sprinting: boolean;
  direction: Direction;
  equipped: ItemId | null;
  torchLit: boolean;
  action: ActorAction | null;
  reducedMotion: boolean;
}

const OUTLINE = '#2b1d14';
const HAIR = '#5d3c22';
const HAIR_LIGHT = '#7d5734';
const SKIN = '#f2cba1';
const SKIN_SHADE = '#d8ab7d';
const COAT = '#c9612f';
const COAT_LIGHT = '#e07a3e';
const COAT_SHADE = '#a34a24';
const PANTS = '#4f5c43';
const PANTS_SHADE = '#3c4833';
const BOOT = '#38291d';
const PACK = '#75804c';
const PACK_DARK = '#586238';
const STRAP = '#3d472a';
const BELT = '#5a3f28';
const BUCKLE = '#cfa96d';
const SCARF = '#e0cfa6';
const EYE = '#20150f';
const WHITE = '#fbf2dc';

type Ctx = CanvasRenderingContext2D;

const rad = (degrees: number) => (degrees * Math.PI) / 180;
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const ease = (t: number) => t * t * (3 - 2 * t);

function keys(p: number, frames: [number, number][]): number {
  const t = Math.max(0, Math.min(1, p));
  if (t <= frames[0][0]) return frames[0][1];
  for (let i = 1; i < frames.length; i++) {
    const [t1, v1] = frames[i];
    const [t0, v0] = frames[i - 1];
    if (t <= t1) return lerp(v0, v1, ease((t - t0) / Math.max(1e-6, t1 - t0)));
  }
  return frames[frames.length - 1][1];
}

let outlinePass = false;

function px(ctx: Ctx, x: number, y: number, w: number, h: number, color: string) {
  ctx.fillStyle = outlinePass ? OUTLINE : color;
  const ix = Math.round(x),
    iy = Math.round(y),
    iw = Math.max(1, Math.round(w)),
    ih = Math.max(1, Math.round(h));
  if (outlinePass) ctx.fillRect(ix - 1, iy - 1, iw + 2, ih + 2);
  else ctx.fillRect(ix, iy, iw, ih);
}

const HEAD_FRONT = [
  '..H.H.H..',
  '.HHHHHHH.',
  'HHHHHHHHH',
  'HHhHHHhHH',
  '.HSSSSSH.',
  '.HEWSSEW.',
  '.HSSSSSH.',
  '..HSSSH..',
  '...SSS...',
];
const HEAD_SIDE = [
  '..HH.HH..',
  '.HHHHHHH.',
  'HHHHHHHH.',
  'HHHHHHHHH',
  'HHhHHHSSS',
  'HHHHHSEWS',
  'HHHsHHSSS',
  '.HHHHHSS.',
  '..HHHHHS.',
];
const HEAD_BACK = [
  '..HhHHH..',
  '.HHHHHHH.',
  'HHHHHHHHH',
  'HHhHHHHHH',
  'HHHHHHHHH',
  'HHHHHHHHH',
  'HHHHHHHHH',
  '.HHHHHHH.',
  '..HHHHH..',
];

function sprite(ctx: Ctx, rows: string[], x: number, y: number, palette: Record<string, string>) {
  for (let row = 0; row < rows.length; row++) {
    const line = rows[row];
    for (let col = 0; col < line.length; col++) {
      const ch = line[col];
      if (ch === '.' || ch === ' ') continue;
      const color = palette[ch];
      if (color) px(ctx, x + col, y + row, 1, 1, color);
    }
  }
}

/** Interior separations exist only in the fill pass; the outline pass must stay merged. */
function seam(ctx: Ctx, x: number, y: number, w: number, h: number) {
  if (!outlinePass) px(ctx, x, y, w, h, OUTLINE);
}

function box(ctx: Ctx, x: number, y: number, w: number, h: number, fill: string) {
  px(ctx, x, y, w, h, fill);
}

/** One shared thickness for both arms and both legs. */
function limb(
  ctx: Ctx,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  width: number,
  fill: string,
  outlined = true,
) {
  const dx = x2 - x1,
    dy = y2 - y1;
  const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy))));
  void outlined;
  for (let i = 0; i <= steps; i++) {
    const x = x1 + (dx * i) / steps,
      y = y1 + (dy * i) / steps;
    px(ctx, x - width / 2, y - width / 2, width, width, fill);
  }
}

interface Rig {
  handX: number;
  handY: number;
  angle: number;
  lean: number;
  bow: number;
  crouch: number;
  trail: number;
}

const READY: Rig = { handX: 6, handY: -15, angle: 40, lean: 0, bow: 0, crouch: 0, trail: 0 };

function rigFor(action: ActorAction | null): Rig {
  if (!action) return { ...READY };
  const p = Math.max(0, Math.min(1, action.progress));
  const swing = (
    ready: number,
    windX: number,
    windY: number,
    windAngle: number,
    strikeX: number,
    strikeY: number,
    strikeAngle: number,
    trail: [number, number],
  ): Rig => ({
    handX: keys(p, [
      [0, ready],
      [0.26, windX],
      [0.42, strikeX],
      [0.58, strikeX - 1],
      [0.78, ready - 1],
      [1, ready],
    ]),
    handY: keys(p, [
      [0, -14],
      [0.26, windY],
      [0.42, strikeY],
      [0.58, strikeY],
      [0.78, -13],
      [1, -14],
    ]),
    angle: keys(p, [
      [0, 24],
      [0.26, windAngle],
      [0.42, strikeAngle],
      [0.58, strikeAngle + 18],
      [0.78, 40],
      [1, 24],
    ]),
    lean: keys(p, [
      [0, 0],
      [0.26, -1],
      [0.42, 2],
      [0.6, 1],
      [1, 0],
    ]),
    bow: keys(p, [
      [0, 0],
      [0.26, -1],
      [0.42, 2],
      [0.6, 1],
      [1, 0],
    ]),
    crouch: keys(p, [
      [0, 0],
      [0.3, 1],
      [0.7, 1],
      [1, 0],
    ]),
    trail: p > trail[0] && p < trail[1] ? 1 : 0,
  });
  switch (action.kind) {
    case 'chop':
      return swing(4, 2, -23, -46, 10, -10, 92, [0.3, 0.62]);
    case 'mine':
      return swing(4, 1, -22, -40, 9, -9, 86, [0.3, 0.62]);
    case 'attack':
      return swing(4, 0, -20, -70, 11, -15, 62, [0.34, 0.7]);
    case 'build':
      return swing(4, 3, -20, -34, 8, -11, 78, [0.3, 0.55]);
    case 'feed':
      return {
        handX: keys(p, [
          [0, 4],
          [0.42, 8],
          [0.62, 9],
          [1, 4],
        ]),
        handY: keys(p, [
          [0, -14],
          [0.42, -17],
          [0.62, -13],
          [1, -14],
        ]),
        angle: keys(p, [
          [0, 24],
          [0.42, 14],
          [0.62, 2],
          [1, 24],
        ]),
        lean: keys(p, [
          [0, 0],
          [0.45, 1],
          [1, 0],
        ]),
        bow: 0,
        crouch: 0,
        trail: 0,
      };
    case 'forage':
      return {
        handX: keys(p, [
          [0, 4],
          [0.2, 6],
          [0.4, 5],
          [0.6, 6],
          [0.82, 5],
          [1, 4],
        ]),
        handY: keys(p, [
          [0, -14],
          [0.2, -5],
          [0.4, -3],
          [0.6, -5],
          [0.82, -3],
          [1, -14],
        ]),
        angle: keys(p, [
          [0, 24],
          [0.22, 150],
          [0.6, 168],
          [1, 24],
        ]),
        lean: keys(p, [
          [0, 0],
          [0.22, 1],
          [0.8, 1],
          [1, 0],
        ]),
        bow: keys(p, [
          [0, 0],
          [0.22, 3],
          [0.8, 3],
          [1, 0],
        ]),
        crouch: keys(p, [
          [0, 0],
          [0.2, 3],
          [0.8, 3],
          [1, 0],
        ]),
        trail: 0,
      };
    default:
      // Eating, drinking, bandaging, lighting a torch: the hand lifts to the face.
      return {
        handX: keys(p, [
          [0, 4],
          [0.36, 3],
          [0.54, 3],
          [1, 4],
        ]),
        handY: keys(p, [
          [0, -14],
          [0.36, -22],
          [0.56, -27],
          [1, -14],
        ]),
        angle: keys(p, [
          [0, 24],
          [0.4, 120],
          [0.7, 150],
          [1, 24],
        ]),
        lean: 0,
        bow: keys(p, [
          [0, 0],
          [0.45, -1],
          [1, 0],
        ]),
        crouch: 0,
        trail: 0,
      };
  }
}

function drawHead(ctx: Ctx, cy: number, facing: 'front' | 'side' | 'back', tilt: number, blink: boolean) {
  const y = Math.round(cy + tilt);
  const x = -4;
  const palette: Record<string, string> = {
    H: HAIR,
    h: HAIR_LIGHT,
    S: SKIN,
    s: SKIN_SHADE,
    E: EYE,
    W: WHITE,
  };
  px(ctx, -1, y + 9, 3, 2, OUTLINE);
  px(ctx, -1, y + 9, 2, 1, SKIN_SHADE);
  const rows = facing === 'back' ? HEAD_BACK : facing === 'side' ? HEAD_SIDE : HEAD_FRONT;
  sprite(ctx, rows, x, y, palette);
  if (blink && facing !== 'back') {
    // One-pixel lids replace the open eyes without moving the head.
    if (facing === 'side') px(ctx, 2, y + 5, 2, 1, EYE);
    else {
      px(ctx, -2, y + 5, 2, 1, EYE);
      px(ctx, 1, y + 5, 2, 1, EYE);
    }
  }
  if (facing === 'side') {
    px(ctx, 4, y + 5, 1, 1, SKIN_SHADE);
    px(ctx, 5, y + 6, 1, 1, SKIN_SHADE);
    px(ctx, 2, y + 7, 2, 1, '#8c5233');
    px(ctx, 0, y + 4, 1, 2, SKIN_SHADE);
  } else if (facing === 'front') {
    px(ctx, 0, y + 6, 1, 1, SKIN_SHADE);
    px(ctx, -1, y + 7, 2, 1, '#8c5233');
    px(ctx, -4, y + 8, 9, 1, SKIN_SHADE);
  }
}

function drawBackpack(ctx: Ctx, facing: 'front' | 'side' | 'back', bodyY: number) {
  const y = bodyY;
  if (facing === 'side') {
    px(ctx, -6, -21 + y, 3, 8, OUTLINE);
    px(ctx, -6, -20 + y, 3, 6, PACK_DARK);
    px(ctx, -5, -19 + y, 1, 2, PACK);
    px(ctx, -5, -15 + y, 1, 1, STRAP);
  } else if (facing === 'front') {
    px(ctx, -5, -22 + y, 1, 8, STRAP);
    px(ctx, 4, -22 + y, 1, 8, STRAP);
    px(ctx, -6, -21 + y, 1, 6, PACK_DARK);
    px(ctx, 5, -21 + y, 1, 6, PACK_DARK);
  } else {
    px(ctx, -5, -22 + y, 10, 9, OUTLINE);
    px(ctx, -4, -21 + y, 8, 7, PACK);
    px(ctx, -4, -21 + y, 8, 2, PACK_DARK);
    px(ctx, -1, -17 + y, 2, 1, STRAP);
    px(ctx, -1, -16 + y, 2, 1, BUCKLE);
  }
}

function drawTorso(ctx: Ctx, bodyY: number, lean: number, bow: number, side: boolean) {
  const y = bodyY + bow,
    x = lean;
  if (side) {
    box(ctx, -4 + x, -23 + y, 9, 10, COAT);
    px(ctx, -4 + x, -15 + y, 9, 2, COAT_SHADE);
    px(ctx, 1 + x, -22 + y, 3, 6, COAT_LIGHT);
    px(ctx, 3 + x, -21 + y, 1, 6, COAT_SHADE);
    px(ctx, -4 + x, -14 + y, 9, 2, BELT);
    px(ctx, 2 + x, -14 + y, 1, 1, BUCKLE);
    px(ctx, -2 + x, -23 + y, 4, 1, SCARF);
  } else {
    box(ctx, -4 + x, -23 + y, 9, 10, COAT);
    px(ctx, -3 + x, -22 + y, 2, 7, COAT_LIGHT);
    px(ctx, 2 + x, -22 + y, 2, 8, COAT_SHADE);
    px(ctx, -4 + x, -22 + y, 1, 7, COAT_SHADE);
    px(ctx, -4 + x, -14 + y, 9, 2, BELT);
    px(ctx, -1 + x, -14 + y, 2, 1, BUCKLE);
    px(ctx, -4 + x, -18 + y, 9, 1, COAT_SHADE);
    px(ctx, -3 + x, -23 + y, 6, 1, SCARF);
  }
}

function drawArm(ctx: Ctx, sx: number, sy: number, hx: number, hy: number, far: boolean, outlined = true) {
  const elbowX = (sx + hx) / 2 + (hx > sx ? 1 : -1);
  const elbowY = (sy + hy) / 2;
  limb(ctx, sx, sy, elbowX, elbowY, 2, far ? COAT_SHADE : COAT_LIGHT, outlined);
  px(ctx, Math.round(elbowX) - 1, Math.round(elbowY) - 1, 3, 2, far ? COAT_SHADE : COAT);
  limb(ctx, elbowX, elbowY, hx, hy, 2, far ? SKIN_SHADE : SKIN, outlined);
  px(ctx, Math.round(hx) - 1, Math.round(hy) - 1, 2, 2, far ? SKIN_SHADE : SKIN);
  px(ctx, Math.round(hx) - 1, Math.round(hy) - 2, 2, 1, OUTLINE);
}

const AXE_SPRITE = [
  '..KKK..',
  '.KBBBK.',
  'KBBBBBK',
  'KBBBBBK',
  '.KBBBK.',
  '..HHH..',
  '..HHH..',
  '..HHH..',
  '..HHH..',
  '..HHH..',
  '..HHH..',
  '..HHH..',
  '..HHH..',
];
const PICK_SPRITE = [
  'KKK...KKK',
  'KBBK.KBBK',
  '.KBBKBBK.',
  '..KBHBK..',
  '...HHH...',
  '...HHH...',
  '...HHH...',
  '...HHH...',
  '...HHH...',
  '...HHH...',
  '...HHH...',
  '...HHH...',
];
const TOOL_COLORS: Record<string, string> = {
  K: '#c8d2c4',
  B: '#8d9d92',
  H: '#a4763f',
};

function drawAuthoredTool(ctx: Ctx, item: 'hatchet' | 'pickaxe', dx: number, dy: number) {
  const rows = item === 'hatchet' ? AXE_SPRITE : PICK_SPRITE;
  const width = rows[0].length;
  sprite(ctx, rows, dx - Math.floor(width / 2), dy - rows.length + 2, TOOL_COLORS);
}

function drawTool(ctx: Ctx, hx: number, hy: number, angle: number, item: ItemId, alpha = 1) {
  const previous = ctx.globalAlpha;
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.translate(Math.round(hx), Math.round(hy));
  ctx.rotate(rad(angle));
  if (item === 'hatchet' || item === 'pickaxe') {
    drawAuthoredTool(ctx, item, 0, 1);
  } else {
    const size = ['wood', 'shelter', 'campfire', 'workbench'].includes(item) ? 12 : 10;
    drawItem(ctx, item, -size / 2, -size + 2, size);
  }
  ctx.restore();
  ctx.globalAlpha = previous;
}

function drawTorch(ctx: Ctx, hx: number, hy: number, angle: number, time: number) {
  ctx.save();
  ctx.translate(Math.round(hx), Math.round(hy));
  ctx.rotate(rad(angle));
  px(ctx, -2, -11, 3, 12, OUTLINE);
  px(ctx, -1, -10, 2, 11, '#9c7845');
  px(ctx, -1, -10, 1, 10, '#6d5230');
  const flicker = Math.round(Math.sin(time * 13) + Math.sin(time * 8.1));
  px(ctx, -2, -17 - flicker, 4, 5, '#f2a33c');
  px(ctx, -1, -18 - flicker, 2, 4, '#ffe8a8');
  px(ctx, -1, -14 - flicker, 3, 2, '#d0602c');
  ctx.restore();
}

export function drawActor(ctx: Ctx, input: ActorInput) {
  const side = input.direction === 'left' || input.direction === 'right';
  const facing = side ? 'side' : input.direction === 'up' ? 'back' : 'front';
  const rig = rigFor(input.action);
  const theta = input.moving ? (input.gait / (input.sprinting ? 15 : 21)) * Math.PI * 2 : input.time * 1.7;
  const moving = input.moving;
  const bob = moving ? -Math.round(Math.abs(Math.sin(theta))) : Math.round(Math.sin(input.time * 1.9) * 0.5);
  const bodyY = bob + Math.round(rig.crouch);
  const lean = Math.round(rig.lean);
  const hipY = -12 + bodyY;
  const shoulderY = -22 + bodyY;
  const headY = -32 + bodyY + Math.round(rig.bow * 0.5);
  const blink = !input.reducedMotion && input.time % 4.3 > 4.18;
  const stride = moving ? Math.sin(theta) : 0;
  const crouch = Math.round(rig.crouch);

  const useHand = !!input.action;
  const swing = moving ? stride * 3 : 0;
  const handX = useHand ? rig.handX + lean : side ? 7 + swing : 5;
  const handY = useHand ? rig.handY + bodyY : -13 + bodyY;
  const shoulderX = side ? 4 : 4;

  const figure = () => {
    // ---- Legs -----------------------------------------------------------
    if (side) {
      const feet: [number, number, string][] = [
        [-4 - stride * 4, -1 - Math.max(0, stride), PANTS_SHADE],
        [2 + stride * 4, -1 - Math.max(0, -stride), PANTS],
      ];
      for (const [fx, lift, tint] of feet) {
        const fy = Math.round(lift);
        limb(ctx, -1, hipY, fx * 0.55, hipY + 5 + Math.round(crouch * 0.4), 3, tint);
        limb(ctx, fx * 0.55, hipY + 5 + Math.round(crouch * 0.4), fx, fy - 2, 2, tint);
        px(ctx, fx - 2, fy - 2, 5, 2, BOOT);
      }
    } else {
      const feet: [number, number, string][] = [
        [-4, Math.max(0, Math.sin(theta)), PANTS_SHADE],
        [4, Math.max(0, -Math.sin(theta)), PANTS],
      ];
      for (const [fx, lift, tint] of feet) {
        const fy = -1 - Math.round(lift);
        limb(ctx, fx, hipY, fx, fy - 2, 3, tint);
        px(ctx, fx - 2, fy - 2, 5, 2, BOOT);
      }
      seam(ctx, 0, hipY, 1, -hipY - 2);
    }

    // ---- Back layer -----------------------------------------------------
    drawBackpack(ctx, facing, bodyY);
    const farSwing = moving ? -stride : 0;
    if (side) drawArm(ctx, -2, shoulderY + 1, -2 + farSwing * 3, -15 + bodyY, true);
    else drawArm(ctx, -4, shoulderY + 1, -6 - Math.abs(farSwing) * 1.5, -15 + bodyY, true);

    // ---- Torso and head -------------------------------------------------
    drawTorso(ctx, bodyY, lean, Math.round(rig.bow), side);
    drawHead(ctx, headY, facing, Math.round(-rig.lean), blink);

    // ---- Near arm -------------------------------------------------------
    drawArm(ctx, shoulderX, shoulderY + 1, handX, handY, false);
  };

  ctx.save();
  ctx.translate(Math.round(input.x), Math.round(input.y));
  if (input.direction === 'left') ctx.scale(-1, 1);
  outlinePass = true;
  figure();
  outlinePass = false;
  figure();

  // Held item and swing ghosts are drawn above the finished silhouette.
  // During an action, only the item the action itself holds is drawn; feeding a
  // fire, foraging with bare hands and bandaging show just the hand.
  const held = input.action ? input.action.item : input.equipped;
  if (held === 'torch') {
    drawTorch(ctx, handX + lean, handY, 18, input.time);
  } else if (held) {
    const isTool = held === 'hatchet' || held === 'pickaxe';
    if (rig.trail && isTool) {
      for (let i = 3; i >= 1; i--)
        drawTool(ctx, handX - i * 1.6, handY + i * 1.4, rig.angle - i * 30, held, 0.1 + i * 0.06);
    }
    drawTool(ctx, handX + lean, handY, isTool ? rig.angle : 18, held);
  }
  ctx.restore();
  outlinePass = false;
}

export const ACTOR_PALETTE = { OUTLINE, HAIR, SKIN, COAT, PANTS, BOOT, PACK } as const;
