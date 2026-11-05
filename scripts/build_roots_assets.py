"""Normalize Roots & Refuge's eight standalone images (nine generation calls).

The seated survivor and bench are one complete AI-drawn static state, approved
by the user, not assembled limbs or an animation sheet. Both bench states use
the same source crop/scale to keep their common ground registration.
Only keying, cropping, nearest-neighbor resizing, palette reduction and packing
are used. Run after all older static builders. Never run an animation builder.
"""
from pathlib import Path
from PIL import Image, ImageOps
import argparse
import json

ROOT = Path(__file__).resolve().parents[1]
ART = ROOT / 'public/art'
RAW = ROOT / '.art-originals/roots-reclaimed'
NORMAL = ART / 'generated/roots-reclaimed'
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--normalized-only', action='store_true')
args = parser.parse_args()
NORMAL.mkdir(parents=True, exist_ok=True)


def keyed(name):
    image = Image.open(RAW / f'{name}.png').convert('RGBA')
    pixels = image.get_flattened_data() if hasattr(image, 'get_flattened_data') else image.getdata()
    image.putdata([(0, 0, 0, 0) if r > g + 35 and b > g + 35 and min(r, b) > max(70, g * 2.5)
                   else (r, g, b, a) for r, g, b, a in pixels])
    return image


def prepare(name, size, mode):
    if mode == 'texture':
        return ImageOps.fit(Image.open(RAW / f'{name}.png').convert('RGB'), size,
                            method=Image.Resampling.NEAREST).quantize(
            colors=12, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).convert('RGBA')
    image = keyed(name)
    # The AI-drawn empty and occupied bench have the same source framing.
    box = keyed('seated-bench').getbbox() if mode == 'bench-state' else image.getbbox()
    if not box:
        raise ValueError(f'Empty source: {name}')
    image = image.crop(box)
    if mode == 'frame':
        image = image.resize(size, Image.Resampling.NEAREST)
    else:
        scale = min((size[0] - 4) / image.width, (size[1] - 4) / image.height)
        image = image.resize((max(1, round(image.width * scale)), max(1, round(image.height * scale))),
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
            'source': 'generated', 'sourceAsset': f'art/generated/roots-reclaimed/{name}.png'}


registry = json.loads((ART / 'generated-assets.json').read_text())
registry['objects']['workbench'] = {**output('workbench', (42, 30), 'objects'), 'anchor': [21, 26]}
for key, name in [('campBench', 'camp-bench'), ('seatedBench', 'seated-bench')]:
    registry['objects'][key] = {**output(name, (48, 42), 'objects', 'bench-state'), 'anchor': [24, 40]}
registry['objects']['pineStump'] = {**output('pine-stump', (26, 22), 'objects'), 'anchor': [13, 19]}
registry['objects']['campClearing'] = {**output('camp-clearing', (240, 184), 'objects'), 'anchor': [120, 92]}
registry['frames']['inventory'] = {**output('satchel-frame', (192, 128), 'ui', 'frame'), 'slice': 20}
registry['frames']['workshop'] = {**output('fieldwork-frame', (192, 128), 'ui', 'frame'), 'slice': 18}
registry['textures']['satchelLinen'] = output('satchel-linen', (64, 64), 'textures', 'texture')
for path in (ART / 'generated-assets.json', ROOT / 'src/game/generated-assets.json'):
    path.write_text(json.dumps(registry, indent=2) + '\n')

# Reuse the liked, unchanged workbench icon. This is ordinary static-item atlas
# packing into its unused last cell, NOT an AI-drawn animation or new generation.
atlas_path = ROOT / 'src/game/item-atlas.json'
atlas = json.loads(atlas_path.read_text())
icon = Image.open(ART / 'ui/workbench-icon.png').convert('RGBA').resize((16, 16), Image.Resampling.NEAREST)
icon.save(ART / 'item-workbench.png', optimize=True)
sheet_path = ART / 'item-sprites.png'
sheet = Image.open(sheet_path).convert('RGBA')
sheet.paste((0, 0, 0, 0), (112, 16, 128, 32))
sheet.alpha_composite(icon, (112, 16))
sheet.save(sheet_path, optimize=True)
atlas['items']['workbench'] = {'x': 112, 'y': 16, 'w': 16, 'h': 16,
                              'source': 'generated', 'sourceAsset': 'art/ui/workbench-icon.png'}
for path in (atlas_path, ART / 'item-sprites.json'):
    path.write_text(json.dumps(atlas, indent=2) + '\n')
print('Prepared eight standalone images and reused the existing workbench icon.')
print('All existing actor/tool sheets and animation manifests remain untouched.')
