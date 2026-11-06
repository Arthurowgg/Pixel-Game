"""Add the four new supplies to the shared item atlas.

Rope, plank, moss and salve are generated separately (see .art-originals/items-pass).
This keying/cropping step writes 16x16 item PNGs, appends them to the third row of
`public/art/item-sprites.png` (128x32 -> 128x48) and records the cells in both atlas
manifests. The sixteen original cells keep their exact pixels and coordinates.
"""
from pathlib import Path
from PIL import Image
import json

ROOT = Path(__file__).resolve().parents[1]
ART = ROOT / 'public/art'
RAW = ROOT / '.art-originals/items-pass'
CELL = 16
# registry key -> (source stem, atlas cell index)
NEW = {
    'rope': ('rope', 16),
    'plank': ('plank2', 17),
    'moss': ('moss', 18),
    'salve': ('salve', 19),
}


def prepare(stem):
    image = Image.open(RAW / f'{stem}-raw.png').convert('RGBA')
    image.putdata([
        (0, 0, 0, 0) if r > g + 40 and b > g + 30 and min(r, b) > 110 and g < 150
        else (r, g, b, a)
        for r, g, b, a in image.getdata()
    ])
    image = image.crop(image.getbbox()).resize((CELL, CELL), Image.Resampling.BOX)
    image = image.quantize(colors=14, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.NONE)
    image = image.convert('RGBA')
    image.putdata([(0, 0, 0, 0) if a < 110 else (r, g, b, 255) for r, g, b, a in image.getdata()])
    return image


rows = 3
columns = 8
sheet = Image.new('RGBA', (columns * CELL, rows * CELL), (0, 0, 0, 0))
sheet.alpha_composite(Image.open(ART / 'item-sprites.png').convert('RGBA'), (0, 0))

atlas = json.loads((ART / 'item-sprites.json').read_text())
for name, (stem, index) in NEW.items():
    icon = prepare(stem)
    source = ART / 'generated/items-pass' / f'{name}.png'
    source.parent.mkdir(parents=True, exist_ok=True)
    icon.save(source, optimize=True)
    (ART / f'item-{name}.png').write_bytes(source.read_bytes())
    x, y = (index % columns) * CELL, (index // columns) * CELL
    sheet.alpha_composite(icon, (x, y))
    atlas['items'][name] = {
        'x': x,
        'y': y,
        'w': CELL,
        'h': CELL,
        'source': 'generated',
        'sourceAsset': f'art/generated/items-pass/{name}.png',
    }

atlas['width'] = columns * CELL
atlas['height'] = rows * CELL
sheet.save(ART / 'item-sprites.png', optimize=True)
for target in (ART / 'item-sprites.json', ROOT / 'src/game/item-atlas.json'):
    target.write_text(json.dumps(atlas, indent=2) + '\n')
print(f'Item atlas: {len(atlas["items"])} icons in {atlas["width"]}x{atlas["height"]}.')
