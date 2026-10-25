// 책탑 뷰 (명세서 3장)
// 스크롤 컨테이너는 한 번만 만들고 안쪽 내용만 갈아끼운다 (터치 핀치 유지를 위해).
import {
  computeLayout, focusMBefore, scrollTopAfter, clampZoom, sliderToZoom, zoomToSlider, hash,
  coverIndex, heightM, SIL_OFFSET_RATIO, SIL_GOLD, ZMIN, ZMAX,
} from './core.js';
import { getLandmarks } from './landmarks.js';
import { ASSETS, COVER_COLORS, U, icon } from './assets.js';
import { silhouetteImage, placeSilhouette } from './sil-render.js';
import { esc, fmtM, fmtN, landmarkCard } from './ui.js';

const RULER_W = 52;
const TOWER_UNITS = 55;          // 책탑 대표 폭(칸). 실루엣 위치 계산용

// 임시 도시 실루엣 타일 (ASSETS.city가 없을 때)
let cityUrl;
export function cityTileUrl() {
  if (ASSETS.city) return ASSETS.city;
  if (cityUrl) return cityUrl;
  const c = document.createElement('canvas'); c.width = 120; c.height = 60;
  const ctx = c.getContext('2d');
  let x = 0, i = 0;
  while (x < 120) {
    const w = 6 + hash('w' + i) % 12, hgt = 14 + hash('h' + i) % 40;
    ctx.fillStyle = '#4a5a8a'; ctx.fillRect(x, 60 - hgt, w - 1, hgt);
    ctx.fillStyle = '#8fa4d8';
    for (let wy = 60 - hgt + 3; wy < 57; wy += 5) for (let wx = x + 2; wx < x + w - 3; wx += 3) if (hash(`${wx},${wy}`) % 3) ctx.fillRect(wx, wy, 1, 2);
    x += w; i++;
  }
  return (cityUrl = c.toDataURL());
}

function skyBackground(H) {
  if (ASSETS.sky) return `url(${ASSETS.sky}) repeat-y center/100% auto`;
  // 아래(연한 하늘색) → 위(진한 하늘색) 계단식 띠
  const N = 10, lo = [205, 238, 252], hi = [63, 127, 201], stops = [];
  for (let k = 0; k < N; k++) {
    const p = k / (N - 1), c = lo.map((v, j) => Math.round(v + (hi[j] - v) * p));
    const a = (1 - (k + 1) / N) * 100, b = (1 - k / N) * 100;
    stops.push(`rgb(${c}) ${a}% ${b}%`);
  }
  return `linear-gradient(to bottom, ${stops.reverse().join(',')})`;
}

function bookStyle(color, variant, hPx, sprite) {
  if (hPx < 5) return { cls: 'thin', bg: `background:${color}` };
  if (sprite) {
    const s = ASSETS.bookSlice;
    // 9분할: 종이 단면(왼쪽)은 그대로, 가운데는 가로로 늘이고 세로로는 반복
    return { cls: 'spr', bg: `border-style:solid;border-width:${s.top * U}px ${s.right * U}px ${s.bottom * U}px ${s.left * U}px;`
      + `border-image:url(${sprite}) ${s.top} ${s.right} ${s.bottom} ${s.left} fill / ${s.top * U}px ${s.right * U}px ${s.bottom * U}px ${s.left * U}px stretch;`
      + `border-image-repeat:stretch round` };
  }
  // 임시: 왼쪽 종이 단면 + 세로 금색 띠
  const p = U * 4;
  const bands = [[30, 70], [20, 50, 80], [40, 60]][variant];
  const gold = bands.map(b => `transparent calc(${b}% - 2px), #e8c45a calc(${b}% - 2px) calc(${b}% + 2px), transparent calc(${b}% + 2px)`).join(',');
  return {
    cls: 'ph',
    bg: `background:linear-gradient(90deg,#f6efd9 0 ${p}px,#cdbf98 ${p}px ${p + 1}px,transparent ${p + 1}px),linear-gradient(90deg,${gold}),${color}`,
  };
}

/**
 * root: 빈 div. 반환 객체의 update(data, { reset })로 그린다.
 * data = { books, cmPerPage, goalM, mode, numberOf(studentId), leader: {names, pages}|null }
 */
export function createTower(root) {
  root.classList.add('tower');
  root.innerHTML = `
    <div class="tw-view">
      <div class="scroller"><div class="content"></div></div>
      <div class="tw-hud"><div class="tw-chip"></div><div class="tw-leader hidden"></div></div>
    </div>
    <div class="tw-zoom">
      <span class="small muted" style="margin-right:auto">확대</span>
      <button class="btn small" data-z="out" title="축소">－</button>
      <input type="range" min="0" max="100" step="1" aria-label="확대">
      <button class="btn small" data-z="in" title="확대">＋</button>
      <button class="btn small" data-z="all">전체</button>
    </div>`;
  const scroller = root.querySelector('.scroller');
  const content = root.querySelector('.content');
  const chip = root.querySelector('.tw-chip');
  const leaderEl = root.querySelector('.tw-leader');
  const slider = root.querySelector('input[type=range]');

  let zoom = 1, data = null, layout = null, override = null, raf = 0, pendingReset = false;

  function draw({ reset = false } = {}) {
    if (!data) return;
    const viewH = scroller.clientHeight, width = scroller.clientWidth;
    if (!viewH || !width) return;
    const focus = layout && !reset ? focusMBefore(layout.view, scroller.scrollTop, viewH) : null;

    layout = computeLayout({ books: data.books, cmPerPage: data.cmPerPage, goalM: data.goalM, mode: data.mode, zoom, viewH });
    const L = layout, Y = m => L.groundY - m * L.ppm;
    const cx = RULER_W + (width - RULER_W) * 0.38;
    const towerW = TOWER_UNITS * U;
    const parts = [];

    // 1. 배경
    parts.push(`<div class="tw-sky" style="background:${skyBackground(L.H)}"></div>`);
    const cloudGap = 320, nClouds = Math.min(150, Math.floor((L.H - 200) / cloudGap));
    for (let i = 0; i < nClouds; i++) {
      const y = L.groundY - 200 - i * cloudGap - hash('cy' + i) % 120;
      const x = RULER_W + hash('cx' + i) % Math.max(1, width - RULER_W - 80);
      const cls = ASSETS.cloud ? '' : ' ph';
      const bg = ASSETS.cloud ? `background:url(${ASSETS.cloud}) center/100% 100%;` : '';
      // 구름은 높이마다 크기를 조금씩 다르게 (1~2배)
      parts.push(`<div class="tw-cloud${cls}" style="left:${x}px;top:${y}px;${bg}${hash('cs' + i) % 2 ? `width:${48 * U}px;height:${18 * U}px;` : ''}"></div>`);
    }
    parts.push(`<div class="tw-city" style="bottom:40px;background:url(${cityTileUrl()}) repeat-x bottom left/${120 * U}px ${60 * U}px"></div>`);

    // 2. 눈금
    parts.push(`<div class="tw-ruler"></div>`);
    for (const t of L.ticks) {
      parts.push(`<div class="tw-tick" style="top:${t.y - 1}px"></div><div class="tw-tick-label" style="top:${t.y}px">${fmtM(t.m)}</div>`);
    }

    // 3. 다음 랜드마크 실루엣 (하나만)
    const lm = override || L.landmark;
    const lmColor = lm.gold ? SIL_GOLD : undefined;
    const img = silhouetteImage(lm.id, lmColor);
    const box = placeSilhouette(img, lm.m * L.ppm, cx + towerW * SIL_OFFSET_RATIO, L.groundY);
    const lmTop = Y(lm.m);
    parts.push(`<img class="tw-sil" src="${img.url}" alt="" style="left:${box.left}px;top:${box.top}px;width:${box.width}px;height:${box.height}px;z-index:1">`);
    parts.push(`<div class="tw-lm-line" style="top:${lmTop}px;z-index:1"></div>`);
    const labelX = Math.min(Math.max(box.left + box.width / 2, RULER_W + 70), width - 70);
    parts.push(`<div class="tw-lm-label${lm.gold ? ' gold' : ''}" style="left:${labelX}px;top:${lmTop - 4}px;z-index:4">${esc(lm.name)} · ${fmtM(lm.m)}</div>`);

    // 4. 목표선
    if (L.goalY != null) {
      parts.push(`<div class="tw-goal" style="top:${L.goalY - 2}px;z-index:3"></div><div class="tw-goal-label" style="top:${L.goalY}px;z-index:4">우리 반 목표 ${fmtM(L.goalM)}</div>`);
    }

    // 5. 책 더미 (아래부터)
    let cumM = 0;
    for (const b of L.books) {
      const num = data.numberOf(b.studentId) || 1;
      const ci = coverIndex(num, COVER_COLORS.length);
      const w = b.widthUnits * U, left = cx - w / 2 + b.offsetUnits * U;
      const top = Y(cumM) - b.heightPx;
      cumM += heightM(b.pages, data.cmPerPage);
      const st = bookStyle(COVER_COLORS[ci], b.variant, b.heightPx, ASSETS.books[ci]?.[b.variant] ?? null);
      const title = b.heightPx >= 16 ? `<span class="t">${esc(b.title)}</span>` : '';
      parts.push(`<div class="tw-book ${st.cls}" style="left:${left}px;top:${top}px;width:${w}px;height:${b.heightPx}px;${st.bg};z-index:2">${title}</div>`);
    }

    // 6. 현재 높이선 + 말풍선
    if (L.books.length) {
      parts.push(`<div class="tw-now" style="top:${L.topY - 1}px;z-index:3"></div>`);
      parts.push(`<div class="tw-bubble" style="left:${cx}px;top:${L.topY - 10}px;z-index:4">${fmtM(L.totalM)} · ${fmtN(L.pages)}쪽</div>`);
    } else {
      parts.push(`<div class="tw-empty" style="top:${L.groundY - 120}px;z-index:4">아직 쌓인 책이 없어요</div>`);
    }

    // 7. 땅
    const groundBg = ASSETS.ground ? `background:url(${ASSETS.ground}) repeat-x left top/${16 * U}px ${14 * U}px, #8a5a32;` : '';
    parts.push(`<div class="tw-ground" style="${groundBg}z-index:3"></div>`);

    content.style.height = L.H + 'px';
    content.innerHTML = parts.join('');

    // 스크롤: 처음/전환 때는 탑 꼭대기를 위쪽에, 그 외에는 보던 높이 유지
    if (reset || focus == null) scroller.scrollTop = L.topY - 130;
    else scroller.scrollTop = scrollTopAfter(L.view, focus, viewH);

    renderChip();
    slider.value = zoomToSlider(zoom);
  }

  function renderChip() {
    const L = layout;
    if (!L) return;
    if (L.allDone) {
      const last = getLandmarks().at(-1);
      chip.className = 'tw-chip gold';
      chip.innerHTML = `<span>${icon('star', '★')} 하늘 끝에 닿았어요!</span><button class="btn small">설명 보기</button>`;
      chip.querySelector('button').onclick = () => landmarkCard(last, SIL_GOLD);
    } else {
      chip.className = 'tw-chip';
      chip.innerHTML = `<span>다음 목표: ${esc(L.next.name)} ${fmtM(L.next.m)} · ${fmtM(L.landmark.remainingM)} 남음</span><button class="btn small">설명 보기</button>`;
      chip.querySelector('button').onclick = () => landmarkCard(L.next);
    }
  }

  function renderLeader() {
    const ld = data?.leader;
    if (!ld) { leaderEl.classList.add('hidden'); return; }
    const crown = ASSETS.crown ? `<img class="crown" src="${ASSETS.crown}" alt="">` : '👑';
    leaderEl.innerHTML = `${crown}<span>다독왕 ${ld.names.map(esc).join(', ')} <span class="small muted">${fmtN(ld.pages)}쪽</span></span>`;
    leaderEl.classList.remove('hidden');
  }

  function schedule(reset = false) {
    pendingReset = pendingReset || reset;
    if (raf) return;
    raf = requestAnimationFrame(() => { raf = 0; const r = pendingReset; pendingReset = false; draw({ reset: r }); });
  }

  function setZoom(z) {
    zoom = clampZoom(z);
    slider.value = zoomToSlider(zoom);
    schedule(false);
  }

  // 확대·축소 입력
  root.querySelector('.tw-zoom').addEventListener('click', e => {
    const z = e.target.dataset?.z;
    if (z === 'in') setZoom(zoom * 1.5);
    else if (z === 'out') setZoom(zoom / 1.5);
    else if (z === 'all') { zoom = 1; schedule(true); }
  });
  slider.addEventListener('input', () => setZoom(sliderToZoom(+slider.value)));
  scroller.addEventListener('wheel', e => {
    if (!e.ctrlKey && !e.metaKey) return;              // 일반 휠은 스크롤
    e.preventDefault();
    setZoom(zoom * Math.exp(-e.deltaY * 0.0025));
  }, { passive: false });
  let pinch = null;
  const dist = t => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
  scroller.addEventListener('touchstart', e => {
    if (e.touches.length === 2) pinch = { d: dist(e.touches), z: zoom };
  }, { passive: true });
  scroller.addEventListener('touchmove', e => {
    if (!pinch || e.touches.length !== 2) return;
    e.preventDefault();
    setZoom(pinch.z * dist(e.touches) / pinch.d);
  }, { passive: false });
  scroller.addEventListener('touchend', e => { if (e.touches.length < 2) pinch = null; });
  new ResizeObserver(() => schedule(!layout)).observe(scroller);

  return {
    /** 데이터 갱신. reset=true면 확대 1배·스크롤 초기화 */
    update(next, { reset = false } = {}) {
      data = next;
      if (reset) zoom = 1;
      renderLeader();
      draw({ reset: reset || !layout });
    },
    get layout() { return layout; },
    /** 돌파 연출: 넘은 랜드마크 실루엣을 번쩍이며 사라지게 */
    flash(lm) {
      return new Promise(res => {
        override = { ...lm, gold: false };
        draw();
        const el = content.querySelector('.tw-sil');
        el?.classList.add('flash');
        setTimeout(() => { override = null; draw(); res(); }, 950);
      });
    },
    zoomRange: [ZMIN, ZMAX],
  };
}
