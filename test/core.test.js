import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as C from '../js/core.js';
import { getLandmarks, getSilhouette } from '../js/landmarks.js';

const book = (id, pages, t = '2026-03-01T00:00:00Z', sid = 's1') =>
  ({ id, pages, created_at: t, student_id: sid, title: '책' + id });
const base = { cmPerPage: 1, goalM: 500, mode: 'class', zoom: 1, viewH: 800 };

test('랜드마크 13개, 높이 오름차순, 실루엣 격자 크기가 맞음', () => {
  const L = getLandmarks();
  assert.equal(L.length, 13);
  for (let i = 1; i < L.length; i++) assert.ok(L[i].m > L[i - 1].m, L[i].id);
  for (const l of L) {
    const s = getSilhouette(l.id);
    assert.ok(s, l.id);
    assert.equal(s.rows.length, s.h, l.id);
    for (const r of s.rows) assert.equal(r.length, s.w, l.id);
    assert.match(s.rows.join(''), /^[.#ox]+$/, l.id);
  }
});

test('100쪽 = 1m, cm_per_page에 비례', () => {
  const a = C.computeLayout({ ...base, books: [book('a', 100)] });
  assert.equal(a.totalM, 1);
  assert.ok(Math.abs(a.books[0].heightPx - a.ppm) < 1e-9);
  const b = C.computeLayout({ ...base, cmPerPage: 2, books: [book('a', 100)] });
  assert.equal(b.totalM, 2);
});

test('다음 랜드마크 판정과 남은 높이', () => {
  const r = C.computeLayout({ ...base, books: [book('a', 14200)] }); // 142m
  assert.equal(r.reachedCount, 6);
  assert.equal(r.next.id, 'khufu');
  assert.ok(Math.abs(r.landmark.remainingM - 4) < 1e-9);
  assert.equal(r.landmark.gold, false);
  assert.ok(Math.abs(r.landmark.heightPx - 146 * r.ppm) < 1e-9);
  // 정확히 같은 높이면 넘은 것
  assert.equal(C.landmarkState(1.4).reachedCount, 1);
});

test('모두 넘으면 마지막 랜드마크를 금색으로', () => {
  const r = C.computeLayout({ ...base, books: [book('a', 3000), ...Array.from({ length: 30 }, (_, i) => book('b' + i, 3000))] });
  assert.equal(r.allDone, true);
  assert.equal(r.next, null);
  assert.equal(r.landmark.id, 'burj');
  assert.equal(r.landmark.gold, true);
  assert.equal(r.landmark.remainingM, 0);
});

test('화면 맞춤: 가까운 목표는 한 화면, 먼 목표는 스크롤', () => {
  const near = C.computeLayout({ ...base, goalM: 10, books: [] }); // fitM 4 → 목표 10 ≤ 12
  assert.ok(Math.abs(near.ppm - 710 / (10 * 1.08)) < 1e-9);
  assert.ok(near.goalY != null);
  const far = C.computeLayout({ ...base, goalM: 500, books: [] }); // 다음 = 아이 키
  assert.ok(Math.abs(far.ppm - 710 / 4) < 1e-9 || far.ppm === 40000 / 540);
  assert.ok(far.H > 800);
  // 내 탑에는 목표선 없음
  assert.equal(C.computeLayout({ ...base, mode: 'me', books: [] }).goalY, null);
});

test('캔버스 높이 상한', () => {
  const r = C.computeLayout({ ...base, zoom: 60, books: [book('a', 50000)] });
  assert.ok(r.H <= 40000 + 90 + 1);
});

test('눈금 간격은 38px 이상', () => {
  for (const zoom of [0.4, 1, 7, 60]) {
    const r = C.computeLayout({ ...base, zoom, books: [book('a', 2000)] });
    const step = r.ticks[1].m - r.ticks[0].m;
    assert.ok(step * r.ppm >= 38, String(zoom));
  }
});

test('쌓는 순서: 시각 오름차순, 같으면 id', () => {
  const r = C.computeLayout({ ...base, books: [
    book('z', 10, '2026-03-02T00:00:00Z'), book('b', 10, '2026-03-01T00:00:00Z'), book('a', 10, '2026-03-01T00:00:00Z'),
  ] });
  assert.deepEqual(r.books.map(b => b.id), ['a', 'b', 'z']);
});

test('책 모양은 id로 결정적', () => {
  const a = C.computeLayout({ ...base, books: [book('abc', 50)] }).books[0];
  const b = C.computeLayout({ ...base, zoom: 3, books: [book('abc', 50)] }).books[0];
  assert.deepEqual([a.widthUnits, a.offsetUnits, a.variant], [b.widthUnits, b.offsetUnits, b.variant]);
  assert.ok(a.widthUnits >= 48 && a.widthUnits <= 61);
  assert.ok(a.offsetUnits >= -2 && a.offsetUnits <= 2);
});

test('확대 슬라이더 왕복과 화면 중심 유지', () => {
  assert.ok(Math.abs(C.sliderToZoom(0) - 0.4) < 1e-9);
  assert.ok(Math.abs(C.sliderToZoom(100) - 60) < 1e-9);
  assert.equal(C.zoomToSlider(C.sliderToZoom(37)), 37);
  const v1 = { H: 5000, ppm: 10, GROUND: 40 }, v2 = { H: 20000, ppm: 40, GROUND: 40 };
  const f = C.focusMBefore(v1, 1000, 600);
  const st = C.scrollTopAfter(v2, f, 600);
  assert.ok(Math.abs(C.focusMBefore(v2, st, 600) - f) < 1e-9);
});

test('실루엣 픽셀: 크기, 테두리, 위치', () => {
  const s = getSilhouette('kid');
  const px = C.silhouettePixels(s);
  assert.equal(px.w, 14); assert.equal(px.h, 26);
  assert.equal(px.data.length, 14 * 26 * 4);
  const at = (x, y) => Array.from(px.data.slice((y * px.w + x) * 4, (y * px.w + x) * 4 + 4));
  assert.deepEqual(at(6, 0), [...C.OUTLINE_RGB, 255]);  // 머리 위 테두리
  assert.equal(at(0, 0)[3], 0);                          // 빈 칸은 투명
  const box = C.silhouetteBox(s, 240, 100, 50, 1000);
  assert.equal(box.cell, 10);
  assert.equal(box.top + box.cell, 1000 - 240);          // 몸통 맨 윗칸 = 꼭대기
  assert.equal(box.left + box.width / 2, 135);
});

test('돌파 판정', () => {
  assert.deepEqual(C.newlyReached(null, 3), []);         // 첫 방문은 팝업 없음
  assert.deepEqual(C.newlyReached(3, 2), []);            // 줄어들면 팝업 없음
  assert.deepEqual(C.newlyReached(2, 4).map(l => l.id), ['school', 'pisa']);
  assert.equal(C.seenKey('ABC234', 5, 'me'), 'bt_seen_ABC234_5_me');
});

test('다독왕: 동점 모두, 기록 없으면 null', () => {
  const st = [{ id: 's1', name: '가' }, { id: 's2', name: '나' }, { id: 's3', name: '다' }];
  assert.equal(C.leader(st, []), null);
  const l = C.leader(st, [book('a', 100, undefined, 's1'), book('b', 60, undefined, 's2'), book('c', 40, undefined, 's2')]);
  assert.deepEqual(l, { names: ['가', '나'], pages: 100 });
});

test('이상 기록', () => {
  const s = (title, pages = 100) => C.suspicious({ title, pages });
  assert.equal(s('어린 왕자'), false);
  assert.equal(s('어린 왕자', 800), true);
  assert.equal(s('책'), true);
  assert.equal(s('ㅋㅋㅋ'), true);
});

test('반 코드', () => {
  for (let i = 0; i < 200; i++) assert.match(C.genCode(), /^[A-HJ-NP-Z2-9]{6}$/);
});

test('입력 검증과 이스케이프', () => {
  assert.ok(C.validateBook({ title: '  ', pages: 10 }).error);
  assert.ok(C.validateBook({ title: '책책', pages: 0 }).error);
  assert.ok(C.validateBook({ title: '책책', pages: 12.5 }).error);
  assert.ok(C.validateBook({ title: '책책', pages: 10, note: 'a'.repeat(201) }).error);
  assert.deepEqual(C.validateBook({ title: ' 모모 ', pages: '300' }), { title: '모모', pages: 300, note: '' });
  assert.equal(C.escapeHtml('<b a="1">&\''), '&lt;b a=&quot;1&quot;&gt;&amp;&#39;');
  assert.equal(C.coverIndex(1), 0); assert.equal(C.coverIndex(9), 0); assert.equal(C.coverIndex(8), 7);
});
