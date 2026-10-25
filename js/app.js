// 시작점: 로그인 화면 → 학생 / 교사 화면 (명세서 2.1)
import { api, DEMO } from './api.js';
import { preloadLandmarkPngs } from './sil-render.js';
import { cityTileUrl } from './tower.js';
import { U } from './assets.js';
import { $, toast, errMsg } from './ui.js';
import { startStudent } from './student.js';
import { startTeacher } from './teacher.js';

const STUDENT_KEY = 'bt_student';
const root = document.getElementById('app');
const saved = {
  get() { try { return JSON.parse(localStorage.getItem(STUDENT_KEY)); } catch { return null; } },
  set(v) { try { localStorage.setItem(STUDENT_KEY, JSON.stringify(v)); } catch { /* 무시 */ } },
  clear() { try { localStorage.removeItem(STUDENT_KEY); } catch { /* 무시 */ } },
};

function showLogin() {
  const last = saved.get();
  root.innerHTML = `
  <div class="login">
    <h1>무한의 책탑</h1>
    <div class="sub">읽은 쪽수만큼 올라가요</div>
    ${DEMO ? '<div class="frame small" style="margin-bottom:12px;z-index:1">연습 모드: 반 코드 <b>BKTWR2</b>, 번호 1~20 / 선생님은 아무 이메일로나 로그인</div>' : ''}
    <div class="cards">
      <form class="frame" data-f="student" autocomplete="off">
        <h2>🙋 학생 입장</h2>
        <label class="field"><span>반 코드 (6자리)</span><input class="input" name="code" maxlength="6" required style="text-transform:uppercase;letter-spacing:3px" value="${last?.code || ''}"></label>
        <label class="field"><span>내 번호</span><input class="input" name="number" type="number" inputmode="numeric" min="1" required value="${last?.number || ''}"></label>
        <button class="btn primary" style="width:100%">입장하기</button>
      </form>
      <form class="frame" data-f="teacher">
        <h2>🧑‍🏫 선생님</h2>
        <label class="field"><span>이메일</span><input class="input" name="email" type="email" required autocomplete="username"></label>
        <label class="field"><span>비밀번호</span><input class="input" name="pw" type="password" required minlength="6" autocomplete="current-password"></label>
        <div class="row"><button class="btn blue grow" data-a="in">로그인</button><button class="btn grow" data-a="up">가입</button></div>
      </form>
    </div>
    <div class="city" style="background:url(${cityTileUrl()}) repeat-x bottom left/${120 * U}px ${60 * U}px"></div>
  </div>`;

  $('[data-f="student"]', root).onsubmit = async e => {
    e.preventDefault();
    const f = e.target;
    await enterStudent(f.code.value.trim().toUpperCase(), Number(f.number.value), true);
  };
  let action = 'in';
  $('[data-f="teacher"]', root).addEventListener('click', e => { if (e.target.dataset?.a) action = e.target.dataset.a; });
  $('[data-f="teacher"]', root).onsubmit = async e => {
    e.preventDefault();
    const f = e.target, email = f.email.value.trim(), pw = f.pw.value;
    try {
      if (action === 'up') {
        const r = await api.signUp(email, pw);
        if (r.needsConfirm) return toast('가입 확인 메일을 보냈어요. 메일의 링크를 누른 뒤 로그인해 주세요');
      } else {
        await api.signIn(email, pw);
      }
      const user = await api.user();
      if (user) startTeacher(root, { user, onLogout: showLogin });
    } catch (err) {
      const m = errMsg(err);
      toast(/invalid login/i.test(m) ? '이메일이나 비밀번호가 맞지 않아요' : /already registered/i.test(m) ? '이미 가입된 이메일이에요' : m);
    }
  };
}

async function enterStudent(code, number, fromForm) {
  if (!/^[A-Z0-9]{6}$/.test(code) || !(number > 0)) { toast('반 코드나 번호를 다시 확인해 주세요'); return false; }
  try {
    const data = await api.studentData(code, number);
    if (!data) {
      if (fromForm) toast('반 코드나 번호를 다시 확인해 주세요');
      return false;
    }
    saved.set({ code, number });
    await startStudent(root, { code, number, data, onLogout: () => { saved.clear(); showLogin(); } });
    return true;
  } catch (e) {
    toast(errMsg(e));
    return false;
  }
}

async function boot() {
  await preloadLandmarkPngs();
  try {
    const user = await api.user();
    if (user) return startTeacher(root, { user, onLogout: showLogin });
  } catch { /* 로그인 정보 확인 실패는 로그인 화면으로 */ }
  const last = saved.get();
  if (last && await enterStudent(last.code, last.number, false)) return;
  showLogin();
}

boot();
