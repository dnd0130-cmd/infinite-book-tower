// 시작점: 로그인 화면 → 학생 / 교사 화면 (명세서 2.1)
import { api, DEMO, NEEDS_SETUP } from './api.js';
import { preloadLandmarkPngs } from './sil-render.js';
import { cityTileUrl } from './tower.js';
import { U, icon } from './assets.js';
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
    <div class="login-books">${icon('booksIcon')}${icon('star')}${icon('booksIcon')}</div>
    <div class="sub">읽은 쪽수만큼 올라가요</div>
    ${DEMO ? '<div class="frame small" style="margin-bottom:12px;z-index:1">연습 모드: 반 코드 <b>BKTWR2</b>, 번호 1~20 / 선생님은 아무 이메일로나 로그인</div>' : ''}
    <div class="cards">
      <form class="frame" data-f="student" autocomplete="off">
        <h2>${icon('booksIcon')} 학생 입장</h2>
        <label class="field"><span>반 코드 (6자리)</span><input class="input" name="code" maxlength="6" required style="text-transform:uppercase;letter-spacing:3px" value="${last?.code || ''}"></label>
        <label class="field"><span>내 번호</span><input class="input" name="number" type="number" inputmode="numeric" min="1" required value="${last?.number || ''}"></label>
        <button class="btn primary" style="width:100%">입장하기</button>
      </form>
      <form class="frame" data-f="teacher">
        <h2>선생님</h2>
        <label class="field"><span>이메일</span><input class="input" name="email" type="email" required autocomplete="username"></label>
        <label class="field"><span>비밀번호</span><input class="input" name="pw" type="password" required minlength="6" autocomplete="current-password"></label>
        <div class="row"><button class="btn blue grow" data-a="in">로그인</button><button class="btn grow" data-a="up">가입</button></div>
        <button type="button" class="linkbtn" data-reset>비밀번호를 잊었어요</button>
        <div class="or"><span>또는</span></div>
        <button type="button" class="btn" style="width:100%" data-google><span class="gmark">G</span> 구글로 로그인</button>
      </form>
    </div>
    <div class="city" style="background:url(${cityTileUrl()}) repeat-x bottom left/${120 * U}px ${60 * U}px"></div>
  </div>`;

  $('[data-f="student"]', root).onsubmit = async e => {
    e.preventDefault();
    const f = e.target;
    await enterStudent(f.code.value.trim().toUpperCase(), Number(f.number.value), true);
  };
  $('[data-google]', root).onclick = async () => {
    try {
      await api.signInGoogle();                 // 구글 팝업에서 계정을 고르면 돌아온다
      const user = await api.user();
      if (user) startTeacher(root, { user, onLogout: showLogin });
    } catch (err) { if (!err.silent) toast(errMsg(err)); }
  };
  $('[data-reset]', root).onclick = async () => {
    const email = $('[data-f="teacher"] [name=email]', root).value.trim();
    if (!email) { toast('위 칸에 이메일을 먼저 적어 주세요'); $('[data-f="teacher"] [name=email]', root).focus(); return; }
    if (!/^\S+@\S+\.\S+$/.test(email)) return toast('이메일 주소를 확인해 주세요');
    try {
      await api.resetPassword(email);
      toast('비밀번호를 바꾸는 메일을 보냈어요. 메일함(스팸함도)을 확인해 주세요. 구글로 가입했다면 구글 버튼으로 들어오세요');
    } catch (err) { toast(errMsg(err)); }
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
      if (!err.silent) toast(errMsg(err));
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

// Firebase 설정(js/firebase-config.js)이 비어 있을 때 보여 주는 안내
function showSetup() {
  root.innerHTML = `<div class="login"><h1>무한의 책탑</h1>
    <div class="frame" style="max-width:520px;margin-top:24px;z-index:1">
      <h2>Firebase 설정이 아직 없어요</h2>
      <p class="small">1. Firebase 콘솔에서 웹 앱을 만들고 <b>firebaseConfig</b> 값을 복사하세요.<br>
      2. <b>js/firebase-config.js</b>에 붙여 넣고 저장하세요.<br>
      3. 자세한 순서는 README의 'Firebase 설정'을 보세요.</p>
      <p class="small muted">설정 없이 둘러보려면 주소 끝에 <b>?demo</b>를 붙이세요.</p>
    </div></div>`;
}

async function boot() {
  if (NEEDS_SETUP) return showSetup();
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
