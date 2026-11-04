"""Chroma-key generated sprites, normalize their pixel scale, and pack an atlas.
The generated source images are stored locally in .art-originals/.
Runtime sprites and the packed sheet are kept in public/art/.
"""
from PIL import Image, ImageDraw
from pathlib import Path
import json

root = Path(__file__).resolve().parents[1]
art = root / 'public' / 'art'
originals = root / '.art-originals'
originals.mkdir(exist_ok=True)

sprites = {'pine': (48, 66), 'ranger': (24, 34), 'wolf': (44, 25), 'campfire': (30, 35)}
for name, size in sprites.items():
    source = art / f'{name}-source.png'
    if source.exists():
        source.rename(originals / source.name)
    source = originals / f'{name}-source.png'
    if not source.exists():
        continue
    im = Image.open(source).convert('RGBA')
    pixels = im.load()
    for y in range(im.height):
        for x in range(im.width):
            r,g,b,a = pixels[x,y]
            if r - g > 12 and b - g > 12 and min(r, b) > g * 1.3:
                pixels[x,y] = (0,0,0,0)
    im = im.crop(im.getbbox()).resize(size, Image.Resampling.NEAREST)
    im = im.quantize(colors=18, method=Image.Quantize.FASTOCTREE).convert('RGBA')
    im.save(art / f'{name}.png', optimize=True)

menu = art / 'forest-menu.png'
if menu.exists():
    im = Image.open(menu).convert('RGB')
    im = im.resize((704,384), Image.Resampling.NEAREST)
    im = im.quantize(colors=80).convert('RGB')
    im.save(art / 'forest-menu.webp', lossless=True)
    menu.rename(originals / menu.name)

sheet = Image.new('RGBA', (192, 80))
manifest = {}
x=4
for name in sprites:
    im = Image.open(art / f'{name}.png')
    sheet.paste(im, (x, 4))
    manifest[name] = {'x': x, 'y': 4, 'w': im.width, 'h': im.height}
    x += im.width + 8
sheet.save(art / 'forest-sprites.png')
(art / 'forest-sprites.json').write_text(json.dumps(manifest, indent=2))

# Small hand-pixelled inventory props, kept on a shared 16px grid.
icons = {
'wood': ['................','................','.........bb.....','.......bbttb....','.....bbtttlb....','...bbtttllbb....','..btttllbbtb....','.bttllbbtttb....','.bllbbttttb.....','..bbttttbb......','...bttbb........','....bb..........','................'],
'stone': ['................','................','......ggg.......','....gglllg......','...gllllllg.....','..gllmllllmg....','.gllmmmmmmmg....','.gmmmmmmmmmdg...','.gmmmmmdddddg...','..gddddddddg....','...gggggggg.....','................'],
'fiber': ['................','.........l......','.....l..ll......','.....ll.l.l.....','...l.lll.ll.....','...ll.l.ll......','....lll.ll......','.....llll.......','......tt........','.....tttt.......','.....ll.ll......','....ll...ll.....','................'],
'berries': ['................','......l.........','.....lll.ll.....','......llll......','....rr.rr.......','...rhhrrhr......','...rhrrhhr......','....rrrhr.......','.....rrrr.......','....rhrrhr......','....rrrrrr......','......rr........','................'],
'water': ['................','......bbbb......','......bttb......','.....gggggg.....','....gllllllg....','....glwllllg....','....glwwwwwg....','....glwwwwwg....','....glwwwwwg....','....gwwwwwwg....','....gwwwwwwg....','.....gggggg.....','................'],
'mushroom': ['................','................','.....rrrrr......','....rhhhrhr.....','...rhhrrhhhr....','..rhrhhhrhrhr...','..rrrrrrrrrrr...','....bttttb......','......tt........','......tt........','.....tttt.......','.....bbbb.......','................'],
'bandage': ['................','................','....ttttttt.....','...tlllllllt....','..tllttttlllt...','..tllthhtlllt...','..tllhhhhhllt...','..tllthhtlllt...','..tllttttlllt...','...tlllllllt....','....ttttttt.....','................'],
'hatchet': ['................','......ggg.......','....gglllg......','...gllllllg.....','...gmmmttmg.....','....ggttmg......','.....ttgg.......','....tt..........','...tt...........','..tt............','..bb............','................'],
'meal': ['................','................','....rr.ll.......','..rrrrllll......','..rrttttrr......','.bbbbbbbbbbb....','.btttttttttb....','..btttttttb.....','...btttttb......','....bbbbb.......','................'],
'shelter': ['................','.......t........','......tlt.......','.....tlllt......','....tlllllt.....','...tlllllmlt....','..tllllmmtllt...','.tllllmmdmtllt..','.tttttdddddttt..','...b.......b....','................'],
'campfire': ['................','.......h........','......rhr.......','....r.rhh.......','....rrhhhhr.....','....rhhhhr......','.....rrrr.......','...bbttbb.......','..ttbbtttt......','....bbttbb......','................'],
 'torch': ['................','.......h........','......rhr.......','.....rhhhr......','.....rhhhr......','......rrr.......','......tt........','......tt........','......tt........','......tt........','......bb........','................']
}
pal = {'b':'#463d2c','t':'#b18d55','l':'#b7c991','g':'#303d3a','m':'#7c8c7c','d':'#4e5b55','r':'#b66a5d','h':'#edb783','w':'#6da7ad'}
icon_sheet=Image.new('RGBA',(16*6,16*2))
for idx,(name,lines) in enumerate(icons.items()):
    im=Image.new('RGBA',(16,16))
    draw=ImageDraw.Draw(im)
    for y,line in enumerate(lines):
        for x,c in enumerate(line):
            if c!='.': draw.point((x,y),fill=pal[c])
    im.save(art/f'item-{name}.png')
    icon_sheet.paste(im,((idx%6)*16,(idx//6)*16))
icon_sheet.save(art/'item-sprites.png')

# Unreleased-biome thumbnails are deliberately subdued, original pixel scenery.
for biome in ['alpine','dunes']:
    w,h=320,112
    im=Image.new('RGB',(w,h), '#354649' if biome=='alpine' else '#544634')
    d=ImageDraw.Draw(im)
    if biome=='alpine':
        d.rectangle((218,13,238,33),fill='#a3af9d')
        d.polygon([(0,94),(52,40),(92,76),(151,12),(221,89),(279,38),(320,84),(320,112),(0,112)],fill='#6a7e7c')
        d.polygon([(120,49),(151,12),(183,51),(162,40),(153,47),(142,38)],fill='#bcc1aa')
        d.polygon([(0,110),(79,65),(128,105),(225,44),(320,108),(320,112)],fill='#425d5b')
        for x,y in [(145,81),(168,87),(279,71),(299,81),(112,90),(250,85)]:
            d.polygon([(x,y-25),(x-9,y),(x-6,y),(x-13,y+10),(x+13,y+10),(x+6,y),(x+9,y)],fill='#223d3b')
            d.rectangle((x-2,y+9,x+2,112),fill='#223d3b')
    else:
        d.rectangle((228,19,251,42),fill='#bc9b64')
        d.polygon([(0,82),(76,51),(110,54),(231,91),(320,66),(320,112),(0,112)],fill='#8e7552')
        d.polygon([(0,95),(95,76),(168,78),(235,56),(280,57),(320,69),(320,112),(0,112)],fill='#a3875d')
        d.polygon([(0,112),(70,91),(130,90),(212,105),(270,86),(320,87),(320,112)],fill='#65573d')
        d.rectangle((267,64,272,105),fill='#394936')
        d.rectangle((257,78,270,83),fill='#394936')
        d.rectangle((255,67,260,83),fill='#394936')
        d.rectangle((271,74,282,79),fill='#394936')
        d.rectangle((278,61,283,79),fill='#394936')
    im.resize((160,56),Image.Resampling.NEAREST).save(art/f'{biome}.png')
print('Prepared game sprites, atlas, inventory icons, and biome thumbnails.')
