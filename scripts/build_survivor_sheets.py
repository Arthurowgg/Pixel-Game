"""Slice the generated survivor frames into game-ready animation sheets.

Sources live in .art-originals/survivor-pass/ (ignored by git). Six generations:
a locomotion grid (two rows) per facing and a five-frame overhead swing per
facing. The builder keys the flat magenta background, finds the cells by their
transparent gutters, normalises every cell to one character height, stands it on
the shared 48x48 foot anchor, and writes the grip arc the held tool follows.

Output: public/art/animations/survivor2-{down,side,up}.png plus the clip table,
which is merged into both animation manifests.
"""
from pathlib import Path
from PIL import Image
import json

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / '.art-originals/survivor-pass'
ART = ROOT / 'public/art/animations'
CELL = 48
ANCHOR = (24, 42)
HEIGHT = 34


def key_magenta(image: Image.Image) -> Image.Image:
    image = image.convert('RGBA')
    image.putdata([
        (0, 0, 0, 0) if r > g + 40 and b > g + 30 and min(r, b) > 110 and g < 150
        else (r, g, b, a)
        for r, g, b, a in image.getdata()
    ])
    return image


def split_cells(image: Image.Image):
    """Cut the grid apart on fully transparent rows and columns."""
    alpha = image.getchannel('A').load()
    width, height = image.size

    def runs(flags):
        out, start = [], None
        for index, value in enumerate(flags):
            if value and start is None:
                start = index
            elif not value and start is not None:
                out.append((start, index))
                start = None
        if start is not None:
            out.append((start, len(flags)))
        return [run for run in out if run[1] - run[0] > 8]

    columns = runs([any(alpha[x, y] for y in range(height)) for x in range(width)])
    rows = runs([any(alpha[x, y] for x in range(width)) for y in range(height)])
    return [
        image.crop((x0, y0, x1, y1))
        for y0, y1 in rows
        for x0, x1 in columns
    ], len(columns), len(rows)


def normalise(cell: Image.Image) -> Image.Image:
    """One character height, feet on the shared anchor, centred on x."""
    bounds = cell.getbbox()
    if not bounds:
        raise ValueError('Empty cell')
    cell = cell.crop(bounds)
    scale = HEIGHT / cell.height
    cell = cell.resize(
        (max(1, round(cell.width * scale)), HEIGHT), Image.Resampling.BOX
    )
    cell = cell.quantize(colors=24, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.NONE)
    cell = cell.convert('RGBA')
    cell.putdata([(0, 0, 0, 0) if a < 110 else (r, g, b, 255) for r, g, b, a in cell.getdata()])
    # Centre on the head and shoulders, not the bounding box: swinging legs and an
    # outstretched arm would otherwise slide the whole body sideways between frames.
    upper = cell.crop((0, 0, cell.width, max(1, round(cell.height * 0.42))))
    upper_bounds = upper.getbbox() or (0, 0, cell.width, 0)
    centre = (upper_bounds[0] + upper_bounds[2]) / 2
    canvas = Image.new('RGBA', (CELL, CELL), (0, 0, 0, 0))
    canvas.alpha_composite(cell, (round(ANCHOR[0] - centre), ANCHOR[1] - cell.height))
    return canvas


# Game facing -> (sheet key, raw stem, walk frames, idle frames). The side art is
# drawn facing right and mirrored at runtime for 'left', exactly like the clips.
FACINGS = {
    'down': ('down', 'walk-down', [6, 7, 8, 9, 10, 11], [0, 1]),
    'right': ('right', 'walk-side', [0, 1, 2, 3, 4, 5], [6, 7]),
    'up': ('up', 'walk-up', [0, 1, 2, 3, 4, 5], [6, 11]),
}
ACTION = {'down': 'action-down', 'right': 'action-side', 'up': 'action-up'}
# Grip position (cell x, cell y, degrees) for the five generated swing frames.
GRIP = {
    'down': [[24, 9, -15], [25, 8, -30], [27, 15, 25], [27, 24, 100], [25, 17, 50]],
    'right': [[28, 9, -10], [29, 8, -25], [30, 16, 30], [30, 25, 105], [28, 17, 55]],
    'up': [[24, 9, -15], [25, 8, -30], [23, 15, 25], [23, 24, 100], [24, 17, 50]],
}


def build():
    clips = {}
    for facing, (sheet_dir, stem, walk_frames, idle_frames) in FACINGS.items():
        cells, _, _ = split_cells(key_magenta(Image.open(RAW / f'{stem}-raw.png')))
        action_cells, _, _ = split_cells(key_magenta(Image.open(RAW / f'{ACTION[facing]}-raw.png')))
        walk = [normalise(cells[index]) for index in walk_frames]
        idle = [normalise(cells[index]) for index in idle_frames]
        action = [normalise(cell) for cell in action_cells[:5]]
        sheet = Image.new('RGBA', (CELL * 6, CELL * 3), (0, 0, 0, 0))
        for index, cell in enumerate(idle):
            sheet.alpha_composite(cell, (index * CELL, 0))
        for index, cell in enumerate(walk):
            sheet.alpha_composite(cell, (index * CELL, CELL))
        for index, cell in enumerate(action):
            sheet.alpha_composite(cell, (index * CELL, CELL * 2))
        name = f'survivor2-{sheet_dir}'
        sheet.save(ART / f'{name}.png', optimize=True)
        # The generated swing raises the arms overhead on frames 0-1 and drives them
        # down through the crouch, so the grip follows that arc instead of a guess.
        hands = [list(hand) for hand in GRIP[facing]]
        base = {'sheet': name, 'x': 0, 'w': CELL, 'h': CELL, 'anchor': list(ANCHOR)}
        clips[f'idle-{facing}'] = {**base, 'y': 0, 'frames': 2, 'fps': 2, 'loop': True, 'hands': [[ANCHOR[0] + 5, ANCHOR[1] - 13, 12]] * 2}
        clips[f'walk-{facing}'] = {**base, 'y': CELL, 'frames': 6, 'fps': 10, 'loop': True, 'hands': [[ANCHOR[0] + 5, ANCHOR[1] - 13, 12]] * 6}
        clips[f'run-{facing}'] = {**base, 'y': CELL, 'frames': 6, 'fps': 15, 'loop': True, 'hands': [[ANCHOR[0] + 5, ANCHOR[1] - 13, 12]] * 6}
        # Five generated frames put contact on frame 2, at the same one-third mark
        # the simulation has always used, so the impact still lands where it did.
        for mode in ('axe', 'mine', 'attack', 'forage', 'build', 'use'):
            clips[f'{mode}-{facing}'] = {
                **base,
                'y': CELL * 2,
                'frames': len(action),
                'impactFrame': 2,
                'fps': 6,
                'loop': False,
                'hands': hands,
            }
    return clips


if __name__ == '__main__':
    table = build()
    for target in (ROOT / 'src/game/animation-manifest.json', ROOT / 'public/art/animations/manifest.json'):
        manifest = json.loads(target.read_text())
        for sheet_dir in ('down', 'right', 'up'):
            manifest['sheets'][f'survivor2-{sheet_dir}'] = {'width': CELL * 6, 'height': CELL * 3}
        # The character's clips now point at the generated survivor2 sheets. The
        # legacy survivor clips retire with them; their PNGs stay on disk, but the
        # manifest only preloads sheets a live clip still uses.
        for clip in [
            name
            for name in manifest['clips']
            if name.startswith('survivor-') or name.endswith('-side')
        ]:
            del manifest['clips'][clip]
        manifest['clips'].update(table)
        used = {clip['sheet'] for clip in manifest['clips'].values()}
        manifest['sheets'] = {name: size for name, size in manifest['sheets'].items() if name in used}
        target.write_text(json.dumps(manifest, indent=2) + '\n')
    print(f'Wrote {len(table)} survivor clips across three generated sheets.')
