// 도트 UI 그림 생성기 — `npm run assets`
// 색이나 모양을 바꾸려면 이 파일을 고치고 다시 실행한다. 결과는 assets/ 아래 PNG.
// 직접 그린 파일로 바꾸고 싶으면 같은 이름·같은 크기(9분할 기준 칸 수 유지)로 덮어쓰면 된다.
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

// ── PNG 인코더 ──
const CRC = new Int32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c; });
const crc32 = buf => { let c = -1; for (const b of buf) c = CRC[(c ^ b) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0; };
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function png(img) {
  const { w, h, px } = img;
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) { raw[y * (w * 4 + 1)] = 0; px.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4); }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
const written = [];
function save(rel, img) {
  const p = join(ROOT, 'assets', rel);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, png(img));
  written.push(`${rel} (${img.w}×${img.h})`);
}

// ── 그리기 도구 ──
const hex = c => c == null ? null : [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16), c.length > 7 ? parseInt(c.slice(7, 9), 16) : 255];
const mix = (a, b, p) => '#' + [1, 3, 5].map(i => Math.round(parseInt(a.slice(i, i + 2), 16) * (1 - p) + parseInt(b.slice(i, i + 2), 16) * p).toString(16).padStart(2, '0')).join('');
const lighten = (c, p) => mix(c, '#ffffff', p), darken = (c, p) => mix(c, '#000000', p);
function canvas(w, h) {
  const px = Buffer.alloc(w * h * 4);
  return {
    w, h, px,
    set(x, y, c) { if (x < 0 || y < 0 || x >= w || y >= h) return; const v = hex(c); if (!v) return; px[(y * w + x) * 4] = v[0]; px[(y * w + x) * 4 + 1] = v[1]; px[(y * w + x) * 4 + 2] = v[2]; px[(y * w + x) * 4 + 3] = v[3]; },
    rect(x, y, rw, rh, c) { for (let j = 0; j < rh; j++) for (let i = 0; i < rw; i++) this.set(x + i, y + j, c); },
  };
}
function fromGrid(rows, pal) {
  const w = rows[0].length;
  rows.forEach((r, i) => { if (r.length !== w) throw new Error(`격자 줄 길이가 달라요: ${i}번째 줄 "${r}"`); });
  const c = canvas(w, rows.length);
  rows.forEach((r, y) => [...r].forEach((ch, x) => { if (ch !== '.') c.set(x, y, pal[ch]); }));
  return c;
}
const hash = s => { let h = 0; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) | 0; return Math.abs(h); };

// ── 팔레트 ──
const INK = '#2b1a10';
const PAPER = '#fff4d6', PAPER_HI = '#fffcef', PAPER_SH = '#e2c88e';

/**
 * 9분할 틀. ring 배열의 바깥부터 한 겹씩 [위·왼쪽 색, 아래·오른쪽 색] 을 칠하고 안쪽은 fill.
 * 모서리 한 칸은 투명(둥근 모서리). bottomExtra: 아래쪽에 그림자 겹 추가.
 */
function frame({ size = 8, rings, fill, bottomExtra = null }) {
  const h = size + (bottomExtra ? 1 : 0), w = size, c = canvas(w, h);
  c.rect(0, 0, w, h, fill);
  rings.forEach(([tl, br], i) => {
    for (let x = i; x < w - i; x++) { c.set(x, i, tl); c.set(x, h - 1 - i, br); }
    for (let y = i; y < h - i; y++) { c.set(i, y, tl); c.set(w - 1 - i, y, br); }
  });
  if (bottomExtra) for (let x = rings.length; x < w - rings.length; x++) c.set(x, h - 1 - rings.length, bottomExtra);
  // 둥근 모서리: 바깥 모서리 투명, 그 안쪽 대각선은 테두리색
  for (const [x, y, dx, dy] of [[0, 0, 1, 1], [w - 1, 0, -1, 1], [0, h - 1, 1, -1], [w - 1, h - 1, -1, -1]]) {
    c.set(x, y, '#00000000'); c.set(x + dx, y + dy, rings[0][0]);
  }
  return c;
}

// 1) 패널·카드
save('ui/panel.png', frame({ rings: [[INK, INK], [PAPER_HI, PAPER_SH]], fill: PAPER }));
save('ui/panel-yellow.png', frame({ rings: [[INK, INK], ['#fffbe0', '#e6c860']], fill: '#fff1b8' }));
save('ui/panel-white.png', frame({ rings: [[INK, INK], ['#ffffff', '#e4dccb']], fill: '#ffffff' }));
save('ui/panel-gray.png', frame({ rings: [[INK, INK], ['#f4f5f7', '#c9ccd3']], fill: '#e6e8ec' }));
save('ui/panel-dark.png', frame({ rings: [['#120a05', '#120a05'], ['#5a4535', '#241710']], fill: '#3a2a20' }));
// 팝업: 금색 띠를 두른 틀 (slice 4)
save('ui/panel-gold.png', frame({ size: 10, rings: [[INK, INK], ['#ffe08a', '#c9972a'], [INK, INK], [PAPER_HI, PAPER_SH]], fill: PAPER }));

// 2) 버튼: 보통(아래 그림자 두 겹) / 눌림(위쪽이 패인 모양). slice 위·좌·우 2, 아래 3
const BTN = { white: '#fdfaf2', orange: '#e8743b', blue: '#3b7be8', red: '#c8423b' };
for (const [name, base] of Object.entries(BTN)) {
  const hi = lighten(base, .35), sh = darken(base, .28);
  save(`ui/btn-${name}.png`, frame({ rings: [[INK, INK], [hi, sh]], fill: base, bottomExtra: sh }));
  save(`ui/btn-${name}-down.png`, frame({ rings: [[INK, INK], [sh, base]], fill: base, bottomExtra: base }));
}

// 3) 입력창, 탭, 진행 막대
save('ui/input.png', frame({ rings: [[INK, INK], ['#d9cfb8', '#ffffff']], fill: '#ffffff' }));
save('ui/tab.png', frame({ rings: [[INK, INK], ['#f6e6bb', '#c9ad6d']], fill: '#ead29a' }));
save('ui/tab-on.png', frame({ rings: [[INK, INK], [PAPER_HI, PAPER]], fill: PAPER }));
save('ui/bar.png', frame({ size: 6, rings: [[INK, INK], ['#d9cfb8', '#ffffff']], fill: '#ffffff' }));
save('ui/bar-fill.png', fromGrid([
  'hhhh',
  'gGgG',
  'GgGg',
  'ssss',
], { h: '#8fe08f', g: '#3a9a4a', G: '#46ad56', s: '#2a6e36' }));

// 4) 말풍선 꼬리, 슬라이더 손잡이
save('ui/bubble-tail.png', fromGrid([
  'KWWWWWK',
  '.KWWWK.',
  '..KWK..',
  '...K...',
], { K: INK, W: '#ffffff' }));
save('ui/thumb.png', fromGrid([
  '.KKKKK.',
  'KhhhhoK',
  'KhoooOK',
  'KhoooOK',
  'KhoooOK',
  'KhoooOK',
  'KhoooOK',
  'KoOOOOK',
  'KOOOOOK',
  '.KKKKK.',
], { K: INK, h: '#f7a46f', o: '#e8743b', O: '#a94a1a' }));

// 5) 아이콘
save('ui/crown.png', fromGrid([
  '.K....K....K.',
  'KYK..KYK..KYK',
  'KYYK.KYK.KYYK',
  'KYWYKYYYKYYyK',
  'KYYYYYRYYYYyK',
  'KYRYYYYYYYRyK',
  'KyyyyyyyyyyyK',
  '.KKKKKKKKKKK.',
], { K: INK, Y: '#f4c542', y: '#c9972a', W: '#fff6c8', R: '#e04848' }));
save('ui/star.png', fromGrid([
  '....K....',
  '...KYK...',
  '...KYK...',
  'KKKKWYKKK',
  'KYYYYYYyK',
  '.KYYYYyK.',
  '..KYYYK..',
  '.KYyKyyK.',
  '.KyK.KyK.',
  '.KK...KK.',
], { K: INK, Y: '#f4c542', y: '#c9972a', W: '#fff6c8' }));
save('ui/books.png', fromGrid([
  '.KKKKKKKKKK.',
  'KWWKrRRRRRRK',
  'KwwKrRRYRRRK',
  'KKKKKKKKKKKK',
  '.KWWKbBBBYBK',
  '.KwwKbBBBYBK',
  '.KKKKKKKKKKK',
], { K: INK, W: '#fffaf0', w: '#e0d3b0', r: '#f08a87', R: '#d9534f', b: '#8fa0ea', B: '#5a6fd6', Y: '#f4c542' }));

// 6) 배경: 구름, 땅, 도시
save('bg/cloud.png', fromGrid([
  '........KKKKK...........',
  '.......KWWWWWK...KKKK...',
  '...KKKKWWWWWWWK.KWWWWK..',
  '..KWWWWWWWWWWWWKWWWWWWK.',
  '.KWWWWWWWWWWWWWWWWWWWWWK',
  'KWWWWWWWWWWWWWWWWWWWWBWK',
  'KWWWWWWWWWWWWWWWWWWBBBBK',
  '.KBBBBWWWWWWWWBBBBBBBBK.',
  '..KKKKKKKKKKKKKKKKKKKKK.',
], { K: '#9fb8d8', W: '#ffffff', B: '#dbe9f7' }));

{
  const c = canvas(16, 14);
  for (let x = 0; x < 16; x++) {
    const tuft = hash('t' + x) % 3 === 0;
    c.set(x, 0, tuft ? '#a6e07c' : '#00000000');
    c.set(x, 1, '#8fd16a');
    for (let y = 2; y < 5; y++) c.set(x, y, (x + y) % 5 === 0 ? '#4f9c34' : '#5fae3e');
    c.set(x, 5, '#3f8a2a');
    if (hash('d' + x) % 2) c.set(x, 6, '#3f8a2a');
    for (let y = 6; y < 14; y++) if (!(y === 6 && hash('d' + x) % 2)) {
      const r = hash(`${x},${y}`) % 13;
      c.set(x, y, r === 0 ? '#6e4526' : r === 1 ? '#a87447' : '#8a5a32');
    }
  }
  save('bg/ground.png', c);
}

// 도시 배경(bg/city.png)과 땅 위 장식은 tools/make-city.py가 Kenney 타일로 만든다

// 7) 책 스프라이트 8색 × 장식 3종 (명세 7장). 6줄: 위 테두리 2 / 반복되는 가운데 2 / 아래 테두리 2
//    9분할: 위 2, 오른쪽 2, 아래 2, 왼쪽 6 (종이 단면은 늘어나지 않음)
const COVERS = ['#d9534f', '#f0a030', '#e8d44d', '#5cb85c', '#3fa7d6', '#5a6fd6', '#9b59b6', '#e57fb0'];
const BANDS = [[0.25, 0.75], [0.2, 0.5, 0.8], [0.42, 0.58]];
const BW = 48;
COVERS.forEach((base, ci) => {
  const hi = lighten(base, .3), sh = darken(base, .3);
  const yellowish = ci === 2;
  const band = yellowish ? '#a0702a' : '#f4d35e', bandSh = yellowish ? '#6e4a18' : '#c99a2e', bandHi = yellowish ? '#c08a3a' : '#fff0a8';
  BANDS.forEach((bands, vi) => {
    const c = canvas(BW, 6);
    for (let x = 1; x < BW - 1; x++) { c.set(x, 0, INK); c.set(x, 5, INK); }
    for (let y = 1; y < 5; y++) { c.set(0, y, INK); c.set(BW - 1, y, INK); }
    // 종이 단면 (x 1~4)
    const paperRows = ['#fffaf0', '#f6efd9', '#e0d3b0', '#d8cba5'];
    for (let y = 1; y < 5; y++) { for (let x = 1; x < 4; x++) c.set(x, y, paperRows[y - 1]); c.set(4, y, '#b9aa80'); }
    // 표지 (x 5~)
    for (let y = 1; y < 5; y++) for (let x = 5; x < BW - 1; x++) {
      let col = base;
      if (x === 5) col = sh;                        // 책등 선
      else if (y === 1 || x === 6) col = hi;        // 위·왼쪽 밝은 면
      else if (y === 4 || x === BW - 2) col = sh;   // 아래·오른쪽 그림자
      c.set(x, y, col);
    }
    for (const f of bands) {
      const bx = Math.round(7 + (BW - 9) * f);
      for (let y = 1; y < 5; y++) { c.set(bx, y, y === 1 ? bandHi : y === 4 ? bandSh : band); c.set(bx + 1, y, bandSh); }
    }
    save(`books/book_${ci}_${vi}.png`, c);
  });
});

console.log(written.join('\n'));
