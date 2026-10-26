// 데이터 접근. 화면 코드는 여기의 `api`만 부른다.
//  - 연습 모드(?demo): 브라우저 안의 가짜 데이터 (DB 없음)
//  - 그 외: Firebase (js/api-firebase.js, 설정은 js/firebase-config.js)
// 주소에 ?emulator를 붙이면 내 컴퓨터의 Firebase 에뮬레이터에 연결한다 (시험용).
import { genCode, checkStudentPin, resolveNumber, normalizeCode, validateClassCode } from './core.js';
import { isFirebaseConfigured } from './firebase-config.js';

export const DEMO = window.__BT_DEMO__ === true || new URLSearchParams(location.search).has('demo');
const EMULATOR = new URLSearchParams(location.search).has('emulator');
export const NEEDS_SETUP = !DEMO && !EMULATOR && !isFirebaseConfigured();

// ── 연습용 (메모리) ──
function demoApi() {
  const uid = () => Math.random().toString(36).slice(2, 10);
  const titles = ['어린 왕자', '마당을 나온 암탉', '샬롯의 거미줄', '나쁜 어린이 표', '만복이네 떡집', '긴긴밤', '푸른 사자 와니니', '책 먹는 여우',
    '수상한 아파트', '멋진 여우 씨', '우리 반 채무 관계', '건방진 이도령', '내 이름은 삐삐', '해리 포터와 마법사의 돌', '모모', 'ㅋㅋㅋ'];
  const names = ['김하늘', '이도윤', '박서연', '최지호', '정하은', '강민준', '조수아', '윤시우', '장예린', '임건우', '한지안', '오유나',
    '서준호', '신다은', '권태윤', '황보민', '안소율', '송주원', '전하람', '홍채아'];
  const cls = { id: 'c1', name: '4학년 2반', code: 'BKTWR2', goal_m: 500, cm_per_page: 1, created_at: '2026-03-02T00:00:00Z' };
  const classes = [cls];
  const students = names.map((name, i) => ({ id: 's' + (i + 1), class_id: 'c1', number: i + 1, name }));
  const books = [];
  let t = Date.parse('2026-03-03T09:00:00Z');
  for (let i = 0; i < 96; i++) {
    const s = students[(i * 7 + (i % 3)) % students.length];
    const title = titles[(i * 5) % titles.length];
    const pages = title === 'ㅋㅋㅋ' ? 40 : 60 + ((i * 97) % 260) + (i % 11 === 0 ? 520 : 0);
    t += 3600e3 * (6 + (i % 9));
    books.push({ id: 'b' + uid(), class_id: 'c1', student_id: s.id, title, pages, note: i % 4 ? '재미있었다' : '', created_at: new Date(t).toISOString() });
  }
  let user = null;
  const find = (code, number) => {
    const c = classes.find(c => c.code === String(code).trim().toUpperCase());
    const s = c && students.find(s => s.class_id === c.id && s.number === resolveNumber(number, c));
    return c && s ? { c, s } : null;
  };
  const wait = v => new Promise(r => setTimeout(() => r(structuredClone(v)), 80));
  return {
    async studentData(code, number, pin) {
      const f = find(code, number); if (!f) return wait(null);
      if (f.s.left) throw new Error('이 번호는 지금 쓸 수 없어요. 선생님께 물어보세요');
      await checkStudentPin(f.c, f.s, f.c.code, number, pin);
      return wait({
        cls: f.c, me: f.s,
        students: students.filter(s => s.class_id === f.c.id).map(({ id, number, name, left, pinHash }) => ({ id, number, name, left: !!left, pinHash: pinHash || null })),
        books: books.filter(b => b.class_id === f.c.id),
      });
    },
    // 반 하나를 지켜본다 (교실 TV): 1.5초마다 지금 상태를 알려 준다
    async subscribeClass(code, cb) {
      const c = classes.find(c => c.code === String(code).trim().toUpperCase());
      const snap = () => c ? { cls: structuredClone(c), students: structuredClone(students.filter(s => s.class_id === c.id)), books: structuredClone(books.filter(b => b.class_id === c.id)) } : { cls: null, students: [], books: [] };
      cb(snap()); const t = setInterval(() => cb(snap()), 1500);
      return () => clearInterval(t);
    },
    async updateBook(code, number, id, v) {
      const f = find(code, number); const b = books.find(x => x.id === id);
      if (!b) throw new Error('이미 지워진 책이에요');
      if (!f || b.student_id !== f.s.id) throw new Error('내가 쌓은 책만 고칠 수 있어요');
      Object.assign(b, { title: v.title, pages: v.pages, note: v.note }); return wait(null);
    },
    async setPins(_classId, items) { items.forEach(it => { students.find(s => s.id === it.id).pinHash = it.hash; }); return wait(null); },
    async clearBooks(classId) { for (let i = books.length - 1; i >= 0; i--) if (books[i].class_id === classId) books.splice(i, 1); return wait(null); },
    async deleteClass(classId) {
      for (let i = books.length - 1; i >= 0; i--) if (books[i].class_id === classId) books.splice(i, 1);
      for (let i = students.length - 1; i >= 0; i--) if (students[i].class_id === classId) students.splice(i, 1);
      const k = classes.findIndex(c => c.id === classId); if (k >= 0) classes.splice(k, 1); return wait(null);
    },
    async addBook(code, number, b) {
      const f = find(code, number); if (!f) throw new Error('학생 정보를 찾을 수 없어요');
      books.push({ id: 'b' + uid(), class_id: f.c.id, student_id: f.s.id, title: b.title, pages: b.pages, note: b.note, created_at: new Date().toISOString() });
      return wait(null);
    },
    async deleteMyBook(code, number, id) {
      const f = find(code, number); const i = books.findIndex(b => b.id === id && f && b.student_id === f.s.id);
      if (i >= 0) books.splice(i, 1); return wait(null);
    },
    user: async () => user,
    signIn: async email => { user = { email }; },
    signUp: async email => { user = { email }; return { needsConfirm: false }; },
    signInGoogle: async () => { user = { email: 'teacher@gmail.com' }; },
    resetPassword: async () => wait(null),
    signOut: async () => { user = null; },
    listClasses: async () => wait(classes),
    async createClass(name, { code, grade, room } = {}) {
      let c2 = genCode();
      if (code) {
        c2 = normalizeCode(code); const err = validateClassCode(c2);
        if (err) throw new Error(err);
        if (classes.some(c => c.code === c2)) throw new Error('이미 사용 중인 코드예요. 다른 코드를 정해 주세요');
      }
      const c = { id: 'c' + uid(), name, code: c2, goal_m: 500, cm_per_page: 1, pinRequired: false, grade: grade && room ? Number(grade) : null, room: grade && room ? Number(room) : null, created_at: new Date().toISOString() };
      classes.push(c); return wait(c);
    },
    async isCodeFree(code) { return wait(!classes.some(c => c.code === normalizeCode(code))); },
    async updateClass(id, patch) { Object.assign(classes.find(c => c.id === id), patch); return wait(null); },
    listStudents: async classId => wait(students.filter(s => s.class_id === classId).sort((a, b) => a.number - b.number)),
    async addStudents(classId, entries) {
      entries.forEach(e => students.push({ id: 's' + uid(), class_id: classId, number: e.number, name: e.name }));
      return wait(null);
    },
    async setStudentLeft(_classId, id, left) { students.find(s => s.id === id).left = !!left; return wait(null); },
    async renameStudent(_classId, id, name) { students.find(s => s.id === id).name = name; return wait(null); },
    async deleteStudent(_classId, id) {
      students.splice(students.findIndex(s => s.id === id), 1);
      for (let i = books.length - 1; i >= 0; i--) if (books[i].student_id === id) books.splice(i, 1);
      return wait(null);
    },
    listBooks: async classId => wait(books.filter(b => b.class_id === classId)),
    async deleteBook(_classId, id) { const i = books.findIndex(b => b.id === id); if (i >= 0) books.splice(i, 1); return wait(null); },
  };
}

// Firebase 연결 코드는 필요할 때만 불러온다 (연습 모드에서는 외부 주소를 쓰지 않음)
export const api = DEMO ? demoApi() : NEEDS_SETUP ? null : (await import('./api-firebase.js')).createApi();
