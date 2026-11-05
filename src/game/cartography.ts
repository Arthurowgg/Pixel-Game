import { artImages, drawItem } from './animation';
import { CAMP, POND, SPRING, WORLD, clamp } from './data';
import { EXPLORE_CELL, EXPLORE_COLUMNS, cellAt, exploredPercent } from './exploration';
import { FOREST_CLEARINGS, FOREST_LANDMARKS, FOREST_TRAILS, groveDensity } from './forest';
import type { GameState, ItemId, Point } from './types';

export interface MapViewport {
  zoom: number;
  center: Point;
}
export function mapViewport(zoom: number, center: Point): MapViewport {
  const z = clamp(zoom, 1, 4),
    halfX = WORLD.width / z / 2,
    halfY = WORLD.height / z / 2;
  return {
    zoom: z,
    center: {
      x: clamp(center.x, halfX, WORLD.width - halfX),
      y: clamp(center.y, halfY, WORLD.height - halfY),
    },
  };
}
export function discoveredLandmarks(state: GameState) {
  const known = new Set(state.explored);
  return [
    ...(known.has(cellAt(SPRING)) ? [{ ...SPRING, name: 'The Spring' }] : []),
    ...(state.forestVersion === 2 ? FOREST_LANDMARKS.filter((point) => known.has(cellAt(point))) : []),
  ];
}
/** Render a real chart, not a screenshot of the world. Opaque uncharted paper
 * is drawn first; every terrain feature and marker is clipped to saved visits. */
export function drawMap(
  canvas: HTMLCanvasElement,
  state: GameState,
  _ground?: HTMLCanvasElement,
  expanded = false,
  requested?: MapViewport,
) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const w = canvas.width,
    h = canvas.height;
  const viewport = mapViewport(
    requested?.zoom ?? (expanded ? 1 : 3.2),
    requested?.center ?? (expanded ? { x: WORLD.width / 2, y: WORLD.height / 2 } : state.player),
  );
  const worldW = WORLD.width / viewport.zoom,
    worldH = WORLD.height / viewport.zoom;
  const left = viewport.center.x - worldW / 2,
    top = viewport.center.y - worldH / 2;
  const sx = w / worldW,
    sy = h / worldH;
  const known = new Set(state.explored);
  const x = (value: number) => Math.round((value - left) * sx);
  const y = (value: number) => Math.round((value - top) * sy);
  const visible = (point: Point) =>
    known.has(cellAt(point)) &&
    point.x >= left - 40 &&
    point.x <= left + worldW + 40 &&
    point.y >= top - 40 &&
    point.y <= top + worldH + 40;
  canvas.dataset.explored = String(exploredPercent(state.explored));
  canvas.dataset.revealedCells = String(known.size);
  canvas.dataset.landmarks = discoveredLandmarks(state)
    .map((point) => point.name)
    .join(', ');
  canvas.dataset.mapStyle = 'field-chart';
  canvas.dataset.mapZoom = viewport.zoom.toFixed(1);
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = '#2c3f35';
  ctx.fillRect(0, 0, w, h);
  const paper = artImages['texture-mapPaper'];
  if (paper?.naturalWidth) {
    ctx.save();
    ctx.globalAlpha = 0.09;
    const pattern = ctx.createPattern(paper, 'repeat');
    if (pattern) {
      ctx.fillStyle = pattern;
      ctx.fillRect(0, 0, w, h);
    }
    ctx.restore();
  }
  ctx.strokeStyle = '#a5b08c12';
  ctx.lineWidth = 1;
  for (let i = 0; i < 14; i++) {
    ctx.beginPath();
    ctx.moveTo((i * w) / 13, 0);
    ctx.lineTo((i * w) / 13, h);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, (i * h) / 13);
    ctx.lineTo(w, (i * h) / 13);
    ctx.stroke();
  }
  ctx.save();
  ctx.beginPath();
  for (const index of known) {
    const px = (index % EXPLORE_COLUMNS) * EXPLORE_CELL,
      py = Math.floor(index / EXPLORE_COLUMNS) * EXPLORE_CELL;
    ctx.rect(x(px), y(py), Math.ceil(EXPLORE_CELL * sx) + 1, Math.ceil(EXPLORE_CELL * sy) + 1);
  }
  ctx.clip();
  ctx.fillStyle = '#a0a17b';
  ctx.fillRect(0, 0, w, h);
  for (let cy = Math.max(0, Math.floor(top / 60) * 60); cy < Math.min(WORLD.height, top + worldH); cy += 60)
    for (
      let cx = Math.max(0, Math.floor(left / 60) * 60);
      cx < Math.min(WORLD.width, left + worldW);
      cx += 60
    ) {
      const density = groveDensity({ x: cx + 30, y: cy + 30 });
      ctx.fillStyle = density > 0.6 ? '#7f9373' : density > 0.3 ? '#939f79' : '#aaa77c';
      ctx.fillRect(x(cx), y(cy), Math.ceil(60 * sx) + 1, Math.ceil(60 * sy) + 1);
    }
  for (const area of FOREST_CLEARINGS) {
    ctx.fillStyle = '#b8ae84';
    ctx.beginPath();
    ctx.ellipse(x(area.x), y(area.y), area.rx * sx, area.ry * sy, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  if (paper?.naturalWidth) {
    ctx.save();
    ctx.globalAlpha = 0.14;
    const pattern = ctx.createPattern(paper, 'repeat');
    if (pattern) {
      ctx.fillStyle = pattern;
      ctx.fillRect(0, 0, w, h);
    }
    ctx.restore();
  }
  const trails =
    state.forestVersion === 2
      ? FOREST_TRAILS
      : [
          {
            width: 32,
            points: Array.from({ length: 91 }, (_, i) => ({
              x: i * 20,
              y: 760 + Math.sin((i * 20) / 175) * 30,
            })),
          },
        ];
  for (const trail of trails) {
    ctx.beginPath();
    trail.points.forEach((point, index) =>
      index ? ctx.lineTo(x(point.x), y(point.y)) : ctx.moveTo(x(point.x), y(point.y)),
    );
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.lineWidth = Math.max(2, trail.width * sx);
    ctx.strokeStyle = '#7c795b';
    ctx.stroke();
    ctx.lineWidth = Math.max(1, trail.width * sx * 0.6);
    ctx.strokeStyle = '#d0be90';
    ctx.stroke();
  }
  for (const [padding, color] of [
    [10, '#7e977e'],
    [3, '#4f7f7d'],
    [-9, '#709c94'],
  ] as const) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(x(POND.x), y(POND.y), (POND.rx + padding) * sx, (POND.ry + padding) * sy, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  const glyphScale = expanded ? clamp(sx * 2.1, 0.45, 1.15) : 0.34;
  const trees = [...state.resources].sort((a, b) => a.y - b.y);
  for (const resource of trees) {
    if (resource.hp <= 0 || !visible(resource)) continue;
    const name = resource.kind === 'tree' ? 'mapPine' : resource.kind === 'stone' ? 'mapBoulder' : null;
    if (name) {
      const image = artImages[`icon-${name}`];
      const gw = Math.round(
        (name === 'mapPine' ? 16 : 18) * glyphScale * (name === 'mapPine' ? resource.scale : 1),
      );
      const gh = Math.round(
        (name === 'mapPine' ? 22 : 14) * glyphScale * (name === 'mapPine' ? resource.scale : 1),
      );
      if (image?.naturalWidth)
        ctx.drawImage(image, x(resource.x) - Math.round(gw / 2), y(resource.y) - gh + 2, gw, gh);
    } else if (expanded && (resource.kind === 'berries' || resource.kind === 'mushroom')) {
      ctx.fillStyle = resource.kind === 'berries' ? '#865d69' : '#a7704f';
      ctx.fillRect(x(resource.x) - 1, y(resource.y) - 1, 2, 2);
    }
  }
  const labels: { point: Point; text: string; offset: number }[] = [];
  const mark = (point: Point, item: ItemId, name: string, above = false) => {
    if (!visible(point)) return;
    const size = expanded ? 15 : 9;
    ctx.fillStyle = '#e5d9ad';
    ctx.fillRect(x(point.x) - size / 2 - 1, y(point.y) - size / 2 - 1, size + 2, size + 2);
    drawItem(ctx, item, x(point.x) - size / 2, y(point.y) - size / 2, size);
    if (expanded) labels.push({ point, text: name, offset: above ? -18 : 19 });
  };
  for (const fire of state.fires)
    mark(fire, 'campfire', Math.hypot(fire.x - CAMP.x, fire.y - CAMP.y) < 8 ? 'HOME CAMP' : 'CAMP');
  for (const shelter of state.shelters) mark(shelter, 'shelter', 'SHELTER');
  for (const bench of state.workbenches) mark(bench, 'workbench', 'WORKBENCH', true);
  mark(SPRING, 'water', 'THE SPRING', true);
  if (state.forestVersion === 2)
    for (const landmark of FOREST_LANDMARKS) {
      if (!visible(landmark)) continue;
      const image = artImages[`object-${landmark.kind}`];
      if (image?.naturalWidth) ctx.drawImage(image, x(landmark.x) - 7, y(landmark.y) - 10, 14, 12);
      if (expanded) labels.push({ point: landmark, text: landmark.name.toUpperCase(), offset: 18 });
    }
  const placed: { x: number; y: number; w: number }[] = [];
  for (const label of labels) {
    ctx.font = '11px "Pixelify Sans", monospace';
    ctx.textAlign = 'center';
    const width = ctx.measureText(label.text).width + 10;
    const lx = clamp(x(label.point.x), width / 2 + 2, w - width / 2 - 2),
      ly = y(label.point.y) + label.offset;
    if (placed.some((box) => Math.abs(box.x - lx) < (width + box.w) / 2 + 3 && Math.abs(box.y - ly) < 15))
      continue;
    ctx.fillStyle = '#273c32e8';
    ctx.fillRect(lx - width / 2, ly - 10, width, 14);
    ctx.fillStyle = '#ebe0b8';
    ctx.fillText(label.text, lx, ly);
    placed.push({ x: lx, y: ly, w: width });
  }
  ctx.restore();
  // A soft drop shadow around the charted island reads as raised paper.
  // The player is the only always-known mark. No unrevealed spring, camp, tree,
  // placed station or landmark can leak through the opaque fog.
  const px = x(state.player.x),
    py = y(state.player.y),
    size = expanded ? 4 : 3;
  if (px >= 0 && py >= 0 && px <= w && py <= h) {
    ctx.fillStyle = '#263a30';
    ctx.fillRect(px - size - 1, py - size - 1, size * 2 + 2, size * 2 + 2);
    ctx.fillStyle = '#fff0bf';
    ctx.fillRect(px - size, py - size, size * 2, size * 2);
    ctx.strokeStyle = '#f4dfaa';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(px, py, size + 4, 0, Math.PI * 2);
    ctx.stroke();
  }
  if (expanded && known.size < 160) {
    ctx.font = '12px "Pixelify Sans", monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#adb59c';
    ctx.fillText('UNCHARTED WOODLAND', w / 2, 40);
  }
}
