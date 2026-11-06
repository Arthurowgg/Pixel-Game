"""Prepare the small decorative props scattered through The Forest.

Nine generation calls, six shipped sprites: the first fern and the first two
wildflower sheets were re-rolled because they smeared at sprite scale, and the
clover tuft was added once the palette was settled. Each sheet is keyed off its
flat magenta background, cropped to content, area-downsampled to sprite scale,
palette-reduced and anchored bottom-centre so `Renderer.decor` can stand it on a
ground point. Rejected sheets are kept under .art-originals as art direction.

Run after the other static builders, because it edits the shared registry.
--normalized-only needs no raw sources and only re-copies what is already there.
"""
from pathlib import Path
from PIL import Image
import argparse
import json

ROOT = Path(__file__).resolve().parents[1]
ART = ROOT / 'public/art'
RAW = ROOT / '.art-originals/decor-pass'
NORMAL = ART / 'generated/decor-pass'
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--normalized-only', action='store_true')
args = parser.parse_args()
NORMAL.mkdir(parents=True, exist_ok=True)

# registry key -> (target size, source stem, ground anchor, (gain, desaturation)).
# The generator paints brighter than the forest floor, so each sheet is pulled
# back into the twilight register: the fern needs the most, the blossoms least.
ASSETS = {
    'mushrooms': ((18, 14), 'mushrooms', (9, 13), (0.90, 0.10)),
    'fern': ((22, 18), 'fern2', (11, 17), (0.84, 0.18)),
    'wildflowers': ((18, 14), 'flowers3', (9, 13), (0.95, 0.05)),
    'clover': ((20, 13), 'clover', (10, 12), (0.92, 0.10)),
    'mossBoulder': ((20, 15), 'boulder', (10, 14), (0.93, 0.06)),
    'reeds': ((16, 22), 'reeds', (8, 21), (0.94, 0.08)),
}


def harmonise(image, gain, desaturate):
    """Blend a little towards the muted forest palette without going muddy."""
    pixels = []
    for r, g, b, a in image.getdata():
        if not a:
            pixels.append((0, 0, 0, 0))
            continue
        light = r * 0.299 + g * 0.587 + b * 0.114
        channels = [
            int((channel * (1 - desaturate) + light * desaturate) * gain) for channel in (r, g, b)
        ]
        pixels.append((*channels, 255))
    image.putdata(pixels)
    return image


def prepare(stem, size, gain, desaturate):
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
    image = image.quantize(colors=16, method=Image.Quantize.FASTOCTREE,
                           dither=Image.Dither.NONE).convert('RGBA')
    image.putdata([(0, 0, 0, 0) if a < 96 else (r, g, b, 255) for r, g, b, a in image.getdata()])
    return harmonise(image, gain, desaturate)


def output(name, size, stem, anchor, tint):
    normalized = NORMAL / f'{name}.png'
    if not args.normalized_only:
        prepare(stem, size, *tint).save(normalized, optimize=True)
    with Image.open(normalized) as image:
        if image.size != size:
            raise ValueError(f'Incorrect normalized dimensions: {normalized}')
    target = ART / 'objects' / f'{name}.png'
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(normalized.read_bytes())
    return {'file': f'art/objects/{name}.png', 'width': size[0], 'height': size[1],
            'source': 'generated', 'sourceAsset': f'art/generated/decor-pass/{name}.png',
            'anchor': list(anchor)}


registry = json.loads((ART / 'generated-assets.json').read_text())
for name, (size, stem, anchor, tint) in ASSETS.items():
    registry['objects'][name] = output(name, size, stem, anchor, tint)
for path in (ART / 'generated-assets.json', ROOT / 'src/game/generated-assets.json'):
    path.write_text(json.dumps(registry, indent=2) + '\n')
print('Prepared six decorative props; all existing art and sheets preserved.')
