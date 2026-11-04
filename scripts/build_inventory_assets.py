"""Prepare the ten approved standalone AI assets in the forager batch.

Only chroma-key removal, cropping, nearest-neighbor sizing, palette reduction,
and static inventory-atlas packing are performed. No animation frames are
created or changed. Normalized inputs are shipped so raw generations are optional.
"""
from pathlib import Path
from PIL import Image
import argparse
import json
import math

ROOT = Path(__file__).resolve().parents[1]
ART = ROOT / 'public/art'
RAW = ROOT / '.art-originals/asset-batch2'
NORMALIZED = ART / 'generated/forager-batch'
NEAREST = Image.Resampling.NEAREST
ITEMS = ['hatchet', 'pickaxe', 'wood', 'stone', 'fiber', 'berries', 'water',
         'mushroom', 'bandage', 'torch', 'meal', 'campfire', 'shelter', 'nuts', 'tea']
NEW_ITEMS = ['wood', 'stone', 'fiber', 'berries', 'mushroom', 'water', 'nuts', 'tea']
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--normalized-only', action='store_true')
args = parser.parse_args()
NORMALIZED.mkdir(parents=True, exist_ok=True)


def pixels(image):
    return image.get_flattened_data() if hasattr(image, 'get_flattened_data') else image.getdata()


def prepare_icon(name, size):
    image = Image.open(RAW / f'{name}.png').convert('RGBA')
    # Preserve dark plum berries/tea. Only the vivid magenta backdrop is keyed.
    image.putdata([(0, 0, 0, 0) if r > g + 35 and b > g + 35 and min(r, b) > max(70, g * 2.5)
                   else (r, g, b, a) for r, g, b, a in pixels(image)])
    box = image.getbbox()
    if not box:
        raise ValueError(f'No foreground in {name}')
    image = image.crop(box)
    scale = (size - 2) / max(image.size)
    image = image.resize((max(1, round(image.width * scale)), max(1, round(image.height * scale))), NEAREST)
    image = image.quantize(colors=12, method=Image.Quantize.FASTOCTREE,
                           dither=Image.Dither.NONE).convert('RGBA')
    canvas = Image.new('RGBA', (size, size))
    canvas.alpha_composite(image, ((size - image.width) // 2, (size - image.height) // 2))
    return canvas


for name in NEW_ITEMS + ['backpack', 'forest-floor']:
    output = NORMALIZED / f'{name}.png'
    if not args.normalized_only and (RAW / f'{name}.png').exists():
        if name == 'forest-floor':
            image = Image.open(RAW / f'{name}.png').convert('RGB').resize((64, 64), NEAREST)
            image = image.quantize(colors=8, dither=Image.Dither.NONE).convert('RGB')
        else:
            image = prepare_icon(name, 24 if name == 'backpack' else 16)
        image.save(output, optimize=True)
    if not output.exists():
        raise FileNotFoundError(f'Missing normalized AI asset: {output}')

for name in NEW_ITEMS:
    Image.open(NORMALIZED / f'{name}.png').save(ART / f'item-{name}.png', optimize=True)

# Static packing is not animation rigging: each cell is one unchanged icon.
columns, size = 8, 16
atlas = Image.new('RGBA', (columns * size, math.ceil(len(ITEMS) / columns) * size))
metadata = {'sheet': 'art/item-sprites.png', 'width': atlas.width, 'height': atlas.height, 'items': {}}
for i, name in enumerate(ITEMS):
    image = Image.open(ART / f'item-{name}.png').convert('RGBA')
    if image.size != (size, size):
        raise ValueError(f'{name} must be a {size}-pixel icon')
    x, y = i % columns * size, i // columns * size
    atlas.alpha_composite(image, (x, y))
    generated = name in NEW_ITEMS or name in ('hatchet', 'pickaxe')
    entry = {'x': x, 'y': y, 'w': size, 'h': size,
             'source': 'generated' if generated else 'original-pixel-art'}
    if name in NEW_ITEMS:
        entry['sourceAsset'] = f'art/generated/forager-batch/{name}.png'
    metadata['items'][name] = entry
atlas.save(ART / 'item-sprites.png', optimize=True)
for path in (ART / 'item-sprites.json', ROOT / 'src/game/item-atlas.json'):
    path.write_text(json.dumps(metadata, indent=2) + '\n')

(ART / 'ui').mkdir(exist_ok=True)
(ART / 'textures').mkdir(exist_ok=True)
Image.open(NORMALIZED / 'backpack.png').save(ART / 'ui/backpack.png', optimize=True)
Image.open(NORMALIZED / 'forest-floor.png').save(ART / 'textures/forest-floor.png', optimize=True)
generated_assets = {
    'icons': {'pack': {'file': 'art/ui/backpack.png', 'width': 24, 'height': 24, 'source': 'generated'}},
    'textures': {'forestFloor': {'file': 'art/textures/forest-floor.png', 'width': 64, 'height': 64,
                               'source': 'generated'}},
}
for path in (ART / 'generated-assets.json', ROOT / 'src/game/generated-assets.json'):
    path.write_text(json.dumps(generated_assets, indent=2) + '\n')

print('Prepared 10 AI-generated assets: 8 item icons, 1 UI icon, 1 terrain texture.')
print('Inventory: 15 items, 10 generated icons / 5 original icons. Animation sheets unchanged.')
