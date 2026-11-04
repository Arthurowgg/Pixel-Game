"""Prepare ten standalone AI images for the camp-interface batch.

Completes the inventory art and adds three UI glyphs, one nine-slice HUD frame,
and one impact sprite. Only keying, cropping, nearest-neighbor sizing and palette
reduction are used. No actor or wolf animation frames are constructed or altered.
Run this AFTER older art pipelines when intentionally rebuilding everything.
"""
from pathlib import Path
from PIL import Image
import argparse
import json

ROOT = Path(__file__).resolve().parents[1]
ART = ROOT / 'public/art'
RAW = ROOT / '.art-originals/camp-ui'
NORMALIZED = ART / 'generated/camp-ui'
NEAREST = Image.Resampling.NEAREST
NEW_ITEMS = ['bandage', 'torch', 'meal', 'campfire', 'shelter']
UI_ICONS = ['map', 'journal', 'hammer']
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--normalized-only', action='store_true')
args = parser.parse_args()
NORMALIZED.mkdir(parents=True, exist_ok=True)


def pixels(image):
    return image.get_flattened_data() if hasattr(image, 'get_flattened_data') else image.getdata()


def prepare(name):
    image = Image.open(RAW / f'{name}.png').convert('RGBA')
    image.putdata([(0, 0, 0, 0) if r > g + 35 and b > g + 35 and min(r, b) > max(70, g * 2.5)
                   else (r, g, b, a) for r, g, b, a in pixels(image)])
    box = image.getbbox()
    if box is None:
        raise ValueError(f'No foreground in {name}')
    image = image.crop(box)
    if name == 'panel':
        return image.resize((128, 80), NEAREST).quantize(
            colors=16, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.NONE).convert('RGBA')
    size = 24 if name in UI_ICONS else 16
    scale = (size - 2) / max(image.size)
    image = image.resize((max(1, round(image.width * scale)), max(1, round(image.height * scale))), NEAREST)
    image = image.quantize(colors=12, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.NONE).convert('RGBA')
    canvas = Image.new('RGBA', (size, size))
    canvas.alpha_composite(image, ((size - image.width) // 2, (size - image.height) // 2))
    return canvas


for name in NEW_ITEMS + UI_ICONS + ['panel', 'impact-star']:
    output = NORMALIZED / f'{name}.png'
    if not args.normalized_only and (RAW / f'{name}.png').exists():
        prepare(name).save(output, optimize=True)
    if not output.exists():
        raise FileNotFoundError(f'Missing normalized AI asset: {output}')

for name in NEW_ITEMS:
    Image.open(NORMALIZED / f'{name}.png').save(ART / f'item-{name}.png', optimize=True)
metadata = json.loads((ART / 'item-sprites.json').read_text())
atlas = Image.new('RGBA', (metadata['width'], metadata['height']))
for name, cell in metadata['items'].items():
    image = Image.open(ART / f'item-{name}.png').convert('RGBA')
    if image.size != (cell['w'], cell['h']):
        raise ValueError(f'Wrong cell size for {name}')
    atlas.alpha_composite(image, (cell['x'], cell['y']))
    if name in NEW_ITEMS:
        cell['source'] = 'generated'
        cell['sourceAsset'] = f'art/generated/camp-ui/{name}.png'
atlas.save(ART / 'item-sprites.png', optimize=True)
for path in (ART / 'item-sprites.json', ROOT / 'src/game/item-atlas.json'):
    path.write_text(json.dumps(metadata, indent=2) + '\n')

registry = json.loads((ART / 'generated-assets.json').read_text())
(ART / 'ui').mkdir(exist_ok=True)
(ART / 'effects').mkdir(exist_ok=True)
for name in UI_ICONS:
    Image.open(NORMALIZED / f'{name}.png').save(ART / f'ui/{name}.png', optimize=True)
    registry['icons'][name] = {'file': f'art/ui/{name}.png', 'width': 24, 'height': 24, 'source': 'generated'}
Image.open(NORMALIZED / 'panel.png').save(ART / 'ui/panel.png', optimize=True)
Image.open(NORMALIZED / 'impact-star.png').save(ART / 'effects/impact-star.png', optimize=True)
registry['frames'] = {'hud': {'file': 'art/ui/panel.png', 'width': 128, 'height': 80,
                             'slice': 18, 'source': 'generated'}}
registry['effects'] = {'impactStar': {'file': 'art/effects/impact-star.png', 'width': 16,
                                    'height': 16, 'source': 'generated'}}
for path in (ART / 'generated-assets.json', ROOT / 'src/game/generated-assets.json'):
    path.write_text(json.dumps(registry, indent=2) + '\n')
print('Prepared 10 AI assets. All 15 inventory icons now use generated art.')
print('Added map/journal/crafting glyphs, one nine-slice frame, and one impact sprite. Animation PNGs untouched.')
