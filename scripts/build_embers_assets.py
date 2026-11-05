"""Normalize seven standalone Ember & Instinct UI images. Never constructs animation frames.

Only chroma keying, cropping, nearest-neighbor resizing and palette reduction.
Run last, after inventory -> camp-ui -> trail-ui -> hearth. --normalized-only uses checked-in sources.
"""
from pathlib import Path
from PIL import Image, ImageOps
import argparse
import json

ROOT = Path(__file__).resolve().parents[1]
ART = ROOT / 'public/art'
RAW = ROOT / '.art-originals/embers-instinct'
NORMAL = ART / 'generated/embers-instinct'
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--normalized-only', action='store_true')
args = parser.parse_args()
NORMAL.mkdir(parents=True, exist_ok=True)


def prepare(name, size, mode):
    image = Image.open(RAW / f'{name}.png').convert('RGBA')
    if mode == 'scene':
        return ImageOps.fit(image.convert('RGB'), size, method=Image.Resampling.NEAREST).quantize(
            colors=28, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).convert('RGBA')
    pixels = image.get_flattened_data() if hasattr(image, 'get_flattened_data') else image.getdata()
    image.putdata([(0, 0, 0, 0) if r > g + 35 and b > g + 35 and min(r, b) > max(70, g * 2.5)
                   else (r, g, b, a) for r, g, b, a in pixels])
    box = image.getbbox()
    if not box:
        raise ValueError(f'Empty generated foreground: {name}')
    image = image.crop(box)
    if mode == 'frame':
        image = image.resize(size, Image.Resampling.NEAREST)
    else:
        scale = min((size[0] - 4) / image.width, (size[1] - 4) / image.height)
        image = image.resize((max(1, round(image.width * scale)), max(1, round(image.height * scale))),
                             Image.Resampling.NEAREST)
    image = image.quantize(colors=16, method=Image.Quantize.FASTOCTREE,
                           dither=Image.Dither.NONE).convert('RGBA')
    result = Image.new('RGBA', size)
    result.alpha_composite(image, ((size[0] - image.width) // 2, (size[1] - image.height) // 2))
    return result


def output(name, size, folder, mode='sprite'):
    source = NORMAL / f'{name}.png'
    if not args.normalized_only and (RAW / f'{name}.png').exists():
        prepare(name, size, mode).save(source, optimize=True)
    with Image.open(source) as image:
        if image.size != size:
            raise ValueError(f'Incorrect normalized dimensions: {source}')
    target = ART / folder / f'{name}.png'
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(source.read_bytes())
    return {'file': f'art/{folder}/{name}.png', 'width': size[0], 'height': size[1],
            'source': 'generated', 'sourceAsset': f'art/generated/embers-instinct/{name}.png'}


registry = json.loads((ART / 'generated-assets.json').read_text())
registry['frames']['settings'] = {**output('settings-frame', (192, 128), 'ui', 'frame'), 'slice': 18}
registry['frames']['hearth'] = {**output('hearth-frame', (192, 96), 'ui', 'frame'), 'slice': 20}
for key, name in [('audio', 'audio-emblem'), ('display', 'display-emblem'),
                  ('controls', 'controls-emblem'), ('wolfMark', 'wolf-mark'), ('mouse', 'mouse-emblem')]:
    registry['icons'][key] = output(name, (24, 24), 'ui')
for path in (ART / 'generated-assets.json', ROOT / 'src/game/generated-assets.json'):
    path.write_text(json.dumps(registry, indent=2) + '\n')
print('Prepared seven standalone settings/hearth frames and UI emblems. No actor art or animation changes.')
