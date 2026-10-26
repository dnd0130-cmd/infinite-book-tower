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
  assert.ok(r.H <= 160000 + 90 + 1);
  const d = C.computeLayout({ ...base, zoom: 1, books: [book('a', 50000)] });
  assert.ok(d.H <= 40000 + 90 + 1);                     // 기본 화면은 40000px 안
});

test('목표가 먼 빈 탑에서도 확대·축소가 반응', () => {
  const at = zoom => C.computeLayout({ ...base, goalM: 500, zoom, books: [] }).ppm;
  assert.ok(at(2) > at(1) && at(1) > at(0.5));          // 확대하면 커지고 축소하면 작아짐
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
  assert.ok(C.validateBook({ title: '책책', pages: 10 }).error);                       // 한 줄 느낌은 필수
  assert.ok(C.validateBook({ title: '책책', pages: 10, note: '   ' }).error);
  assert.ok(C.validateBook({ title: '책책', pages: 10, note: 'a'.repeat(201) }).error);
  assert.deepEqual(C.validateBook({ title: ' 모모 ', pages: '300', note: ' 재밌다 ' }), { title: '모모', pages: 300, note: '재밌다' });
  assert.equal(C.escapeHtml('<b a="1">&\''), '&lt;b a=&quot;1&quot;&gt;&amp;&#39;');
  assert.equal(C.coverIndex(1), 0); assert.equal(C.coverIndex(9), 0); assert.equal(C.coverIndex(8), 7);
});

test('학생 줄 해석: 번호 있는 줄·없는 줄, 빈 번호는 메우지 않는다', () => {
  const r = C.parseStudentLines('김하늘\n\n이도윤\n7 박서연\n3. 최지호\n정하은', [1, 2, 4, 5]);
  assert.deepEqual(r.entries, [   // 번호 없는 줄은 기존 최대(5)+1부터, 직접 쓴 7은 건너뜀, 비어 있는 3은 메우지 않음
    { number: 6, name: '김하늘' }, { number: 8, name: '이도윤' }, { number: 7, name: '박서연' }, { number: 3, name: '최지호' }, { number: 9, name: '정하은' },
  ]);
  // 빈 반에서 섞어 써도 번호 없는 줄이 1번부터
  assert.deepEqual(C.parseStudentLines('가\n7 나\n다').entries.map(e => e.number), [1, 7, 2]);
  // 아무것도 없으면 1번부터
  assert.deepEqual(C.parseStudentLines('가\n나').entries.map(e => e.number), [1, 2]);
  // 이미 있는 번호, 같은 번호 두 번, 범위 밖, 빈 입력
  assert.match(C.parseStudentLines('2 새친구', [1, 2, 3]).error, /2번은 이미/);
  assert.match(C.parseStudentLines('5 가\n5 나').error, /두 번/);
  assert.match(C.parseStudentLines('0 가').error, /1~99999/);
  assert.match(C.parseStudentLines('100000 가').error, /1~99999/);
  assert.equal(C.parseStudentLines('99999 가').entries[0].number, 99999);
  assert.ok(C.parseStudentLines('   \n ').error);
  // 이름이 숫자로 시작해도 구분자(공백·마침표)가 있을 때만 번호로 본다
  assert.equal(C.parseStudentLines('3반장').entries[0].name, '3반장');
  assert.equal(C.parseStudentLines('12 홍길동').entries[0].number, 12);
  // 이름은 30자까지
  assert.equal(C.parseStudentLines('가'.repeat(40)).entries[0].name.length, 30);
});

test('다독왕: 전학 간 학생은 후보에서 뺀다 (책은 그대로)', () => {
  const st = [{ id: 'a', name: '가' }, { id: 'b', name: '나', left: true }];
  const bk = [book('1', 500, undefined, 'b'), book('2', 100, undefined, 'a')];
  assert.deepEqual(C.leader(st, bk), { names: ['가'], pages: 100 });
  assert.equal(C.leader([{ id: 'b', name: '나', left: true }], [book('3', 50, undefined, 'b')]), null);
});

test('쪽수 확인 기준: 500쪽 이상이면 되묻는다', () => {
  assert.equal(C.CONFIRM_PAGES, 500);
  assert.equal(C.needsPageConfirm(499), false);
  assert.equal(C.needsPageConfirm(500), true);
  assert.equal(C.needsPageConfirm(3000), true);
});

test('CSV: 따옴표·쉼표·줄바꿈 처리, 한글용 BOM, 수식 막기', () => {
  const s = C.toCsv([['번호', '이름', '느낌'], [1, '김하늘', '재밌다, "정말"'], [2, '이도윤', '줄\n바꿈'], [3, '=SUM(A1)', '+1'], [4, null, '@x']]);
  assert.ok(s.startsWith('\uFEFF'));
  const lines = s.slice(1).split('\r\n');
  assert.equal(lines[0], '번호,이름,느낌');
  assert.equal(lines[1], '1,김하늘,"재밌다, ""정말"""');
  assert.equal(lines[2], '2,이도윤,"줄\n바꿈"');       // 칸 안의 줄바꿈은 따옴표로 감싸 한 칸으로 유지
  assert.equal(lines[3], "3,'=SUM(A1),'+1");        // 수식으로 읽히지 않게
  assert.equal(lines[4], "4,,'@x");
  assert.ok(s.endsWith('\r\n'));
});

test('목표 달성 축하: 아직→달성일 때만 팝업', () => {
  assert.deepEqual(C.goalCheck(null, true), { popup: false, store: 1 });   // 첫 방문엔 조용히 저장
  assert.deepEqual(C.goalCheck(null, false), { popup: false, store: 0 });
  assert.deepEqual(C.goalCheck(0, true), { popup: true, store: 1 });       // 달성하는 순간
  assert.deepEqual(C.goalCheck(1, true), { popup: false, store: 1 });      // 이미 축하함
  assert.deepEqual(C.goalCheck(1, false), { popup: false, store: 0 });     // 책 삭제·목표 상향 → 다시 달성하면 또 축하
});

test('조사: 받침에 따라 이/가', () => {
  assert.equal(C.josa('박서연', '이', '가'), '이');   // 연: 받침 ㄴ
  assert.equal(C.josa('김하늘', '이', '가'), '이');   // 늘: 받침 ㄹ
  assert.equal(C.josa('하루', '이', '가'), '가');
  assert.equal(C.josa('이도윤', '이', '가'), '이');
  assert.equal(C.josa('서연아', '이', '가'), '가');   // 아: 받침 없음
  assert.equal(C.josa('Tom', '이', '가'), '가');      // 한글이 아니면 받침 없는 쪽
  assert.equal(C.josa('', '이', '가'), '가');
});

test('학번: 만들기, 출석번호 뽑기, 입력 해석', () => {
  assert.equal(C.hakbun(4, 2, 1), 4201); assert.equal(C.hakbun(6, 12, 3), 61203); assert.equal(C.hakbun(4, 2, 25), 4225);
  const cls = { grade: 4, room: 2 };
  assert.equal(C.usesHakbun(cls), true); assert.equal(C.usesHakbun({}), false); assert.equal(C.usesHakbun({ grade: 4 }), false);
  assert.equal(C.hakbunBase(cls), 4200); assert.equal(C.hakbunBase({}), 0);
  assert.equal(C.seatOf(4207, cls), 7); assert.equal(C.seatOf(7, {}), 7); assert.equal(C.seatOf(5301, cls), 5301);   // 다른 반 학번은 그대로
  assert.equal(C.numberLabel(4207, cls), '7번'); assert.equal(C.numberLabel(7, {}), '7번');
  assert.equal(C.resolveNumber(4201, cls), 4201);       // 학번 그대로
  assert.equal(C.resolveNumber(1, cls), 4201);          // 출석번호만 써도 학번으로
  assert.equal(C.resolveNumber('12', cls), 4212);
  assert.equal(C.resolveNumber(1, {}), 1);              // 학번 방식이 아니면 그대로
});

test('학번 방식 학생 등록 해석', () => {
  const base = 4200;
  // 번호 없는 줄은 4201부터, 출석번호(1~99)와 학번(42xx) 모두 허용
  assert.deepEqual(C.parseStudentLines('김하늘\n이도윤\n박서연', [], base).entries.map(e => e.number), [4201, 4202, 4203]);
  assert.deepEqual(C.parseStudentLines('7 가\n4210 나\n다', [4201, 4202], base).entries.map(e => e.number), [4207, 4210, 4203]);
  assert.match(C.parseStudentLines('4301 다른반', [], base).error, /이 반의 번호가 아니에요/);
  assert.match(C.parseStudentLines('100 범위밖', [], base).error, /이 반의 번호가 아니에요/);
  assert.match(C.parseStudentLines('3 중복', [4203], base).error, /4203번은 이미/);
  assert.match(C.parseStudentLines('4 가\n4204 나', [], base).error, /두 번/);
  // 다른 반(학번 범위 밖)의 번호는 '이미 있는 번호'로 세지 않는다
  assert.deepEqual(C.parseStudentLines('가', [5301], base).entries.map(e => e.number), [4201]);
  // 학번 방식이 아닌 반은 예전과 같다
  assert.deepEqual(C.parseStudentLines('가\n나').entries.map(e => e.number), [1, 2]);
  assert.equal(C.parseStudentLines('41201 가', []).entries[0].number, 41201);
});

test('반 코드 검사', () => {
  assert.equal(C.validateClassCode('mumu42'), null);          // 소문자는 대문자로 보고 통과
  assert.equal(C.validateClassCode(' GRADE4ROOM2 '), null);
  assert.match(C.validateClassCode('AB12'), /6~12자/);
  assert.match(C.validateClassCode('ABCDEFGH12345'), /6~12자/);
  assert.match(C.validateClassCode('MUMU-42'), /대문자와 숫자만/);
  assert.match(C.validateClassCode('123456'), /글자와 숫자를 모두/);
  assert.match(C.validateClassCode('ABCDEF'), /글자와 숫자를 모두/);
  assert.match(C.validateClassCode('AAAAA1'), /너무 쉬운/);   // 같은 글자 5번 이상 반복
  assert.match(C.validateClassCode('CLASS1'), /너무 쉬운/);   // 흔한 코드
  assert.equal(C.normalizeCode(' ab12cd '), 'AB12CD');
  assert.match(C.validateClassCode('ABC123'), /너무 쉬운/);
  assert.equal(C.validateClassCode('ABC124'), null);
});
