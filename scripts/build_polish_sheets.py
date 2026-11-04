"""Pack generated key poses into real, row-major animation sheets.

Batch one: four survivor keys, four wolf keys, and two tool illustrations.
The raw generations are optional after the normalized keys are checked in.
Each new action has its own 4-column PNG, with eight frames and pivot metadata.
"""
from pathlib import Path
from PIL import Image, ImageDraw
import argparse
import json
import math
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
ART = ROOT / 'public/art'
RAW = ROOT / '.art-originals/polish'
KEYS = ART / 'keyframes/polish'
OUT = ART / 'animations'
NEAREST = Image.Resampling.NEAREST
CLEAR = (0, 0, 0, 0)
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--normalized-only', action='store_true')
args = parser.parse_args()
KEYS.mkdir(parents=True, exist_ok=True)


def pixels(image):
    return image.get_flattened_data() if hasattr(image, 'get_flattened_data') else image.getdata()


def colors_from(path):
    return sorted({p[:3] for p in pixels(Image.open(path).convert('RGBA')) if p[3]})


def recolor(image, palette):
    lookup = {}
    for pixel in set(pixels(image)):
        lookup[pixel] = CLEAR if not pixel[3] else (*min(
            palette, key=lambda color: sum((color[i] - pixel[i]) ** 2 for i in range(3))
        ), 255)
    result = image.copy()
    result.putdata([lookup[p] for p in pixels(image)])
    return result


def keyed(path):
    image = Image.open(path).convert('RGBA')
    data = []
    for r, g, b, a in pixels(image):
        data.append(CLEAR if r > g + 12 and b > g + 12 and min(r, b) > g * 1.3 else (r, g, b, a))
    image.putdata(data)
    box = image.getbbox()
    if box is None:
        raise ValueError(f'No isolated subject found in {path}')
    return image.crop(box)


def components(image, predicate):
    remaining = {(x, y) for y in range(image.height) for x in range(image.width)
                 if predicate(image.getpixel((x, y)))}
    groups = []
    while remaining:
        point = min(remaining)
        remaining.remove(point)
        group, pending = [point], [point]
        while pending:
            x, y = pending.pop()
            for p in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
                if p in remaining:
                    remaining.remove(p)
                    group.append(p)
                    pending.append(p)
        if len(group) > 1:
            groups.append(group)
    return sorted(groups, key=len, reverse=True)


def center(group):
    return [round(sum(p[0] for p in group) / len(group)), round(sum(p[1] for p in group) / len(group))]


actor_palette = colors_from(ART / 'keyframes/survivor-front.png')
wolf_palette = colors_from(ART / 'wolf.png')
tool_palette = [(32, 49, 39), (58, 73, 55), (105, 124, 111), (143, 164, 149),
                (192, 203, 179), (78, 58, 36), (137, 99, 57), (181, 145, 89), (220, 187, 121)]
heights = {'player-ready': 34, 'player-windup': 35, 'player-impact': 33,
           'player-followthrough': 32, 'wolf-contact': 25, 'wolf-compress': 24,
           'wolf-gather': 23, 'wolf-extend': 25, 'hatchet': 15, 'pickaxe': 15}
anchor_file = KEYS / 'anchors.json'
anchors = json.loads(anchor_file.read_text()) if anchor_file.exists() else {}
for name, height in heights.items():
    if args.normalized_only or not (RAW / f'{name}.png').exists():
        continue
    image = keyed(RAW / f'{name}.png')
    width = max(1, round(image.width / image.height * height))
    image = image.resize((width, height), NEAREST)
    palette = actor_palette if name.startswith('player') else wolf_palette if name.startswith('wolf') else tool_palette
    image = recolor(image, palette)
    if name in ('hatchet', 'pickaxe'):
        if image.width > 15:
            image = image.resize((15, image.height), NEAREST)
        shaft = [x for y in range(image.height - 4, image.height) for x in range(image.width)
                 if image.getpixel((x, y))[3]]
        shaft_x = round(sum(shaft) / len(shaft))
        icon = Image.new('RGBA', (16, 16))
        icon.alpha_composite(image, (8 - shaft_x, 0))
        image = icon
        anchors[name] = {'grip': [8, 13]}
    elif name.startswith('player'):
        feet = [x for y in range(image.height - 3, image.height) for x in range(image.width)
                if image.getpixel((x, y))[3]]
        foot_x = round((min(feet) + max(feet)) / 2)
        skin = components(image, lambda p: p[3] and p[0] > 170 and p[1] > 130 and p[2] > 80 and p[0] > p[1] > p[2])
        hands = skin[1:]
        if not hands:
            raise ValueError(f'Cannot isolate the hands in {name}; inspect the normalized key.')
        if name == 'player-windup':
            hand = min(hands, key=lambda group: center(group)[1])
        else:
            hand = max(hands, key=lambda group: center(group)[0])
        anchors[name] = {'foot': [foot_x, image.height], 'grip': center(hand)}
    image.save(KEYS / f'{name}.png', optimize=True)
anchor_file.write_text(json.dumps(anchors, indent=2) + '\n')
for name in heights:
    if not (KEYS / f'{name}.png').exists():
        raise FileNotFoundError(f'Normalized key missing: {name}. Supply it or its raw generation first.')

# Always rebuild the original manifest first: re-running this pipeline is idempotent.
subprocess.run([sys.executable, str(ROOT / 'scripts/build_animation_sheets.py'), '--normalized-only'], check=True)
manifest = json.loads((OUT / 'manifest.json').read_text())
clips, sheets = manifest['clips'], manifest['sheets']
keys = {name: Image.open(KEYS / f'{name}.png').convert('RGBA') for name in heights}
for item in ('hatchet', 'pickaxe'):
    keys[item].save(ART / f'item-{item}.png', optimize=True)


def pack(name, frames, fps, anchor, loop=True, hands=None, impact_frame=None):
    cell = frames[0].size
    columns = 4
    rows = math.ceil(len(frames) / columns)
    image = Image.new('RGBA', (cell[0] * columns, cell[1] * rows))
    for i, frame in enumerate(frames):
        assert frame.size == cell
        image.alpha_composite(frame, ((i % columns) * cell[0], (i // columns) * cell[1]))
    image.save(OUT / f'{name}.png', optimize=True)
    sheets[name] = {'width': image.width, 'height': image.height}
    clip = {'sheet': name, 'x': 0, 'y': 0, 'w': cell[0], 'h': cell[1],
            'frames': len(frames), 'columns': columns, 'fps': fps, 'loop': loop, 'anchor': anchor}
    if hands is not None:
        clip['hands'] = hands
    if impact_frame is not None:
        clip['impactFrame'] = impact_frame
    clips[name] = clip
    return image, clip


def add_tool(frame, item, hand):
    x, y, degrees = hand
    layer = Image.new('RGBA', (48, 48))
    layer.alpha_composite(keys[item], (16, 11))
    layer = layer.rotate(-degrees, resample=NEAREST, center=(24, 24))
    frame.alpha_composite(layer, (x - 24, y - 24))
    draw = ImageDraw.Draw(frame)
    draw.rectangle((x - 1, y - 1, x + 1, y), fill='#ead4aa')


# Per-animation PNGs: four columns by two rows, stable feet and full tool silhouettes.
# Impact remains frame four, so the existing simulation's one-third-second contact is unchanged.
actor_sheet = Image.open(OUT / 'survivor.png').convert('RGBA')
poses = ['player-ready', 'player-ready', 'player-windup', 'player-windup',
         'player-impact', 'player-followthrough', 'player-ready', None]
preview = []
for direction in ('right', 'down', 'up'):
    for mode, item in (('axe', 'hatchet'), ('mine', 'pickaxe')):
        base = clips[f'{mode}-{direction}']
        frames, grips = [], []
        for i in range(8):
            frame = Image.new('RGBA', (64, 80))
            if direction == 'right' and poses[i] is not None:
                name = poses[i]
                key = keys[name]
                foot, grip = anchors[name]['foot'], anchors[name]['grip']
                lift = -1 if i in (1, 3) else 0
                left, top = 32 - foot[0], 58 - foot[1] + lift
                frame.alpha_composite(key, (left, top))
                angles = [35, 18, -35, -55, 112, 145, 45, 32] if mode == 'axe' else [28, 10, -20, -40, 105, 137, 38, 25]
                hand = [left + grip[0], top + grip[1], angles[i]]
            else:
                body = actor_sheet.crop((i * base['w'], base['y'], (i + 1) * base['w'], base['y'] + base['h']))
                frame.alpha_composite(body, (8, 16))
                old = base['hands'][i]
                hand = [old[0] + 8, old[1] + 16, (32 if mode == 'axe' else 25) if direction == 'right' and i == 7 else old[2]]
            grips.append(hand)
            if i == 4 and direction == 'right':
                draw = ImageDraw.Draw(frame)
                draw.line([(42, 22), (48, 27), (53, 35), (54, 42)], fill='#c9bd875b', width=1)
            if direction == 'up':
                body = frame.copy()
                frame = Image.new('RGBA', frame.size)
                add_tool(frame, item, hand)
                frame.alpha_composite(body)
            else:
                add_tool(frame, item, hand)
            frames.append(frame)
        name = f'survivor-{mode}-{direction}'
        pack(name, frames, 12, [32, 58], loop=False, hands=grips, impact_frame=4)
        if direction == 'right' and mode == 'axe':
            preview = frames

# Four generated canine gait keys make a complete contact / recoil / suspension cycle.
frames = []
phases = [('wolf-contact', 0), ('wolf-contact', 1), ('wolf-compress', 1), ('wolf-compress', 0),
          ('wolf-gather', -1), ('wolf-gather', -3), ('wolf-extend', -3), ('wolf-extend', -1)]
for name, lift in phases:
    frame = Image.new('RGBA', (64, 48))
    image = keys[name]
    frame.alpha_composite(image, (32 - image.width // 2, 38 - image.height + lift))
    frames.append(frame)
_, clip = pack('wolf-run', frames, 11, [32, 38])
clips['wolf-run'] = clip
frames = []
base = keys['wolf-compress']
for i in range(8):
    frame = Image.new('RGBA', (64, 48))
    image = base.copy()
    tail_x = round(image.width * .79)
    tail = image.crop((tail_x, 0, image.width, image.height))
    image.paste(CLEAR, (tail_x, 0, image.width, image.height))
    image.alpha_composite(tail, (tail_x, [0, 0, -1, -1, 0, 1, 1, 0][i]))
    frame.alpha_composite(image, (32 - image.width // 2, 38 - image.height))
    frames.append(frame)
_, clip = pack('wolf-idle', frames, 4, [32, 38])
clips['wolf-alert'] = dict(clip)

# Small atmospheric effects are also discrete pixel frames, not smoothed particles.
frames = []
for i in range(8):
    image = Image.new('RGBA', (24, 24))
    draw = ImageDraw.Draw(image)
    tilt = [0, 1, 2, 1, 0, -1, -2, -1][i]
    draw.polygon([(9, 10), (12 + tilt, 8), (15, 10), (12 - tilt, 13), (10, 13)], fill='#a79b65')
    draw.line([(10, 12), (14, 9)], fill='#5a7344')
    frames.append(image)
pack('leaf-drift', frames, 5, [12, 12])
frames = []
for i in range(8):
    image = Image.new('RGBA', (32, 24))
    draw = ImageDraw.Draw(image)
    radius = 2 + i
    alpha = max(0, 155 - i * 20)
    color = (165, 190, 162, alpha)
    draw.line([(16 - radius, 12), (16 - radius + 2, 10), (16 + radius - 2, 10), (16 + radius, 12)], fill=color)
    draw.line([(16 - radius + 1, 14), (16 + radius - 1, 14)], fill=color)
    frames.append(image)
pack('pond-ring', frames, 7, [16, 12])

# One inventory atlas is consumed directly by the HUD and the held-item renderer.
items = ['hatchet', 'pickaxe', 'wood', 'stone', 'fiber', 'berries', 'water', 'mushroom',
         'bandage', 'torch', 'meal', 'campfire', 'shelter']
atlas = Image.new('RGBA', (128, 32))
item_metadata = {'sheet': 'art/item-sprites.png', 'width': 128, 'height': 32, 'items': {}}
for i, item in enumerate(items):
    x, y = (i % 8) * 16, (i // 8) * 16
    atlas.alpha_composite(Image.open(ART / f'item-{item}.png').convert('RGBA'), (x, y))
    item_metadata['items'][item] = {'x': x, 'y': y, 'w': 16, 'h': 16,
                                  'source': 'generated' if item in ('hatchet', 'pickaxe') else 'original-pixel-art'}
atlas.save(ART / 'item-sprites.png', optimize=True)
(ART / 'item-sprites.json').write_text(json.dumps(item_metadata, indent=2) + '\n')
(ROOT / 'src/game/item-atlas.json').write_text(json.dumps(item_metadata, indent=2) + '\n')
# Only load sheets still referenced by a clip; the original wildlife atlas is superseded.
used_sheets = {clip['sheet'] for clip in clips.values()}
for name in list(sheets):
    if name not in used_sheets:
        del sheets[name]
(OUT / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
(ROOT / 'src/game/animation-manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')

cache = ROOT / '.cache'
cache.mkdir(exist_ok=True)
preview_rgb = []
for frame in preview:
    bg = Image.new('RGBA', frame.size, '#263b2b')
    bg.alpha_composite(frame)
    preview_rgb.append(bg.resize((256, 320), NEAREST).convert('RGB'))
preview_rgb[0].save(cache / 'polished-axe.gif', save_all=True, append_images=preview_rgb[1:], duration=83, loop=0)
print(f'Polish packed: {len(sheets)} sheets, {len(clips)} clips. Ten generated sources; remaining item/UI art stays explicitly marked as original.')
