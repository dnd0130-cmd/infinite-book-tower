// Firestore 보안 규칙 시험.
// 필요: Java, firebase-tools, @firebase/rules-unit-testing, firebase (npm i -D 로 설치)
// 실행: npx firebase emulators:exec --only firestore --project demo-bt "node --test tools/rules-test.mjs"
import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, addDoc, collection, query, where, serverTimestamp, increment } from 'firebase/firestore';

const RULES = process.env.RULES_PATH || new URL('../firestore.rules', import.meta.url).pathname;
let env;
before(async () => { env = await initializeTestEnvironment({ projectId: 'demo-bt', firestore: { rules: readFileSync(RULES, 'utf8'), host: '127.0.0.1', port: 8080 } }); });
after(async () => { await env.cleanup(); });

const T1 = 'teacher1', T2 = 'teacher2', CODE = 'ABC234';
const classDoc = (uid = T1, over = {}) => ({ code: CODE, name: '4학년 2반', goal_m: 500, cm_per_page: 1, teacherUid: uid, created_at: serverTimestamp(), ...over });
const bookDoc = (over = {}) => ({ student_number: 1, title: '어린 왕자', pages: 200, note: '재밌었다', created_at: serverTimestamp(), ...over });

// 각 시험 전에: 선생님1의 반 + 학생 1번 (규칙 우회로 미리 만들어 둠)
beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async ctx => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'classes', CODE), { code: CODE, name: '4학년 2반', goal_m: 500, cm_per_page: 1, teacherUid: T1, created_at: new Date() });
    await setDoc(doc(db, 'classes', CODE, 'students', '1'), { number: 1, name: '김하늘' });
    await setDoc(doc(db, 'classes', CODE, 'books', 'b1'), { student_number: 1, title: '기존 책', pages: 100, note: '좋다', created_at: new Date() });
  });
});
const anon = () => env.unauthenticatedContext().firestore();
const teacher = (uid = T1) => env.authenticatedContext(uid).firestore();

test('학생(로그인 없음): 코드를 알면 반·학생·책을 읽는다', async () => {
  const db = anon();
  await assertSucceeds(getDoc(doc(db, 'classes', CODE)));
  await assertSucceeds(getDoc(doc(db, 'classes', CODE, 'students', '1')));
  await assertSucceeds(getDocs(collection(db, 'classes', CODE, 'students')));
  await assertSucceeds(getDocs(collection(db, 'classes', CODE, 'books')));
});

test('반 목록은 조회할 수 없다 (코드를 모르면 알아낼 방법이 없음)', async () => {
  await assertFails(getDocs(collection(anon(), 'classes')));
  await assertFails(getDocs(collection(teacher(T2), 'classes')));                       // 남의 반을 통째로 조회 금지
  await assertFails(getDocs(query(collection(teacher(T2), 'classes'), where('teacherUid', '==', T1))));
});

test('선생님은 자기 반 목록만 조회한다', async () => {
  await assertSucceeds(getDocs(query(collection(teacher(T1), 'classes'), where('teacherUid', '==', T1))));
});

test('반 만들기: 로그인한 선생님만, 형식이 맞아야 한다', async () => {
  await assertSucceeds(setDoc(doc(teacher(T2), 'classes', 'ZZZ999'), classDoc(T2, { code: 'ZZZ999' })));
  await assertFails(setDoc(doc(anon(), 'classes', 'QQQ222'), classDoc(T1, { code: 'QQQ222' })));      // 로그인 안 함
  await assertFails(setDoc(doc(teacher(T2), 'classes', 'abc123'), classDoc(T2, { code: 'abc123' })));  // 소문자 코드
  await assertFails(setDoc(doc(teacher(T2), 'classes', 'WWW222'), classDoc(T1, { code: 'WWW222' })));  // 남의 uid로
  await assertFails(setDoc(doc(teacher(T2), 'classes', 'EEE222'), classDoc(T2, { code: 'EEE222', goal_m: -5 })));
  await assertFails(setDoc(doc(teacher(T2), 'classes', 'RRR222'), classDoc(T2, { code: 'RRR222', admin: true })));
});

test('반 코드는 선생님이 정한다: 6~12자, 대문자+숫자, 글자와 숫자를 모두 포함', async () => {
  const mk = (code, over = {}) => setDoc(doc(teacher(T2), 'classes', code), classDoc(T2, { code, ...over }));
  await assertSucceeds(mk('MUMU42'));
  await assertSucceeds(mk('GRADE4ROOM2'));            // 11자
  await assertFails(mk('123456'));                      // 숫자만
  await assertFails(mk('ABCDEF'));                      // 글자만
  await assertFails(mk('AB12'));                        // 너무 짧음
  await assertFails(mk('ABCDEFGH12345'));               // 13자, 너무 김
  await assertFails(mk('mumu42'));                      // 소문자
  await assertFails(mk('MUMU-42'));                     // 기호
  // 이미 있는 코드는 덮어쓸 수 없다 (다른 선생님도, 같은 선생님도)
  await assertFails(setDoc(doc(teacher(T2), 'classes', CODE), classDoc(T2)));
  await assertFails(setDoc(doc(teacher(T1), 'classes', CODE), classDoc(T1)));
});

test('학번 방식: 학년·반은 함께, 범위 안에서만', async () => {
  const mk = (code, over) => setDoc(doc(teacher(T2), 'classes', code), classDoc(T2, { code, ...over }));
  await assertSucceeds(mk('HAK4B2', { grade: 4, room: 2 }));
  await assertSucceeds(mk('HAK6B12', { grade: 6, room: 12 }));
  await assertFails(mk('HAK4B3', { grade: 4 }));                    // 학년만
  await assertFails(mk('HAK4B4', { room: 2 }));                     // 반만
  await assertFails(mk('HAK0B5', { grade: 0, room: 2 }));
  await assertFails(mk('HAK4B6', { grade: 4, room: 100 }));
  await assertFails(mk('HAK4B7', { grade: 4.5, room: 2 }));
  await assertFails(updateDoc(doc(teacher(T1), 'classes', CODE), { grade: 5 }));   // 만든 뒤에는 바꿀 수 없음
  // 학번(5자리)까지 학생 번호로 허용
  await assertSucceeds(setDoc(doc(teacher(T1), 'classes', CODE, 'students', '41201'), { number: 41201, name: '학번' }));
  await assertSucceeds(setDoc(doc(teacher(T1), 'classes', CODE, 'students', '99999'), { number: 99999, name: '끝' }));
  await assertFails(setDoc(doc(teacher(T1), 'classes', CODE, 'students', '100000'), { number: 100000, name: '범위 밖' }));
});

test('반 설정: 주인 선생님만, 이름·목표·쪽당 높이만 바꾼다', async () => {
  await assertSucceeds(updateDoc(doc(teacher(T1), 'classes', CODE), { name: '새 이름', goal_m: 700 }));
  await assertFails(updateDoc(doc(teacher(T2), 'classes', CODE), { name: '가로채기' }));
  await assertFails(updateDoc(doc(anon(), 'classes', CODE), { name: '익명' }));
  await assertFails(updateDoc(doc(teacher(T1), 'classes', CODE), { teacherUid: T2 }));        // 주인 바꾸기 금지
  await assertFails(updateDoc(doc(teacher(T1), 'classes', CODE), { name: ' ' }));
});

test('학생 등록·삭제: 주인 선생님만', async () => {
  await assertSucceeds(setDoc(doc(teacher(T1), 'classes', CODE, 'students', '2'), { number: 2, name: '이도윤' }));
  await assertFails(setDoc(doc(teacher(T2), 'classes', CODE, 'students', '3'), { number: 3, name: '남의 반' }));
  await assertFails(setDoc(doc(anon(), 'classes', CODE, 'students', '4'), { number: 4, name: '익명' }));
  await assertFails(setDoc(doc(teacher(T1), 'classes', CODE, 'students', '5'), { number: 6, name: '번호 불일치' }));
  await assertSucceeds(deleteDoc(doc(teacher(T1), 'classes', CODE, 'students', '1')));
  await assertFails(deleteDoc(doc(anon(), 'classes', CODE, 'students', '1')));
});

test('책 쌓기: 반에 있는 번호, 쪽수 1~3000, 한 줄 느낌 필수', async () => {
  const books = db => collection(db, 'classes', CODE, 'books');
  await assertSucceeds(addDoc(books(anon()), bookDoc()));
  await assertFails(addDoc(books(anon()), bookDoc({ student_number: 99 })));            // 없는 번호
  await assertFails(addDoc(books(anon()), bookDoc({ pages: 0 })));
  await assertFails(addDoc(books(anon()), bookDoc({ pages: 3001 })));
  await assertFails(addDoc(books(anon()), bookDoc({ pages: 12.5 })));
  await assertFails(addDoc(books(anon()), bookDoc({ note: '' })));                      // 느낌 필수
  await assertFails(addDoc(books(anon()), bookDoc({ note: '   ' })));
  await assertFails(addDoc(books(anon()), bookDoc({ note: 'a'.repeat(201) })));
  await assertFails(addDoc(books(anon()), bookDoc({ title: '' })));
  await assertFails(addDoc(books(anon()), bookDoc({ title: 'a'.repeat(101) })));
  await assertFails(addDoc(books(anon()), bookDoc({ created_at: new Date('2020-01-01') }))); // 시각 조작 금지
  await assertFails(addDoc(books(anon()), bookDoc({ extra: 1 })));
});

test('책 고치기: 제목·쪽수·느낌만, 쌓을 때와 같은 검사', async () => {
  const bk = () => doc(anon(), 'classes', CODE, 'books', 'b1');
  await assertSucceeds(updateDoc(bk(), { pages: 250 }));
  await assertSucceeds(updateDoc(bk(), { title: '새 제목', note: '새 느낌', pages: 3000 }));
  await assertFails(updateDoc(bk(), { pages: 0 }));
  await assertFails(updateDoc(bk(), { pages: 3001 }));
  await assertFails(updateDoc(bk(), { pages: 10.5 }));
  await assertFails(updateDoc(bk(), { note: '  ' }));                                  // 느낌은 계속 필수
  await assertFails(updateDoc(bk(), { title: '' }));
  await assertFails(updateDoc(bk(), { student_number: 2 }));                           // 쓴 사람 바꾸기 금지
  await assertFails(updateDoc(bk(), { created_at: new Date('2020-01-01') }));          // 시각 바꾸기 금지
  await assertFails(updateDoc(bk(), { extra: 1 }));
  await assertSucceeds(deleteDoc(bk()));                                               // 지우기는 그대로 가능
});

test('학생 비밀번호(pinHash)와 반 설정: 선생님만, 형식 검사', async () => {
  const st = db => doc(db, 'classes', CODE, 'students', '1');
  const h64 = 'a'.repeat(64);
  await assertSucceeds(updateDoc(st(teacher(T1)), { pinHash: h64 }));
  await assertFails(updateDoc(st(teacher(T1)), { pinHash: '1234' }));                  // 원문 4자리를 그대로 저장 금지
  await assertFails(updateDoc(st(anon()), { pinHash: h64 }));
  await assertFails(updateDoc(st(teacher(T2)), { pinHash: h64 }));
  await assertSucceeds(updateDoc(doc(teacher(T1), 'classes', CODE), { pinRequired: true }));
  await assertFails(updateDoc(doc(teacher(T1), 'classes', CODE), { pinRequired: 'yes' }));
  await assertFails(updateDoc(doc(anon(), 'classes', CODE), { pinRequired: false }));
});

test('반 비우기·삭제: 주인 선생님만 (책·학생까지)', async () => {
  await assertFails(deleteDoc(doc(teacher(T2), 'classes', CODE, 'students', '1')));
  await assertSucceeds(deleteDoc(doc(anon(), 'classes', CODE, 'books', 'b1')));        // 책 비우기
  await assertSucceeds(deleteDoc(doc(teacher(T1), 'classes', CODE, 'students', '1')));
  await assertFails(deleteDoc(doc(teacher(T2), 'classes', CODE)));
  await assertSucceeds(deleteDoc(doc(teacher(T1), 'classes', CODE)));
});

test('다른 컬렉션은 모두 막혀 있다', async () => {
  await assertFails(getDoc(doc(anon(), 'users', 'x')));
  await assertFails(setDoc(doc(teacher(T1), 'users', 'x'), { a: 1 }));
});

test('전학 처리: 주인 선생님만 바꾸고, 전학 간 번호로는 책을 쌓을 수 없다', async () => {
  const st = db => doc(db, 'classes', CODE, 'students', '1');
  const books = db => collection(db, 'classes', CODE, 'books');
  await assertSucceeds(addDoc(books(anon()), bookDoc()));                                // 전학 전에는 쌓임
  await assertFails(updateDoc(st(anon()), { left: true }));                              // 익명은 못 바꿈
  await assertFails(updateDoc(st(teacher(T2)), { left: true }));                         // 다른 선생님도 못 바꿈
  await assertFails(updateDoc(st(teacher(T1)), { left: 'yes' }));                        // 참/거짓만
  await assertSucceeds(updateDoc(st(teacher(T1)), { left: true }));
  await assertFails(addDoc(books(anon()), bookDoc()));                                   // 전학 간 번호로는 쌓기 불가
  await assertSucceeds(getDocs(books(anon())));                                          // 기존 책은 계속 읽힘
  await assertSucceeds(updateDoc(st(teacher(T1)), { left: false }));                     // 복귀
  await assertSucceeds(addDoc(books(anon()), bookDoc()));
});

test('이름 고치기는 주인 선생님만', async () => {
  const st = db => doc(db, 'classes', CODE, 'students', '1');
  await assertSucceeds(updateDoc(st(teacher(T1)), { name: '김하늘2' }));
  await assertFails(updateDoc(st(teacher(T2)), { name: '가로채기' }));
  await assertFails(updateDoc(st(anon()), { name: '익명' }));
  await assertFails(updateDoc(st(teacher(T1)), { name: ' ' }));
  await assertFails(updateDoc(st(teacher(T1)), { number: 7 }));                          // 번호는 문서 주소와 같아야 함
});

test('방문자 수: 누구나 읽고, 1씩만 올릴 수 있다', async () => {
  const d = (db, id) => doc(db, 'site', id);
  await assertSucceeds(getDoc(d(anon(), 'total')));
  await assertSucceeds(setDoc(d(anon(), 'total'), { count: 1 }));                        // 처음 만들 때는 1
  await assertFails(setDoc(d(anon(), 'd20261027'), { count: 5 }));                        // 1이 아니면 거부
  await assertFails(setDoc(d(anon(), 'other'), { count: 1 }));                            // 정해진 이름만
  await assertFails(setDoc(d(anon(), 'd20261027'), { count: 1, extra: 'x' }));            // 다른 필드 거부
  await assertSucceeds(setDoc(d(anon(), 'd20261027'), { count: 1 }));
  await assertSucceeds(updateDoc(d(anon(), 'total'), { count: increment(1) }));          // +1은 허용
  await assertFails(updateDoc(d(anon(), 'total'), { count: increment(2) }));              // +2는 거부
  await assertFails(updateDoc(d(anon(), 'total'), { count: 1 }));                         // 줄이기 거부
  await assertFails(deleteDoc(d(anon(), 'total')));                                       // 지우기 거부
});
