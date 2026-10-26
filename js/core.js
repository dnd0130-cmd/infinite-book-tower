// 무한의 책탑 — 핵심 계산 (명세서 6장)
// DOM이나 스타일을 건드리지 않는 순수 함수만 둔다. 화면은 이 결과를 받아서 그린다.
import { getLandmarks } from './landmarks.js';

export const ZMIN = 0.4, ZMAX = 60, GROUND = 40;
export const TICK_STEPS = [0.5, 1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000];
export const OUTLINE_RGB = [43, 26, 16];
export const SIL_OFFSET_RATIO = 0.7;   // 실루엣을 책탑 폭의 몇 배만큼 오른쪽으로 치우칠지
export const SIL_COLOR = '#5a6aa8';
export const SIL_GOLD = '#f4c542';
export const SIL_FAR = '#9aa0ad';

export const sliderToZoom = v => ZMIN * Math.pow(ZMAX / ZMIN, v / 100);
export const zoomToSlider = z => Math.round(Math.log(z / ZMIN) / Math.log(ZMAX / ZMIN) * 100);
export const clampZoom = z => Math.min(ZMAX, Math.max(ZMIN, z));
export const hash = s => { let h = 0; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) | 0; return Math.abs(h); };

// 쌓는 순서: 등록 시각 오름차순. 시각이 같으면 id로 정해 순서가 흔들리지 않게 한다.
export const sortBooks = books => books.slice().sort((a, b) =>
  a.created_at.localeCompare(b.created_at) || String(a.id).localeCompare(String(b.id)));

export const heightM = (pages, cmPerPage) => pages * cmPerPage / 100;

// 넘은 랜드마크 수 = 다음 랜드마크의 인덱스 (LANDMARKS가 높이 오름차순이므로)
export function landmarkState(totalM) {
  const L = getLandmarks();
  const reachedCount = L.filter(l => totalM >= l.m).length;
  const next = L[reachedCount] || null;
  return { reachedCount, next, allDone: reachedCount === L.length };
}

/**
 * books: [{id, student_id, title, pages, created_at}]  (이미 mode에 맞게 걸러진 목록)
 * mode : 'class' | 'me'   (목표선은 'class'에서만)
 */
export function computeLayout({ books, cmPerPage, goalM, mode, zoom, viewH }) {
  const L = getLandmarks();
  const list = sortBooks(books);
  const pages = list.reduce((s, b) => s + b.pages, 0);
  const totalM = heightM(pages, cmPerPage);
  const { reachedCount, next, allDone } = landmarkState(totalM);

  const goal = mode === 'class' ? (goalM || 0) : 0;
  let fitM = Math.max(totalM * 1.15, next ? next.m * 1.08 : totalM * 1.2, 4);
  if (goal > 0 && goal <= fitM * 3) fitM = Math.max(fitM, goal * 1.08);
  const maxM = Math.max(fitM, goal * 1.08);

  let ppm = (viewH - 90) / fitM * zoom;
  ppm = Math.min(ppm, 40000 / maxM);
  const H = Math.max(Math.round(maxM * ppm + 90), viewH);
  const groundY = H - GROUND;
  const topM = groundY / ppm;                       // 화면 맨 위가 나타내는 높이(m)
  const Y = m => groundY - m * ppm;                 // 높이(m) → 위에서부터의 픽셀

  const step = TICK_STEPS.find(s => s * ppm >= 38) || 10000;
  const ticks = [];
  for (let i = 0; i * step <= topM; i++) ticks.push({ m: i * step, y: Y(i * step) });

  // 화면에 그릴 랜드마크는 하나뿐: 다음 것 (모두 넘었으면 마지막 것을 금색으로)
  const shown = next || L[L.length - 1];
  const landmark = {
    id: shown.id, name: shown.name, m: shown.m, desc: shown.desc,
    heightPx: shown.m * ppm,
    topY: Y(shown.m),
    remainingM: next ? next.m - totalM : 0,
    gold: allDone,
  };

  const placed = list.map(b => {
    const hs = hash(b.id);
    return {
      id: b.id, title: b.title, pages: b.pages, studentId: b.student_id,
      heightPx: Math.max(2, heightM(b.pages, cmPerPage) * ppm),
      widthUnits: 48 + hs % 14,                     // 도트 칸 수 (칸 크기는 디자인에서 결정)
      offsetUnits: (hash(b.id + 'x') % 5) - 2,      // 좌우 어긋남(칸 단위)
      variant: hs % 3,                              // 장식 변형 번호
    };
  });

  return {
    pages, totalM, reachedCount, allDone, next, landmark, goalM: goal,
    ppm, H, topM, GROUND, groundY, ticks,
    goalY: goal > 0 && goal <= topM ? Y(goal) : null,
    topY: Y(totalM),                                // 현재 높이선 위치
    books: placed,
    view: { H, ppm, GROUND },                       // 확대 시 중심 유지 계산용
  };
}

// 실루엣을 놓을 위치 (4.6)
export function silhouetteBox(sil, heightPx, towerCenterX, towerWidthPx, groundY) {
  const cell = heightPx / sil.h;
  const cx = towerCenterX + towerWidthPx * SIL_OFFSET_RATIO;
  return {
    cell,
    left: cx - (sil.w + 2) * cell / 2,
    top: groundY - (sil.h + 1) * cell,
    width: (sil.w + 2) * cell,
    height: (sil.h + 2) * cell,
  };
}

// 글자 격자 → RGBA 픽셀 ((w+2)×(h+2), 테두리 한 칸 포함)
export const hexToRgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
export const mixRgb = (a, b, p) => a.map((v, i) => Math.round(v + (b[i] - v) * p));
export function silhouettePixels(sil, { color = SIL_COLOR, outline = true } = {}) {
  const { w, h, rows } = sil, W = w + 2, Hh = h + 2;
  const data = new Uint8ClampedArray(W * Hh * 4);
  const on = (x, y) => x >= 0 && x < w && y >= 0 && y < h && rows[y][x] !== '.';
  const put = (x, y, c) => { const i = ((y + 1) * W + (x + 1)) * 4; data[i] = c[0]; data[i + 1] = c[1]; data[i + 2] = c[2]; data[i + 3] = 255; };
  const base = hexToRgb(color), light = mixRgb(base, [255, 255, 255], .35), dark = mixRgb(base, [0, 0, 0], .35);
  if (outline) {
    for (let y = -1; y <= h; y++) for (let x = -1; x <= w; x++) {
      if (!on(x, y) && (on(x + 1, y) || on(x - 1, y) || on(x, y + 1) || on(x, y - 1))) put(x, y, OUTLINE_RGB);
    }
  }
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const ch = rows[y][x]; if (ch === '.') continue;
    let c = base;
    if (ch === 'o') c = light;
    else if (ch === 'x') c = dark;
    else if (!on(x + 1, y)) c = dark;
    else if (!on(x - 1, y) || !on(x, y - 1)) c = light;
    put(x, y, c);
  }
  return { w: W, h: Hh, data };   // canvas: ctx.putImageData(new ImageData(data, w, h), 0, 0)
}

// 돌파 판정: seenCount = 이전에 본 '넘은 개수' (없으면 null)
export function newlyReached(seenCount, reachedCount) {
  if (seenCount == null || reachedCount <= seenCount) return [];
  return getLandmarks().slice(seenCount, reachedCount);
}
export const seenKey = (code, number, mode) => `bt_seen_${code}_${number}_${mode}`;

// 확대/축소 시 화면 중심 유지
export function focusMBefore(view, scrollTop, clientHeight) {
  return (view.H - view.GROUND - (scrollTop + clientHeight / 2)) / view.ppm;
}
export function scrollTopAfter(view, focusM, clientHeight) {
  return view.H - view.GROUND - focusM * view.ppm - clientHeight / 2;
}

// 학생별 통계, 다독왕
export function statsByStudent(students, books) {
  const m = new Map(students.map(s => [s.id, { s, pages: 0, count: 0, last: null }]));
  for (const b of books) {
    const r = m.get(b.student_id); if (!r) continue;
    r.pages += b.pages; r.count++;
    if (!r.last || b.created_at > r.last) r.last = b.created_at;
  }
  return [...m.values()];
}
export function leader(students, books) {
  const arr = statsByStudent(students, books).filter(r => r.pages > 0 && !r.s.left);   // 전학 간 학생은 후보에서 뺀다
  if (!arr.length) return null;
  const mx = Math.max(...arr.map(r => r.pages));
  return { names: arr.filter(r => r.pages === mx).map(r => r.s.name), pages: mx };
}

// 이상 기록 판별 (교사 점검 화면)
export const suspicious = b => b.pages >= 800 || b.title.trim().length < 2 || /^(.)\1+$/u.test(b.title.trim());

// ── 학번 ──
// 반에 학년·반이 정해져 있으면 학생 번호는 학번이다: 학년 + 반 + 두 자리 번호 (4학년 2반 1번 → 4201, 6학년 12반 3번 → 61203).
export const usesHakbun = cls => !!(cls && cls.grade && cls.room);
export const hakbun = (grade, room, seat) => Number(`${grade}${room}${String(seat).padStart(2, '0')}`);
export const hakbunBase = cls => usesHakbun(cls) ? hakbun(cls.grade, cls.room, 0) : 0;
// 학번에서 출석번호(1~99)만 뽑는다. 학번 방식이 아니거나 이 반 학번이 아니면 그대로
export function seatOf(number, cls) {
  const base = hakbunBase(cls);
  return base && number > base && number <= base + 99 ? number - base : number;
}
export const numberLabel = (number, cls) => `${seatOf(number, cls)}번`;
// 학생이 입력한 값 → 이 반의 학번. 학번 방식 반에서 1~99를 쓰면 출석번호로 보고 학번으로 바꿔 준다 (둘 다 허용)
export function resolveNumber(input, cls) {
  const n = Number(input), base = hakbunBase(cls);
  return base && n >= 1 && n <= 99 ? base + n : n;
}

/**
 * 학생 일괄 등록 글 해석. 한 줄에 한 명: "이름" 또는 "번호 이름" (예: "3 박서연", "3. 박서연").
 *  - base가 0이면 번호 그대로 (1~99999). base가 있으면(학번 방식, hakbunBase(cls)) 쓴 번호가 1~99면 출석번호로 보고
 *    base를 더하고, base 범위의 학번(예: 4203)이면 그대로 쓴다.
 *  - 번호가 없는 줄은 '이미 있는 번호 중 가장 큰 것'+1부터 차례로 붙인다. 이번에 직접 쓴 번호는 건너뛴다.
 *    이미 있는 번호들 사이의 빈 번호는 메우지 않는다 (전학 간 학생의 번호를 새 학생이 물려받지 않게).
 *  - 이미 있는 번호, 같은 번호 중복, 범위 밖의 번호는 오류.
 * 반환: { entries: [{ number, name }] } 또는 { error }
 */
export function parseStudentLines(text, existingNumbers = [], base = 0) {
  const taken = new Set(existingNumbers);
  const rows = [];
  for (const raw of String(text ?? '').split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    const m = line.match(/^(\d{1,6})(?:\s*[.)\]:,-]\s*|\s+)(\S.*)$/u);
    rows.push(m ? { number: Number(m[1]), name: m[2].trim().slice(0, 30) } : { number: null, name: line.slice(0, 30) });
  }
  if (!rows.length) return { error: '이름을 한 줄에 한 명씩 적어 주세요' };
  const max = base ? base + 99 : 99999;
  const used = new Set();
  for (const r of rows) {
    if (r.number == null) continue;
    if (base && r.number >= 1 && r.number <= 99) r.number += base;                       // 출석번호 → 학번
    if (r.number < (base ? base + 1 : 1) || r.number > max) {
      return { error: base ? `${r.number}은(는) 이 반의 번호가 아니에요 (번호 1~99 또는 ${base + 1}~${base + 99})` : `번호는 1~99999 사이로 적어 주세요 (${r.number})` };
    }
    if (taken.has(r.number)) return { error: `${r.number}번은 이미 있어요 (${r.name})` };
    if (used.has(r.number)) return { error: `${r.number}번이 두 번 적혀 있어요` };
    used.add(r.number);
  }
  let next = Math.max(base, ...[...taken].filter(n => !base || (n > base && n <= base + 99))) + 1;
  for (const r of rows) if (r.number == null) {
    while (used.has(next)) next++;
    if (next > max) return { error: base ? '번호가 99를 넘어요' : '번호가 너무 커요' };
    r.number = next++;
  }
  return { entries: rows };
}

// ── 반 코드 (선생님이 정한다) ──
// 6~12자, 영문 대문자+숫자, 글자와 숫자를 모두 포함. 쉬운 코드는 남이 알아맞히기 쉬우므로 모두 같은 글자나 흔한 나열은 막는다.
const WEAK_CODES = new Set(['ABC123', '123ABC', 'ABCD12', 'ABCD1234', 'ABC1234', 'A12345', 'A123456', 'QWER12', 'QWER1234', 'QWERT1', 'ASDF12', 'ASDF1234',
  'TEST12', 'TEST123', 'TEST1234', 'CLASS1', 'CLASS12', 'CLASS123', 'SCHOOL1', 'SCHOOL12', 'SCHOOL123', 'PASS12', 'PASS123', 'PASS1234']);
export const normalizeCode = s => String(s ?? '').trim().toUpperCase();
export function validateClassCode(raw) {
  const c = normalizeCode(raw);
  if (c.length < 6 || c.length > 12) return '반 코드는 6~12자로 정해 주세요';
  if (!/^[A-Z0-9]+$/.test(c)) return '반 코드는 영문 대문자와 숫자만 쓸 수 있어요';
  if (!/[A-Z]/.test(c) || !/[0-9]/.test(c)) return '반 코드에 영문 글자와 숫자를 모두 넣어 주세요 (예: MUMU42)';
  if (/(.)\1{4,}/.test(c) || WEAK_CODES.has(c)) return '너무 쉬운 코드예요. 다른 사람이 알아맞히기 어렵게 정해 주세요';
  return null;
}

// 반 코드: 영문 대문자+숫자 6자, 헷갈리는 글자(I O 0 1) 제외
export const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const genCode = (rand = Math.random) =>
  Array.from({ length: 6 }, () => CODE_ALPHABET[Math.floor(rand() * CODE_ALPHABET.length)]).join('');

// 책 표지색: (학생 번호 − 1) % 팔레트 길이
export const coverIndex = (number, paletteLen = 8) => (((number - 1) % paletteLen) + paletteLen) % paletteLen;

/**
 * CSV 만들기 (엑셀에서 한글이 안 깨지도록 맨 앞에 BOM, 줄바꿈은 CRLF).
 * 셀이 = + - @ 로 시작하면 엑셀이 수식으로 읽지 않도록 앞에 ' 를 붙인다.
 */
export function toCsv(rows) {
  const cell = v => {
    let s = v == null ? '' : String(v);
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
    return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  return '\uFEFF' + rows.map(r => r.map(cell).join(',')).join('\r\n') + '\r\n';
}

/**
 * 반 목표 달성 축하 판정. prev = 이전에 저장한 값(없으면 null, 0=아직, 1=달성), reached = 지금 달성했는가.
 * 첫 방문(prev=null)이거나 이미 달성한 뒤에는 팝업을 띄우지 않고, '아직 → 달성'으로 바뀔 때만 띄운다.
 * 반환: { popup, store } (store는 새로 저장할 값)
 */
export function goalCheck(prev, reached) {
  const store = reached ? 1 : 0;
  return { popup: prev === 0 && reached, store };
}

// 받침에 맞는 조사: josa('박서연', '이', '가') → '이', josa('하루', '이', '가') → '가'. 한글이 아니면 받침 없는 쪽을 쓴다
export function josa(word, withBatchim, without) {
  const c = String(word ?? '').trim().slice(-1).charCodeAt(0);
  return c >= 0xAC00 && c <= 0xD7A3 && (c - 0xAC00) % 28 !== 0 ? withBatchim : without;
}

// 이 쪽수 이상이면 쌓기 전에 "정말 맞나요?" 하고 한 번 되묻는다 (10쪽을 1000쪽으로 쓰는 실수 방지)
export const CONFIRM_PAGES = 500;
export const needsPageConfirm = pages => pages >= CONFIRM_PAGES;

// 입력 검증 (8장). 통과하면 다듬은 값, 아니면 { error }
export function validateBook({ title, pages, note }) {
  const t = String(title ?? '').trim();
  const n = String(note ?? '').trim();
  const p = Number(pages);
  if (!t) return { error: '책 제목을 적어 주세요' };
  if (t.length > 100) return { error: '책 제목은 100자까지 적을 수 있어요' };
  if (!Number.isInteger(p) || p < 1 || p > 3000) return { error: '쪽수는 1~3000 사이로 적어 주세요' };
  if (!n) return { error: '한 줄 느낌을 적어 주세요' };
  if (n.length > 200) return { error: '한 줄 느낌은 200자까지 적을 수 있어요' };
  return { title: t, pages: p, note: n };
}

// 화면에 넣기 전 HTML 이스케이프
export const escapeHtml = s => String(s ?? '').replace(/[&<>"']/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
