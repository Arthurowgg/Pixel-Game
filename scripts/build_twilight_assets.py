"""Prepare eight standalone Trails & Twilight assets (eight generation calls).

Only chroma-key removal, cropping, nearest-neighbor resizing, palette reduction
and copying. Never builds, poses, edits or rigs an actor/tool animation.
Run last, after build_roots_assets.py. --normalized-only needs no raw sources.
"""
from pathlib import Path
from PIL import Image, ImageOps
import argparse
import json

ROOT = Path(__file__).resolve().parents[1]
ART = ROOT / 'public/art'
RAW = ROOT / '.art-originals/trails-twilight'
NORMAL = ART / 'generated/trails-twilight'
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--normalized-only', action='store_true')
args = parser.parse_args()
NORMAL.mkdir(parents=True, exist_ok=True)


def prepare(name, size, mode):
    image = Image.open(RAW / f'{name}.png').convert('RGBA')
    if mode == 'texture':
        return ImageOps.fit(image.convert('RGB'), size, method=Image.Resampling.NEAREST).quantize(
            colors=12, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).convert('RGBA')
    pixels = image.get_flattened_data() if hasattr(image, 'get_flattened_data') else image.getdata()
    # Chroma-key the generated magenta sheet, including its soft mauve fringe,
    # without touching warm browns, embers or green foliage.
    image.putdata([(0, 0, 0, 0) if r > g + 35 and b > g + 28 and min(r, b) > 78
                   else (r, g, b, a) for r, g, b, a in pixels])
    if name == 'camp-ground':
        # The source clearing grew a straight-edged path arm on its right. Trim
        # that arm at the body's own boundary so the dirt ends in an organic rim.
        cut = image.copy()
        pix = cut.load()
        for y in range(240, 566):
            for x in range(1070, cut.width):
                pix[x, y] = (0, 0, 0, 0)
        image = cut
    bounds = image.getbbox()
    if not bounds:
        raise ValueError(f'Empty image: {name}')
    image = image.crop(bounds)
    if mode == 'frame':
        image = image.resize(size, Image.Resampling.NEAREST)
    else:
        ratio = min((size[0] - 4) / image.width, (size[1] - 4) / image.height)
        image = image.resize((max(1, round(image.width * ratio)), max(1, round(image.height * ratio))),
                             Image.Resampling.NEAREST)
    image = image.quantize(colors=24, method=Image.Quantize.FASTOCTREE,
                           dither=Image.Dither.NONE).convert('RGBA')
    result = Image.new('RGBA', size)
    result.alpha_composite(image, ((size[0] - image.width) // 2, (size[1] - image.height) // 2))
    return result


def output(name, size, folder, mode='sprite'):
    source = NORMAL / f'{name}.png'
    if not args.normalized_only:
        prepare(name, size, mode).save(source, optimize=True)
    with Image.open(source) as image:
        if image.size != size:
            raise ValueError(f'Incorrect normalized dimensions: {source}')
    target = ART / folder / f'{name}.png'
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(source.read_bytes())
    return {'file': f'art/{folder}/{name}.png', 'width': size[0], 'height': size[1],
            'source': 'generated', 'sourceAsset': f'art/generated/trails-twilight/{name}.png'}


registry = json.loads((ART / 'generated-assets.json').read_text())
registry['objects']['campGround'] = {**output('camp-ground', (312, 216), 'objects'), 'anchor': [156, 108]}
registry['objects']['fallenLog'] = {**output('fallen-log', (64, 40), 'objects'), 'anchor': [32, 34]}
registry['objects']['waystone'] = {**output('waystone', (38, 46), 'objects'), 'anchor': [19, 42]}
registry['frames']['map'] = {**output('map-frame', (192, 128), 'ui', 'frame'), 'slice': 14}
registry['textures']['mapPaper'] = output('map-paper', (96, 96), 'textures', 'texture')
registry['icons']['mapPine'] = output('map-pine', (16, 22), 'ui')
registry['icons']['mapBoulder'] = output('map-boulder', (18, 14), 'ui')
registry['icons']['forestCursor'] = output('forest-cursor', (28, 32), 'ui')
for path in (ART / 'generated-assets.json', ROOT / 'src/game/generated-assets.json'):
    path.write_text(json.dumps(registry, indent=2) + '\n')
print('Prepared eight static images; all existing art and animation sheets preserved.')
