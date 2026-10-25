// 데이터 접근 (명세서 5장, 6장 Supabase 호출)
// 주소에 ?demo를 붙이면 DB 없이 브라우저 안의 연습용 데이터로 동작한다.
import { SUPABASE_URL, SUPABASE_KEY } from './config.js';
import { genCode } from './core.js';

export const DEMO = window.__BT_DEMO__ === true || new URLSearchParams(location.search).has('demo');

function realApi() {
  const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
  const ok = ({ data, error }) => { if (error) throw error; return data; };
  return {
    // 학생 (로그인 없음, RPC만)
    studentData: (code, number) => sb.rpc('student_data', { p_code: code, p_number: number }).then(ok),
    addBook: (code, number, b) => sb.rpc('student_add_book', { p_code: code, p_number: number, p_title: b.title, p_pages: b.pages, p_note: b.note }).then(ok),
    deleteMyBook: (code, number, id) => sb.rpc('student_delete_book', { p_code: code, p_number: number, p_book_id: id }).then(ok),

    // 교사
    async user() { const { data } = await sb.auth.getSession(); return data.session?.user || null; },
    signIn: (email, password) => sb.auth.signInWithPassword({ email, password }).then(ok),
    async signUp(email, password) {
      const d = await sb.auth.signUp({ email, password }).then(ok);
      return { needsConfirm: !d.session };
    },
    // 구글 로그인: 구글 화면으로 이동했다가 이 주소로 돌아온다 (돌아오면 로그인된 상태)
    signInGoogle: () => sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: location.origin + location.pathname } }).then(ok),
    signOut: () => sb.auth.signOut(),
    listClasses: () => sb.from('classes').select('*').order('created_at').then(ok),
    async createClass(name) {
      for (let i = 0; i < 5; i++) {
        const { data, error } = await sb.from('classes').insert({ name, code: genCode() }).select().single();
        if (!error) return data;
        if (error.code !== '23505') throw error;     // 반 코드 중복이면 다시
      }
      throw new Error('반 코드를 만들지 못했어요. 다시 시도해 주세요');
    },
    updateClass: (id, patch) => sb.from('classes').update(patch).eq('id', id).then(ok),
    listStudents: classId => sb.from('students').select('*').eq('class_id', classId).order('number').then(ok),
    async addStudents(classId, names) {
      const cur = await sb.from('students').select('number').eq('class_id', classId).order('number', { ascending: false }).limit(1).then(ok);
      const max = cur[0]?.number || 0;
      return sb.from('students').insert(names.map((name, i) => ({ class_id: classId, number: max + i + 1, name }))).then(ok);
    },
    deleteStudent: id => sb.from('students').delete().eq('id', id).then(ok),
    listBooks: classId => sb.from('books').select('*').eq('class_id', classId).order('created_at').then(ok),
    deleteBook: id => sb.from('books').delete().eq('id', id).then(ok),
  };
}

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
    const s = c && students.find(s => s.class_id === c.id && s.number === Number(number));
    return c && s ? { c, s } : null;
  };
  const wait = v => new Promise(r => setTimeout(() => r(structuredClone(v)), 80));
  return {
    async studentData(code, number) {
      const f = find(code, number); if (!f) return wait(null);
      return wait({
        cls: f.c, me: f.s,
        students: students.filter(s => s.class_id === f.c.id).map(({ id, number, name }) => ({ id, number, name })),
        books: books.filter(b => b.class_id === f.c.id).map(b => ({ ...b, note: b.student_id === f.s.id ? b.note : null })),
      });
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
    signOut: async () => { user = null; },
    listClasses: async () => wait(classes),
    async createClass(name) { const c = { id: 'c' + uid(), name, code: genCode(), goal_m: 500, cm_per_page: 1, created_at: new Date().toISOString() }; classes.push(c); return wait(c); },
    async updateClass(id, patch) { Object.assign(classes.find(c => c.id === id), patch); return wait(null); },
    listStudents: async classId => wait(students.filter(s => s.class_id === classId).sort((a, b) => a.number - b.number)),
    async addStudents(classId, ns) {
      const max = Math.max(0, ...students.filter(s => s.class_id === classId).map(s => s.number));
      ns.forEach((name, i) => students.push({ id: 's' + uid(), class_id: classId, number: max + i + 1, name }));
      return wait(null);
    },
    async deleteStudent(id) {
      students.splice(students.findIndex(s => s.id === id), 1);
      for (let i = books.length - 1; i >= 0; i--) if (books[i].student_id === id) books.splice(i, 1);
      return wait(null);
    },
    listBooks: async classId => wait(books.filter(b => b.class_id === classId)),
    async deleteBook(id) { const i = books.findIndex(b => b.id === id); if (i >= 0) books.splice(i, 1); return wait(null); },
  };
}

export const api = DEMO ? demoApi() : realApi();
