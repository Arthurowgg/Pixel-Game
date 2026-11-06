"""Prepare one standalone combat asset (four generation calls, one shipped sprite).

The survivor rig and its held tools are authored in code; the dust puff is a
single generated static sprite. Key, crop, area-downsample, palette-reduce, copy.
The generated axe, pickaxe and survivor sheet were used as art direction only:
at 13 px they collapse into mush, so the in-hand tools stay authored pixels.
Run last, after every other static builder, because it edits the shared registry.
--normalized-only needs no raw sources.
"""
from pathlib import Path
from PIL import Image
import argparse
import json

ROOT = Path(__file__).resolve().parents[1]
ART = ROOT / 'public/art'
RAW = ROOT / '.art-originals/actor-pass'
NORMAL = ART / 'generated/actor-pass'
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--normalized-only', action='store_true')
args = parser.parse_args()
NORMAL.mkdir(parents=True, exist_ok=True)

# name -> (target size, source file stem)
ASSETS = {'dust-puff': ((20, 15), 'dust')}


def prepare(stem, size):
    image = Image.open(RAW / f'{stem}-raw.png').convert('RGBA')
    # The generator paints one flat magenta sheet; key it, including soft edges.
    image.putdata([(0, 0, 0, 0) if r > g + 40 and b > g + 30 and min(r, b) > 110 and g < 150
                   else (r, g, b, a) for r, g, b, a in image.getdata()])
    bounds = image.getbbox()
    if not bounds:
        raise ValueError(f'Empty image: {stem}')
    image = image.crop(bounds)
    # Area-average down to sprite scale, then reduce the palette without dithering.
    image = image.resize(size, Image.Resampling.BOX)
    image = image.quantize(colors=14, method=Image.Quantize.FASTOCTREE,
                           dither=Image.Dither.NONE).convert('RGBA')
    pixels = []
    for r, g, b, a in image.getdata():
        pixels.append((0, 0, 0, 0) if a < 96 else (r, g, b, 255))
    image.putdata(pixels)
    return image


def output(name, size, stem):
    normalized = NORMAL / f'{name}.png'
    if not args.normalized_only:
        prepare(stem, size).save(normalized, optimize=True)
    with Image.open(normalized) as image:
        if image.size != size:
            raise ValueError(f'Incorrect normalized dimensions: {normalized}')
    target = ART / 'effects' / f'{name}.png'
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(normalized.read_bytes())
    return {'file': f'art/effects/{name}.png', 'width': size[0], 'height': size[1],
            'source': 'generated', 'sourceAsset': f'art/generated/actor-pass/{name}.png'}


registry = json.loads((ART / 'generated-assets.json').read_text())
for name, (size, stem) in ASSETS.items():
    registry['effects']['dustPuff'] = output(name, size, stem)
for path in (ART / 'generated-assets.json', ROOT / 'src/game/generated-assets.json'):
    path.write_text(json.dumps(registry, indent=2) + '\n')
print('Prepared the dust puff; all existing art and sheets preserved.')
