// Firebase(Auth + Firestore) 연결.
// 데이터 구조는 firestore.rules 맨 위 설명을 볼 것.
//  - 반 코드가 문서 id: classes/{코드}, 그 아래 students/{번호}, books/{책 id}
//  - 학생은 로그인하지 않고 반 코드(비밀 주소)로 접근한다. 선생님은 Firebase 로그인.
// 화면 코드가 쓰는 함수 모양은 demo(api.js)와 같다. student_id는 번호 문자열이다.
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js';
import {
  getAuth, connectAuthEmulator, signInWithEmailAndPassword, createUserWithEmailAndPassword,
  signInWithPopup, GoogleAuthProvider, signOut,
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import {
  getFirestore, connectFirestoreEmulator, collection, doc, getDoc, getDocs, setDoc, addDoc, updateDoc, deleteDoc,
  query, where, orderBy, writeBatch, onSnapshot, serverTimestamp,
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
import { FIREBASE_CONFIG } from './firebase-config.js';
import { genCode } from './core.js';

const KO = {
  'auth/invalid-credential': '이메일이나 비밀번호가 맞지 않아요',
  'auth/wrong-password': '이메일이나 비밀번호가 맞지 않아요',
  'auth/user-not-found': '이메일이나 비밀번호가 맞지 않아요',
  'auth/invalid-email': '이메일 주소를 확인해 주세요',
  'auth/email-already-in-use': '이미 가입된 이메일이에요',
  'auth/weak-password': '비밀번호는 6자 이상으로 해 주세요',
  'auth/too-many-requests': '시도가 너무 많아요. 잠시 뒤에 다시 해 주세요',
  'auth/popup-blocked': '팝업이 막혀 있어요. 팝업을 허용하고 다시 눌러 주세요',
  'auth/unauthorized-domain': '이 주소는 Firebase에서 아직 허용되지 않았어요 (Authentication → 설정 → 승인된 도메인에 추가)',
  'auth/operation-not-allowed': '이 로그인 방법이 아직 켜져 있지 않아요 (Firebase 콘솔 → Authentication → 로그인 방법)',
  'auth/network-request-failed': '인터넷 연결을 확인해 주세요',
  'unavailable': '인터넷 연결을 확인해 주세요',
  'permission-denied': '저장할 수 없어요. 입력한 내용을 확인해 주세요',
};
const SILENT = new Set(['auth/popup-closed-by-user', 'auth/cancelled-popup-request']);
function wrap(fn) {
  return async (...a) => {
    try { return await fn(...a); } catch (e) {
      const code = String(e?.code || '').replace(/^firestore\//, '');
      if (SILENT.has(code)) { const s = new Error('취소됨'); s.silent = true; throw s; }
      if (KO[code]) throw new Error(KO[code]);
      throw e;
    }
  };
}

export function createApi() {
  const emulator = new URLSearchParams(location.search).has('emulator');      // 시험용: 내 컴퓨터의 가짜 서버에 연결
  const app = initializeApp(emulator ? { apiKey: 'demo-key', authDomain: 'localhost', projectId: 'demo-bt', appId: 'demo' } : FIREBASE_CONFIG);
  const auth = getAuth(app), db = getFirestore(app);
  if (emulator) {
    connectFirestoreEmulator(db, '127.0.0.1', 8080);
    connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  }

  const iso = ts => (ts?.toDate ? ts.toDate() : ts ? new Date(ts) : new Date()).toISOString();
  const mapClass = d => { const x = d.data(); return { id: d.id, code: d.id, name: x.name, goal_m: x.goal_m, cm_per_page: x.cm_per_page, created_at: iso(x.created_at) }; };
  const mapStudent = d => { const x = d.data(); return { id: d.id, number: x.number, name: x.name }; };
  const mapBook = d => { const x = d.data({ serverTimestamps: 'estimate' }); return { id: d.id, student_id: String(x.student_number), title: x.title, pages: x.pages, note: x.note ?? '', created_at: iso(x.created_at) }; };
  const sub = (code, name) => collection(db, 'classes', code, name);
  const normCode = c => String(c).trim().toUpperCase();

  // ── 학생: 반 하나를 실시간으로 지켜보며 보관해 둔다. 30초마다 불러도 서버를 읽지 않아 읽기 횟수가 늘지 않는다.
  let live = null;
  function watch(code) {
    if (live?.code === code) return live.ready.then(() => live);
    live?.stop();
    const st = { code, cls: null, students: [], books: [], stops: [] };
    st.stop = () => st.stops.forEach(f => f());
    let pending = 3;
    st.ready = new Promise((resolve, reject) => {
      const first = () => { if (--pending === 0) resolve(); };
      const once = (cb) => { let done = false; return snap => { cb(snap); if (!done) { done = true; first(); } }; };
      const fail = e => { if (live === st) live = null; st.stop(); reject(e); };
      st.stops.push(onSnapshot(doc(db, 'classes', code), once(s => { st.cls = s.exists() ? mapClass(s) : null; }), fail));
      st.stops.push(onSnapshot(sub(code, 'students'), once(s => { st.students = s.docs.map(mapStudent).sort((a, b) => a.number - b.number); }), fail));
      st.stops.push(onSnapshot(query(sub(code, 'books'), orderBy('created_at')), once(s => { st.books = s.docs.map(mapBook); }), fail));
    });
    live = st;
    return st.ready.then(() => st);
  }

  return {
    // 학생 (로그인 없음)
    studentData: wrap(async (code, number) => {
      code = normCode(code);
      const st = await watch(code);
      const me = st.students.find(s => s.number === Number(number));
      if (!st.cls || !me) return null;
      return { cls: st.cls, me, students: st.students, books: st.books };
    }),
    addBook: wrap(async (code, number, b) => {
      await addDoc(sub(normCode(code), 'books'), { student_number: Number(number), title: b.title, pages: b.pages, note: b.note, created_at: serverTimestamp() });
    }),
    deleteMyBook: wrap(async (code, number, id) => {
      const ref = doc(db, 'classes', normCode(code), 'books', id);
      const s = await getDoc(ref);
      if (!s.exists()) return;
      if (s.data().student_number !== Number(number)) throw new Error('내가 쌓은 책만 지울 수 있어요');
      await deleteDoc(ref);
    }),

    // 선생님
    user: async () => { await auth.authStateReady(); return auth.currentUser; },
    signIn: wrap((email, pw) => signInWithEmailAndPassword(auth, email, pw)),
    signUp: wrap(async (email, pw) => { await createUserWithEmailAndPassword(auth, email, pw); return { needsConfirm: false }; }),
    signInGoogle: wrap(() => { const p = new GoogleAuthProvider(); p.setCustomParameters({ prompt: 'select_account' }); return signInWithPopup(auth, p); }),
    signOut: async () => { live?.stop(); live = null; await signOut(auth); },

    listClasses: wrap(async () => {
      const uid = auth.currentUser.uid;
      const s = await getDocs(query(collection(db, 'classes'), where('teacherUid', '==', uid)));
      return s.docs.map(mapClass).sort((a, b) => a.created_at.localeCompare(b.created_at));
    }),
    createClass: wrap(async name => {
      for (let i = 0; i < 6; i++) {
        const code = genCode();
        if ((await getDoc(doc(db, 'classes', code))).exists()) continue;       // 이미 쓰는 코드면 다시
        await setDoc(doc(db, 'classes', code), { code, name, goal_m: 500, cm_per_page: 1, teacherUid: auth.currentUser.uid, created_at: serverTimestamp() });
        return { id: code, code, name, goal_m: 500, cm_per_page: 1, created_at: new Date().toISOString() };
      }
      throw new Error('반 코드를 만들지 못했어요. 다시 시도해 주세요');
    }),
    updateClass: wrap(async (id, patch) => { await updateDoc(doc(db, 'classes', id), patch); }),
    listStudents: wrap(async classId => (await getDocs(sub(classId, 'students'))).docs.map(mapStudent).sort((a, b) => a.number - b.number)),
    addStudents: wrap(async (classId, names) => {
      const cur = (await getDocs(sub(classId, 'students'))).docs.map(d => d.data().number);
      let n = Math.max(0, ...cur);
      const batch = writeBatch(db);
      for (const name of names) { n++; batch.set(doc(db, 'classes', classId, 'students', String(n)), { number: n, name }); }
      await batch.commit();
    }),
    deleteStudent: wrap(async (classId, id) => {
      const mine = await getDocs(query(sub(classId, 'books'), where('student_number', '==', Number(id))));
      const batch = writeBatch(db);
      mine.docs.forEach(d => batch.delete(d.ref));
      batch.delete(doc(db, 'classes', classId, 'students', id));
      await batch.commit();
    }),
    listBooks: wrap(async classId => (await getDocs(query(sub(classId, 'books'), orderBy('created_at')))).docs.map(mapBook)),
    deleteBook: wrap(async (classId, id) => { await deleteDoc(doc(db, 'classes', classId, 'books', id)); }),
  };
}
