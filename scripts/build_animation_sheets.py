"""Build real, frame-addressable pixel animation sheets from generated key poses.

Raw image-generation outputs are optional and intentionally not committed.
The normalized keyframes in public/art/keyframes are sufficient to rebuild.
Run with Python + Pillow. No interpolation, anti-aliasing, or runtime slicing.
"""
from PIL import Image, ImageDraw, ImageOps
from pathlib import Path
import json
import argparse
import math
import random

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--normalized-only', action='store_true', help='Rebuild only from the checked-in, normalized keyframes.')
args = parser.parse_args()

ROOT = Path(__file__).resolve().parents[1]
ART = ROOT / 'public/art'
KEYS = ART / 'keyframes'
OUT = ART / 'animations'
RAW = ROOT / '.art-originals'
for path in (KEYS, OUT):
    path.mkdir(parents=True, exist_ok=True)
NEAREST = Image.Resampling.NEAREST
CLEAR = (0, 0, 0, 0)

sources = {
    'survivor-front': (20, 34), 'survivor-side': (20, 34),
    'survivor-back': (20, 34), 'survivor-work': (24, 34),
    'wolf-stride': (44, 25), 'fire-high': (30, 35),
    'rock': (24, 19), 'berry-bush': (26, 20),
}
for name, size in sources.items():
    raw = RAW / f'animation-{name}.png'
    if args.normalized_only or not raw.exists():
        continue
    image = Image.open(raw).convert('RGBA')
    if name == 'survivor-back':
        # The generated rear-view reference has decorative copies at its edges;
        # only the complete, central, identically styled character is a keyframe.
        image = image.crop((int(image.width * .38), 0, int(image.width * .62), image.height))
    pixels = image.load()
    for y in range(image.height):
        for x in range(image.width):
            r, g, b, a = pixels[x, y]
            if r - g > 12 and b - g > 12 and min(r, b) > g * 1.3:
                pixels[x, y] = CLEAR
    image = image.crop(image.getbbox()).resize(size, NEAREST)
    image = image.quantize(colors=24, method=Image.Quantize.FASTOCTREE).convert('RGBA')
    image.save(KEYS / f'{name}.png', optimize=True)

key = {name: Image.open(KEYS / f'{name}.png').convert('RGBA') for name in sources}
# A shared character palette prevents color flicker between generated directions.
def pixels_of(image):
    return image.get_flattened_data() if hasattr(image, 'get_flattened_data') else image.getdata()

actor_palette = sorted({p[:3] for p in pixels_of(key['survivor-front']) if p[3]})
def match_palette(image, palette):
    result = image.copy()
    colors = {}
    for color in set(pixels_of(image)):
        if color[3] == 0:
            colors[color] = CLEAR
        else:
            nearest = min(palette, key=lambda p: sum((p[i] - color[i]) ** 2 for i in range(3)))
            colors[color] = (*nearest, 255)
    result.putdata([colors[p] for p in pixels_of(image)])
    return result
for name in ['survivor-side', 'survivor-back', 'survivor-work']:
    key[name] = match_palette(key[name], actor_palette)

# The old portraits now also have empty hands; equipment is never baked in.
key['survivor-front'].save(ART / 'ranger.png', optimize=True)

clips = {}
sheets = {}
class Atlas:
    def __init__(self, name, cell, rows, columns=8):
        self.name, self.cell, self.row = name, cell, 0
        self.image = Image.new('RGBA', (cell[0] * columns, cell[1] * rows))
        self.columns = columns
    def add(self, name, frames, fps=8, loop=True, anchor=None, hands=None):
        assert len(frames) <= self.columns
        w, h = self.cell
        for i, frame in enumerate(frames):
            assert frame.size == self.cell, (name, frame.size, self.cell)
            self.image.alpha_composite(frame, (i * w, self.row * h))
        clip = {'sheet': self.name, 'x': 0, 'y': self.row * h, 'w': w, 'h': h,
                'frames': len(frames), 'fps': fps, 'loop': loop,
                'anchor': anchor or [w // 2, h - 4]}
        if hands is not None:
            clip['hands'] = hands
        clips[name] = clip
        self.row += 1
    def save(self):
        self.image = self.image.crop((0, 0, self.image.width, self.cell[1] * self.row))
        self.image.save(OUT / f'{self.name}.png', optimize=True)
        sheets[self.name] = {'width': self.image.width, 'height': self.image.height}

OUTLINE = '#171b12'
COAT = '#a75d32'
COAT_LIGHT = '#c47948'
SKIN = '#eddbb1'
SKIN_SHADOW = '#c6a274'

def arm(draw, shoulder, hand, behind=False):
    sx, sy = shoulder
    hx, hy = hand
    elbow = (round((sx + hx) / 2 + (1 if hx >= sx else -1)), round((sy + hy) / 2))
    draw.line([shoulder, elbow, (hx, hy - 1)], fill=OUTLINE, width=5)
    draw.line([shoulder, elbow, (hx, hy - 1)], fill=COAT if behind else COAT_LIGHT, width=3)
    draw.rectangle((hx - 1, hy - 1, hx + 1, hy + 1), fill=SKIN_SHADOW if behind else SKIN)
    draw.point((hx - 1, hy + 1), fill=SKIN_SHADOW)

def actor_body(direction, frame, mode):
    base = key[{'down': 'survivor-front', 'right': 'survivor-side', 'up': 'survivor-back'}[direction]].copy()
    body = base.crop((0, 0, 20, 27))
    # Separate the original relaxed arms from the upper body. Preserve green
    # backpack pixels, then redraw jointed sleeves on the same integer grid.
    pix = body.load()
    for y in range(17, 27):
        for x in list(range(0, 4)) + list(range(16, 20)):
            r, g, b, a = pix[x, y]
            green_backpack = g > r * 1.07 and g > b
            if not green_backpack:
                pix[x, y] = CLEAR
    image = Image.new('RGBA', (48, 48))
    moving = mode in ('walk', 'run')
    cycle = [0, 1, 2, 1, 0, -1, -2, -1][frame % 8] if moving else 0
    if mode == 'run':
        cycle = round(cycle * 1.5)
    bob = -1 if moving and frame % 4 in (1, 2) else 0
    if mode in ('forage', 'build'):
        bob = [0, 1, 2, 3, 3, 2, 1, 0][frame]
    elif mode == 'use':
        bob = [0, 0, 0, 1, 1, 0, 0, 0][frame]
    elif mode == 'idle':
        bob = -1 if frame in (3, 4) else 0
    # Independently moving boots and knees are visible at every walk speed.
    left = base.crop((3, 26, 10, 34))
    right = base.crop((10, 26, 19, 34))
    image.alpha_composite(left, (17 + (cycle if direction == 'right' else 0), 34 + min(0, cycle)))
    image.alpha_composite(right, (24 - (cycle if direction == 'right' else 0), 34 + min(0, -cycle)))
    image.alpha_composite(body, (14, 8 + bob))
    return image, bob

hand_cycles = {
    'axe': [(9,-13,15),(8,-19,-15),(10,-26,-65),(11,-27,-80),(15,-14,75),(14,-8,125),(11,-11,55),(9,-13,15)],
    'mine': [(9,-13,5),(9,-20,-30),(10,-27,-55),(10,-28,-70),(14,-12,90),(14,-7,125),(11,-10,50),(9,-13,5)],
    'forage': [(9,-13,0),(10,-10,5),(11,-6,15),(12,-3,20),(12,-3,15),(11,-6,5),(10,-10,0),(9,-13,0)],
    'use': [(9,-13,0),(8,-17,-10),(6,-22,-20),(4,-23,-35),(4,-23,-35),(6,-21,-15),(8,-17,0),(9,-13,0)],
    'build': [(9,-13,0),(10,-9,10),(11,-5,15),(13,-3,10),(11,-6,-10),(13,-3,10),(10,-9,0),(9,-13,0)],
    'attack': [(9,-13,0),(7,-16,-20),(7,-17,-30),(15,-16,20),(17,-15,50),(13,-13,30),(10,-13,10),(9,-13,0)],
}
actor_atlas = Atlas('survivor', (48, 48), 27)
for direction in ('down', 'right', 'up'):
    for mode in ('idle', 'walk', 'run', 'axe', 'mine', 'forage', 'use', 'build', 'attack'):
        frames, hands = [], []
        for index in range(8):
            image, bob = actor_body(direction, index, mode)
            if mode in hand_cycles:
                hx, hy, angle = hand_cycles[mode][index]
            else:
                swing = [0, 1, 2, 1, 0, -1, -2, -1][index] if mode in ('walk', 'run') else 0
                hx, hy, angle = 9 + round(swing / 2), -13 - swing + bob, 12 + swing * 3
            if mode in ('axe', 'mine', 'attack') and direction == 'up':
                hx, hy, angle = round(hx * .45), hy - 8, angle * .2
            elif mode in ('axe', 'mine', 'attack') and direction == 'down':
                hx, hy, angle = round(hx * .65), hy + (8 if index in (4,5) else 1), angle + 48
            draw = ImageDraw.Draw(image)
            arm(draw, (19, 27 + bob), (18, 34 - bob), behind=True)
            arm(draw, (29, 27 + bob), (24 + hx, 42 + hy))
            # The generated raised-hands key pose anchors the right-facing
            # wind-up, with neighboring in-between frames assembled above.
            if direction == 'right' and mode in ('axe', 'mine') and index in (2, 3):
                image = Image.new('RGBA', (48, 48))
                image.alpha_composite(ImageOps.mirror(key['survivor-work']), (12, 8))
                hx, hy = 10, -23
            if mode == 'idle' and index == 7 and direction != 'up':
                # One quick blink at the tail of a four-second idle loop.
                draw = ImageDraw.Draw(image)
                if direction == 'down':
                    for ex, ey in [(20, 19 + bob), (24, 20 + bob)]:
                        draw.line((ex, ey, ex+1, ey), fill='#654a2b')
                else:
                    draw.point((27, 19 + bob), fill='#654a2b')
            frames.append(image)
            hands.append([24 + hx, 42 + hy, angle])
        fps = 2 if mode == 'idle' else 10 if mode == 'walk' else 15 if mode == 'run' else 12
        actor_atlas.add(f'{mode}-{direction}', frames, fps=fps, loop=mode in ('idle', 'walk', 'run'), anchor=[24, 42], hands=hands)
actor_atlas.save()

# Separate held tools keep every item compatible with every action/direction.
tools = {
    'hatchet': ['................','.....dddd.......','....dllllld.....','...dlllllld.....','...dmmmttmd.....','....dddttd......','.......tt.......','.......tt.......','.......tt.......','.......tt.......','.......tt.......','.......tt.......','.......tt.......','.......tt.......','.......bb.......','................'],
    'pickaxe': ['................','......dddd......','...dddllllddd...','..dllmmmmtmmld..','.dmmdd.tt.ddmmd.','.dd....tt....dd.','.......tt.......','.......tt.......','.......tt.......','.......tt.......','.......tt.......','.......tt.......','.......tt.......','.......tt.......','.......bb.......','................'],
}
palette = {'d':'#27352e', 'l':'#b8c3ac', 'm':'#7b8b79', 't':'#a78351', 'b':'#4c3f2c'}
for name, lines in tools.items():
    image = Image.new('RGBA', (16, 16)); draw = ImageDraw.Draw(image)
    for y, line in enumerate(lines):
        for x, color in enumerate(line):
            if color != '.': draw.point((x,y), fill=palette[color])
    image.save(ART / f'item-{name}.png', optimize=True)

# Foliage is warped in whole pixel rows: the trunk never slides over the floor.
def sway(image, phase, amount=1):
    result = Image.new('RGBA', (image.width + 6, image.height + 4))
    for y in range(image.height):
        offset = round(math.sin(phase + y / 19) * amount * (1 - y / image.height))
        result.alpha_composite(image.crop((0, y, image.width, y+1)), (3 + offset, y + 2))
    return result

def place(image, size, anchor):
    result = Image.new('RGBA', size)
    result.alpha_composite(image, (anchor[0] - image.width // 2, anchor[1] - image.height))
    return result

pine = Image.open(ART / 'pine.png').convert('RGBA')
forest = Atlas('forest', (64, 80), 12)
forest.add('pine-sway', [place(sway(pine, i * math.pi / 3, 2), (64,80), (32,76)) for i in range(6)], fps=3, anchor=[32,74])
forest.add('pine-hit', [place(sway(pine, i * 2, [3,2,2,1,0,0][i]), (64,80), (32,76)) for i in range(6)], fps=14, loop=False, anchor=[32,74])
forest.save()
fall = Atlas('falling-tree', (96, 96), 1)
frames = []
for i, angle in enumerate([0, -5, -13, -28, -48, -72, -88, -90]):
    canvas = Image.new('RGBA', (192,192))
    canvas.alpha_composite(pine, (96 - pine.width//2, 96 - pine.height))
    canvas = canvas.rotate(angle, resample=NEAREST, center=(96,96))
    image = canvas.crop((68,11,164,107))
    if i >= 6:
        pixels = image.load()
        for y in range(image.height):
            for x in range(image.width):
                if (x + y) % (4 if i == 6 else 2) == 0: pixels[x,y] = CLEAR
    frames.append(image)
fall.add('pine-fall', frames, fps=10, loop=False, anchor=[28,85]); fall.save()

resources = Atlas('resources', (40,40), 19)
rock, bush = key['rock'], key['berry-bush']
resources.add('rock-idle', [place(rock,(40,40),(20,34))], fps=1, anchor=[20,34])
cracked = rock.copy(); draw = ImageDraw.Draw(cracked)
draw.line([(9,2),(10,6),(8,9),(11,12),(10,17)], fill='#2b382d', width=1)
draw.line([(9,9),(5,11),(3,15)], fill='#394a3a', width=1)
resources.add('rock-cracked', [place(cracked,(40,40),(20,34))], fps=1, anchor=[20,34])
frames=[]
for i in range(6):
    frame = place(cracked,(40,40),(20 + [1,-2,1,-1,0,0][i],34))
    ImageDraw.Draw(frame).point((27+i%3,19-i),fill='#d9d7af')
    frames.append(frame)
resources.add('rock-hit',frames,fps=14,loop=False,anchor=[20,34])
frames=[]
for i in range(8):
    image=Image.new('RGBA',(40,40)); draw=ImageDraw.Draw(image)
    if i < 3:
        for col in range(3):
            shard=cracked.crop((col*8,0,col*8+8,19))
            image.alpha_composite(shard,(8+col*8+(col-1)*i*2,15+i*2))
    for k in range(7):
        x=20+(k-3)*(2+i); y=26-int(math.sin(i/8*math.pi)*7)+(k%2)*4+i
        draw.rectangle((x,y,x+2,y+2),fill=['#65765a','#a0ad86','#3c4f3b'][k%3])
    frames.append(image)
resources.add('rock-break',frames,fps=12,loop=False,anchor=[20,34])
resources.add('berry-sway',[place(sway(bush,i*math.pi/3,1),(40,40),(20,36)) for i in range(6)],fps=3,anchor=[20,34])
empty_bush=bush.copy()
pixels=empty_bush.load()
for y in range(bush.height):
    for x in range(bush.width):
        r,g,b,a=pixels[x,y]
        if a and r>g*1.2 and r>b*1.15: pixels[x,y]=(75,99,65,255)
resources.add('berry-empty',[place(empty_bush,(40,40),(20,34))],fps=1,anchor=[20,34])
frames=[]
for i in range(8):
    frame=place(sway(bush if i<3 else empty_bush,i*2,2),(40,40),(20,36))
    d=ImageDraw.Draw(frame)
    for k in range(4):
        x=10+k*5+(k-2)*i; y=22-int(math.sin(i/8*math.pi)*12)+k%2*4
        if i<7: d.rectangle((x,y,x+1,y+1),fill='#bb7960')
    frames.append(frame)
resources.add('berry-harvest',frames,fps=12,loop=False,anchor=[20,34])
for name in ('fiber','mushroom'):
    image=Image.open(ART/f'item-{name}.png').convert('RGBA')
    resources.add(f'{name}-idle',[place(sway(image,i*math.pi/3,1),(40,40),(20,36)) for i in range(6)],fps=3,anchor=[20,34])
    frames=[]
    for i in range(8):
        frame=Image.new('RGBA',(40,40))
        if i<5:
            copy=image.copy()
            if i>2:
                pixels=copy.load()
                for y in range(16):
                    for x in range(16):
                        if (x+y)%3==i%3: pixels[x,y]=CLEAR
            frame.alpha_composite(copy,(12+(i%2),18-i*2))
        frames.append(frame)
    resources.add(f'{name}-harvest',frames,fps=12,loop=False,anchor=[20,34])
resources.save()

fire_base=Image.open(ART/'campfire.png').convert('RGBA')
fire_alt=key['fire-high']
fx=Atlas('effects',(48,48),9)
frames=[]
for i in range(8):
    # The logs and stone ring are invariant; only the generated flame keyframe
    # and its pixel-row in-betweens change, avoiding "breathing" rocks.
    canvas=fire_base.copy()
    canvas.paste(CLEAR,(0,0,30,19))
    flame=(fire_alt if i in (2,3,6) else fire_base).crop((0,0,30,20))
    flame=flame.resize((30,20+[0,1,3,1,0,-1,2,0][i]),NEAREST)
    canvas.alpha_composite(flame,(0,19-flame.height))
    frames.append(place(canvas,(48,48),(24,44)))
fx.add('fire-burn',frames,fps=9,anchor=[24,44])
for name,color in [('wood-chips','#b99b67'),('stone-dust','#b5bea0'),('leaf-burst','#a5bb77'),('build-dust','#cbb785')]:
    frames=[]
    for i in range(8):
        frame=Image.new('RGBA',(48,48)); draw=ImageDraw.Draw(frame)
        for k in range(11):
            angle=k*2.4
            x=24+math.cos(angle)*i*2.5
            y=35+math.sin(angle)*i*1.5-i*3+i*i*.35
            size=2 if i<4 else 1
            if i<7: draw.rectangle((round(x),round(y),round(x)+size,round(y)+size),fill=color)
        frames.append(frame)
    fx.add(name,frames,fps=14,loop=False,anchor=[24,38])
frames=[]
for i in range(8):
    frame=Image.new('RGBA',(48,48));draw=ImageDraw.Draw(frame)
    if i<6:
        color='#f0dfb3' if i<3 else '#c6c7a0'
        # Stepped three-pixel strike, not an antialiased Canvas arc.
        for k in range(5):
            x=16+i*2+k*2;y=10+k*k//2+i
            draw.rectangle((x,y,x+1,y+3),fill=color)
    frames.append(frame)
fx.add('tool-swipe',frames,fps=14,loop=False,anchor=[24,38])
frames=[]
for i in range(8):
    frame=Image.new('RGBA',(48,48));d=ImageDraw.Draw(frame)
    if i<7:
        for k in range(3):
            x=20+k*4;y=25+i*2+k%2*3
            d.rectangle((x,y,x+1,y+2),fill='#94c4c3')
    frames.append(frame)
fx.add('water-drops',frames,fps=14,loop=False,anchor=[24,38])
frames=[]
for i in range(8):
    frame=Image.new('RGBA',(48,48));d=ImageDraw.Draw(frame)
    for k in range(3):
        if i<6:
            x=15+k*8;y=30-i*2+k%2*4
            d.rectangle((x,y,x+2,y+2),fill='#a8be82')
    frames.append(frame)
fx.add('recovery',frames,fps=12,loop=False,anchor=[24,38]);fx.save()

wolf_base=Image.open(ART/'wolf.png').convert('RGBA')
wildlife=Atlas('wildlife',(56,40),4)
wildlife.add('wolf-idle',[place(wolf_base,(56,40),(28,35)) for _ in range(4)],fps=2,anchor=[28,35])
frames=[]
for i in range(8):
    base=(key['wolf-stride'] if i in (1,2,5,6) else wolf_base).copy()
    # Alternate extended AI keyposes with tucked paw frames.
    if i in (3,7):
        body=base.crop((0,0,base.width,19)); copy=Image.new('RGBA',base.size)
        copy.alpha_composite(body,(0,1))
        for x in (10,17,30,36):
            ImageDraw.Draw(copy).rectangle((x,18,x+2,23),fill='#303c3e')
        base=copy
    frames.append(place(base,(56,40),(28,35-(1 if i in (1,2,5,6) else 0))))
wildlife.add('wolf-run',frames,fps=11,anchor=[28,35])
frames=[]
for i in range(6):
    image=wolf_base.copy(); tail=image.crop((34,8,44,20)); image.paste(CLEAR,(34,8,44,20))
    image.alpha_composite(tail,(34,8+[0,-1,-2,-1,0,1][i]))
    frames.append(place(image,(56,40),(28,35)))
wildlife.add('wolf-alert',frames,fps=7,anchor=[28,35]);wildlife.save()

# Camp cloth and construction also use discrete sheet frames.
camp=Atlas('camp',(96,64),2)
frames=[]
for i in range(6):
    frame=Image.new('RGBA',(96,64));d=ImageDraw.Draw(frame)
    flutter=[0,1,1,0,-1,-1][i]
    d.polygon([(10,56),(36,15),(67,24),(82,56)],fill='#343f2b')
    d.polygon([(10,54),(36,13),(67,22),(81,54)],fill='#929164')
    d.polygon([(36,13),(67,22),(81,54),(54,54)],fill='#6b764c')
    d.polygon([(36,25),(20,54),(49,54)],fill='#333f2d')
    d.polygon([(36,24),(36+flutter,47),(30+flutter,54),(23,54)],fill='#85895b')
    d.rectangle((34,14,36,55),fill='#b6aa72')
    d.rectangle((8,56,11,59),fill='#b6aa72');d.rectangle((79,56,82,59),fill='#b6aa72')
    frames.append(frame)
camp.add('shelter-idle',frames,fps=3,anchor=[42,56])
construction=[]
for i in range(8):
    frame=Image.new('RGBA',(96,64))
    growth=frames[0].crop((0,13,96,59)).resize((96,max(1,round(46*(i+1)/8))),NEAREST)
    frame.alpha_composite(growth,(0,59-growth.height));construction.append(frame)
camp.add('shelter-build',construction,fps=10,loop=False,anchor=[42,56]);camp.save()
held=Atlas('held',(24,32),1)
frames=[]
for i in range(8):
    frame=Image.new('RGBA',(24,32));d=ImageDraw.Draw(frame)
    d.rectangle((11,14,13,29),fill='#584531');d.rectangle((11,14,11,27),fill='#b19257')
    tip=[3,2,4,1,3,5,2,4][i];bend=[0,1,1,0,-1,-1,0,1][i]
    d.polygon([(9,14),(9,8),(11+bend,tip),(12,8),(15,5),(16,12),(14,17),(11,17)],fill='#ce762d')
    d.polygon([(11,14),(12,8),(14,12),(14,16),(11,16)],fill='#efc575')
    frames.append(frame)
held.add('torch-burn',frames,fps=10,anchor=[12,25]);held.save()

items=list(tools)+['wood','stone','fiber','berries','water','mushroom','bandage','torch','meal','campfire','shelter']
item_sheet=Image.new('RGBA',(16*8,16*2))
for i,name in enumerate(items):
    icon=Image.open(ART/f'item-{name}.png').convert('RGBA')
    item_sheet.alpha_composite(icon,((i%8)*16,(i//8)*16))
item_sheet.save(ART/'item-sprites.png',optimize=True)
manifest={'version':1,'pixelScale':1,'sheets':sheets,'clips':clips}
(OUT/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
(ROOT/'src/game/animation-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
# A small reference GIF is useful when checking the animation pipeline locally.
preview=[]
for i in range(8):
    frame=Image.new('RGBA',(96,64),'#243929')
    clip=clips['axe-right'];w,h=clip['w'],clip['h']
    body=actor_atlas.image.crop((i*w,clip['y'],(i+1)*w,clip['y']+h))
    frame.alpha_composite(body,(24,8))
    hx,hy,degrees=clip['hands'][i]
    held_item=Image.new('RGBA',(48,48))
    held_item.alpha_composite(Image.open(ART/'item-hatchet.png').convert('RGBA'),(16,11))
    held_item=held_item.rotate(-degrees,resample=NEAREST,center=(24,24))
    frame.alpha_composite(held_item,(hx,hy-16))
    ImageDraw.Draw(frame).rectangle((hx+23,hy+7,hx+25,hy+8),fill='#ead4aa')
    preview.append(frame.resize((384,256),NEAREST).convert('RGB'))
cache=ROOT/'.cache';cache.mkdir(exist_ok=True)
preview[0].save(cache/'axe-animation.gif',save_all=True,append_images=preview[1:],duration=83,loop=0)
print(f'Packed {len(clips)} animation clips / {sum(c["frames"] for c in clips.values())} frames into {len(sheets)} sheets.')
