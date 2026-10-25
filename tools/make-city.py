"""배경 거리와 땅 위 장식 생성기 — `python3 tools/make-city.py`

Kenney "Roguelike Modern City" (CC0, www.kenney.nl) 타일을 조립해
assets/bg/city.png (가로로 반복되는 거리)와 assets/props/*.png (나무, 가로등 등)를 만든다.
필요한 타일만 tools/kenney-city/ 에 들어 있다. Pillow 필요 (pip install pillow).
"""
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
TILES = ROOT / 'tools' / 'kenney-city'
OUT = ROOT / 'assets'
TS = 16

_cache = {}
def tile(i):
    if i not in _cache:
        _cache[i] = Image.open(TILES / f'tile_{i:04d}.png').convert('RGBA')
    return _cache[i]

def grid(rows):
    """타일 번호 격자 → 이미지. 칸에 튜플을 주면 차례로 겹쳐 그린다. None은 빈 칸."""
    h, w = len(rows), max(len(r) for r in rows)
    im = Image.new('RGBA', (w * TS, h * TS), (0, 0, 0, 0))
    for y, r in enumerate(rows):
        for x, cell in enumerate(r):
            for j in (cell if isinstance(cell, tuple) else (cell,)):
                if j is not None:
                    im.alpha_composite(tile(j), (x * TS, y * TS))
    return im

# ── 재료 ──
# 벽: (민벽, 층 사이 선반, 맨 아래 받침)
WALLS = {'red': (187, 224, 298), 'gray': (191, 228, 302), 'beige': (195, 232, 306)}
# 지붕 색 (위 밝은 선, 몸통, 아래 그림자) — 같은 색 계열의 Kenney 지붕 타일에서 뽑음
ROOF = {'red': ('#c98a7d', '#a65f53', '#7d4038'), 'gray': ('#9a9da3', '#7b7e85', '#585b61'),
        'beige': ('#e3d3ad', '#c9b48a', '#9c8862'), 'glass': ('#b6bcc4', '#959ca6', '#6f7680')}
WINDOWS = [580, 617, 691, 728, 581, 618]
DOOR_WOOD, DOOR_GLASS = 1019, 837
AWNING = {'green': ([393, 394, 395, 396], [430, 431, 432, 433]), 'orange': ([397, 398, 399, 400], [434, 435, 436, 437])}
SHOP_WIN = 946
ROOF_STUFF = [545, 546, 543]   # 실외기·환기구

def span(row4, w):
    """왼쪽·가운데·오른쪽 조각으로 w칸 줄 만들기"""
    l, m1, m2, r = row4
    mids = [m1 if k % 2 == 0 else m2 for k in range(max(0, w - 2))]
    return [l] + mids + [r] if w >= 2 else [m1]

def roof(w_px, color, stuff=None, rows=2):
    hi, base, sh = ROOF[color]
    im = Image.new('RGBA', (w_px, rows * TS), base)
    px = im.load()
    for x in range(w_px):
        px[x, 0] = Image.new('RGB', (1, 1), hi).getpixel((0, 0)) + (255,)
        for y in range(rows * TS - 2, rows * TS):
            px[x, y] = Image.new('RGB', (1, 1), sh).getpixel((0, 0)) + (255,)
    if stuff is not None:
        im.alpha_composite(tile(stuff), (TS // 2 + (w_px // 3), rows * TS - TS - 2))
    return im

def outline_sides(im):
    """건물 양옆에 진한 세로선 (이웃 건물과 구분)"""
    px = im.load()
    for y in range(im.height):
        for x in (0, im.width - 1):
            if px[x, y][3]:
                r, g, b, a = px[x, y]
                px[x, y] = (int(r * .6), int(g * .6), int(b * .6), a)
    return im

def brick(material, w, floors, window, ground='door', awning=None, stuff=None, seed=0):
    wall, ledge, base = WALLS[material]
    rows = []
    for f in range(floors):
        win = WINDOWS[(seed + f) % len(WINDOWS)] if window is None else window
        rows.append([(wall, win) if x % 2 == (1 if w % 2 else 0) or w <= 3 else wall for x in range(w)])
        rows.append([ledge] * w)
    if awning:
        top, bot = AWNING[awning]                                    # 1층 가게: 차양 2줄 + 진열창·유리문
        rows.append([(wall, t) for t in span(top, w)])
        rows.append([(wall, t) for t in span(bot, w)])
        rows.append([(base, DOOR_GLASS) if x == w // 2 else (base, SHOP_WIN) for x in range(w)])
    else:
        rows.append([(base, DOOR_WOOD) if x == w // 2 else (base, WINDOWS[seed % 2]) if x % 2 else base for x in range(w)])
    body = grid(rows)
    r = roof(body.width, material, stuff)
    im = Image.new('RGBA', (body.width, body.height + r.height), (0, 0, 0, 0))
    im.alpha_composite(r, (0, 0)); im.alpha_composite(body, (0, r.height))
    return outline_sides(im)

def glass(w, h, stuff=None, wide=True):
    cols = [234, 235, 236, 237] if wide else [238, 239, 239, 240]
    mid = [271, 272, 273, 274] if wide else [275, 276, 276, 277]
    bot = [456, 457, 458, 459] if wide else [460, 461, 461, 462]
    rows = [span(cols, w)] + [span(mid, w) for _ in range(h - 2)] + [span(bot, w)]
    body = grid(rows)
    r = roof(body.width, 'glass', stuff, rows=1)
    im = Image.new('RGBA', (body.width, body.height + r.height), (0, 0, 0, 0))
    im.alpha_composite(r, (0, 0)); im.alpha_composite(body, (0, r.height))
    return outline_sides(im)

def street():
    """가로로 이어 붙여도 이음새가 없는 거리 한 장"""
    parts = [
        brick('red', 4, 3, None, stuff=545, seed=0),
        glass(4, 9, stuff=546),
        None,
        brick('beige', 5, 2, None, awning='green', stuff=543, seed=2),
        brick('gray', 3, 4, 691, stuff=545, seed=1),
        None,
        brick('red', 5, 1, None, awning='orange', seed=3),
        glass(3, 6, wide=False),
        brick('beige', 3, 3, 617, stuff=546, seed=4),
        None,
    ]
    gap = TS
    W = sum(p.width if p else gap for p in parts)
    H = max(p.height for p in parts if p)
    im = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    x = 0
    for p in parts:
        if p is None: x += gap; continue
        im.alpha_composite(p, (x, H - p.height)); x += p.width
    return im

PROPS = {
    'tree_green': [[401], [438], [475]],
    'tree_orange': [[402], [439], [476]],
    'tree_dark': [[403], [440], [477]],
    'lamp': [[597], [634], [671]],
    'hydrant': [[533]],
    'mailbox': [[604], [641]],
    'trash': [[496]],
}

def trim(im):
    box = im.getbbox()
    return im.crop(box) if box else im

if __name__ == '__main__':
    (OUT / 'bg').mkdir(parents=True, exist_ok=True)
    (OUT / 'props').mkdir(parents=True, exist_ok=True)
    s = street(); s.save(OUT / 'bg' / 'city.png'); print('bg/city.png', s.size)
    for name, rows in PROPS.items():
        p = trim(grid(rows)); p.save(OUT / 'props' / f'{name}.png'); print(f'props/{name}.png', p.size)
