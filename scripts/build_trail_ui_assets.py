"""Normalize the ten standalone trail-interface images. No animation construction.

Run after older art builders. --normalized-only needs only the checked-in PNGs.
Operations: chroma key, crop, nearest resize, palette reduction, file copies.
"""
from pathlib import Path
from PIL import Image
import argparse
import json

ROOT = Path(__file__).resolve().parents[1]
ART = ROOT / 'public/art'
RAW = ROOT / '.art-originals/trail-ui'
NORMAL = ART / 'generated/trail-ui'
FRAMES = {'status': ('status-frame', 160, 80, 14),
          'dialog': ('dialog-frame', 160, 120, 20),
          'slot': ('slot-frame', 40, 40, 8)}
ICONS = {'heart': 16, 'food': 16, 'water': 16, 'thermometer': 16,
         'stamina': 16, 'settings': 24, 'compass': 24}
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--normalized-only', action='store_true')
args = parser.parse_args()
NORMAL.mkdir(parents=True, exist_ok=True)


def prepare(name, width, height, frame=False):
    image = Image.open(RAW / f'{name}.png').convert('RGBA')
    pixels = image.get_flattened_data() if hasattr(image, 'get_flattened_data') else image.getdata()
    image.putdata([(0, 0, 0, 0) if r > g + 35 and b > g + 35 and min(r, b) > max(70, g * 2.5)
                   else (r, g, b, a) for r, g, b, a in pixels])
    box = image.getbbox()
    if not box:
        raise ValueError(f'Empty generated foreground: {name}')
    image = image.crop(box)
    if frame:
        image = image.resize((width, height), Image.Resampling.NEAREST)
    else:
        scale = (width - 2) / max(image.size)
        image = image.resize((max(1, round(image.width * scale)), max(1, round(image.height * scale))),
                             Image.Resampling.NEAREST)
    image = image.quantize(colors=16 if frame else 8, method=Image.Quantize.FASTOCTREE,
                           dither=Image.Dither.NONE).convert('RGBA')
    result = Image.new('RGBA', (width, height))
    result.alpha_composite(image, ((width - image.width) // 2, (height - image.height) // 2))
    return result


def output(name, width, height, frame=False):
    path = NORMAL / f'{name}.png'
    if not args.normalized_only and (RAW / f'{name}.png').exists():
        prepare(name, width, height, frame).save(path, optimize=True)
    if not path.exists():
        raise FileNotFoundError(f'Missing normalized source: {path}')
    with Image.open(path) as image:
        if image.size != (width, height):
            raise ValueError(f'Incorrect source dimensions: {path}')
    target = ART / 'ui' / f'{name}.png'
    target.write_bytes(path.read_bytes())
    return {'file': f'art/ui/{name}.png', 'width': width, 'height': height,
            'source': 'generated', 'sourceAsset': f'art/generated/trail-ui/{name}.png'}


registry = json.loads((ART / 'generated-assets.json').read_text())
for name, size in ICONS.items():
    registry['icons'][name] = output(name, size, size)
for key, (name, width, height, inset) in FRAMES.items():
    registry['frames'][key] = {**output(name, width, height, True), 'slice': inset}
for path in (ART / 'generated-assets.json', ROOT / 'src/game/generated-assets.json'):
    path.write_text(json.dumps(registry, indent=2) + '\n')
print('Prepared 10 standalone AI images: three distinct frames and seven UI glyphs.')
print('Preserved the title frame, item atlas, terrain, effects, and all animation PNGs.')
