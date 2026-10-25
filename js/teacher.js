// 교사 화면 (명세서 2.3)
import { api } from './api.js';
import { heightM, leader, statsByStudent, suspicious } from './core.js';
import { createTower } from './tower.js';
import { $, h, esc, fmtM, fmtN, fmtDate, toast, errMsg, confirmBox, renderDex } from './ui.js';

const CLASS_KEY = 'bt_teacher_class';
const lsGet = k => { try { return localStorage.getItem(k); } catch { return null; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch { /* 무시 */ } };

function promptBox(title, placeholder = '') {
  return new Promise(res => {
    const back = h(`<div class="modal-back"><form class="modal frame"><h3>${esc(title)}</h3>
      <input class="input" name="v" maxlength="50" placeholder="${esc(placeholder)}" required style="margin:8px 0">
      <div class="actions"><button type="button" class="btn" data-a="no">취소</button><button class="btn primary">만들기</button></div></form></div>`);
    document.body.append(back);
    const f = back.querySelector('form');
    f.v.focus();
    f.onsubmit = e => { e.preventDefault(); const v = f.v.value.trim(); if (!v) return; back.remove(); res(v); };
    back.addEventListener('click', e => { if (e.target.dataset?.a === 'no' || e.target === back) { back.remove(); res(null); } });
  });
}

export async function startTeacher(root, { user, onLogout }) {
  let classes = [], cls = null, students = [], books = [], tab = 'tower', filter = '';

  root.innerHTML = `
  <div class="app">
    <div class="header">
      <span class="title">무한의 책탑</span>
      <select class="input" style="width:auto" data-x="sel"></select>
      <button class="btn small" data-x="new">＋ 새 반</button>
      <span class="small muted">반 코드</span><span class="code" data-x="code">------</span>
      <span class="spacer"></span>
      <span class="small muted">${esc(user.email || '')}</span>
      <button class="btn small" data-x="logout">로그아웃</button>
    </div>
    <div style="padding:8px 12px 0" class="tabs" data-x="tabs">
      <button class="tab on" data-t="tower">책탑</button>
      <button class="tab" data-t="check">기록 점검</button>
      <button class="tab" data-t="students">학생</button>
      <button class="tab" data-t="settings">설정</button>
    </div>
    <div class="main" data-p="tower">
      <div class="tower-col"><div data-x="tower"></div></div>
      <div class="side">
        <div class="frame" data-x="summary"></div>
        <div class="frame"><h2>랜드마크 도감</h2><div class="dex" data-x="dex"></div></div>
      </div>
    </div>
    <div class="page hidden" data-p="check"></div>
    <div class="page hidden" data-p="students"></div>
    <div class="page hidden" data-p="settings"></div>
    <div class="page hidden" data-p="empty"></div>
  </div>`;
  const X = k => $(`[data-x="${k}"]`, root);
  const P = k => $(`[data-p="${k}"]`, root);
  const towerEl = X('tower');
  const tower = createTower(towerEl);

  X('logout').onclick = async () => { await api.signOut(); onLogout(); };
  X('new').onclick = async () => {
    const name = await promptBox('새 반 만들기', '예: 4학년 2반');
    if (!name) return;
    try { const c = await api.createClass(name); classes.push(c); await selectClass(c.id); toast(`「${name}」을 만들었어요. 반 코드: ${c.code}`); }
    catch (e) { toast(errMsg(e)); }
  };
  X('sel').onchange = e => selectClass(e.target.value);
  X('tabs').onclick = e => { const t = e.target.dataset?.t; if (t) showTab(t); };

  function showTab(t) {
    tab = t;
    root.querySelectorAll('[data-t]').forEach(b => b.classList.toggle('on', b.dataset.t === t));
    for (const p of ['tower', 'check', 'students', 'settings', 'empty']) P(p).classList.toggle('hidden', !cls ? p !== 'empty' : p !== t);
    X('tabs').classList.toggle('hidden', !cls);
  }

  async function selectClass(id, { reset = true } = {}) {
    cls = classes.find(c => c.id === id) || null;
    X('sel').innerHTML = classes.map(c => `<option value="${c.id}" ${c.id === cls?.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('');
    X('sel').classList.toggle('hidden', !classes.length);
    X('code').textContent = cls?.code || '------';
    if (!cls) { renderEmpty(); showTab(tab); return; }
    lsSet(CLASS_KEY, cls.id);
    [students, books] = await Promise.all([api.listStudents(cls.id), api.listBooks(cls.id)]);
    showTab(tab);
    renderAll({ reset });
  }

  async function reload() { await selectClass(cls.id, { reset: false }); }

  function renderAll({ reset = false } = {}) {
    renderTower(reset); renderCheck(); renderStudents(); renderSettings();
  }

  function renderEmpty() {
    P('empty').innerHTML = `<div class="frame" style="max-width:420px;margin:40px auto;text-align:center">
      <h2>아직 만든 반이 없어요</h2><p class="muted">반을 만들면 학생 입장용 반 코드가 생겨요.</p>
      <button class="btn primary">＋ 새 반 만들기</button></div>`;
    P('empty').querySelector('button').onclick = () => X('new').click();
  }

  function renderTower(reset) {
    const cm = Number(cls.cm_per_page), goal = Number(cls.goal_m);
    const num = new Map(students.map(s => [s.id, s.number]));
    tower.update({ books, cmPerPage: cm, goalM: goal, mode: 'class', numberOf: id => num.get(id), nameOf: id => { const s = students.find(x => x.id === id); return s ? `${s.number}번 ${s.name}` : ''; }, leader: leader(students, books) }, { reset });
    const pages = books.reduce((s, b) => s + b.pages, 0), M = heightM(pages, cm);
    const pct = goal > 0 ? Math.min(100, M / goal * 100) : 0;
    const L = tower.layout;
    X('summary').innerHTML = `<h2>${esc(cls.name)}</h2>
      <div class="stat"><span>높이</span><b>${fmtM(M)}</b></div>
      <div class="stat"><span>쪽수 · 권수</span><span>${fmtN(pages)}쪽 · ${fmtN(books.length)}권</span></div>
      <div class="small" style="margin-top:6px">목표 ${fmtM(goal)} 중 ${Math.floor(pct)}%</div>
      <div class="bar"><i style="width:${pct}%"></i></div>
      ${L && !L.allDone ? `<p class="small" style="margin:8px 0 0">다음 목표 <b>${esc(L.next.name)}</b>까지 <b>${fmtM(L.landmark.remainingM)}</b></p>` : ''}`;
    if (L) renderDex(X('dex'), L.reachedCount);
  }

  function renderCheck() {
    const cm = Number(cls.cm_per_page);
    const rows = statsByStudent(students, books).sort((a, b) => a.s.number - b.s.number);
    const name = new Map(students.map(s => [s.id, s]));
    const list = books.filter(b => !filter || b.student_id === filter).sort((a, b) => b.created_at.localeCompare(a.created_at));
    const nWarn = books.filter(suspicious).length;
    P('check').innerHTML = `
      <div class="frame" style="margin-bottom:12px"><h2>학생별 현황</h2><div class="scroll-x"><table class="grid">
        <tr><th>번호</th><th>이름</th><th>책 수</th><th>쪽수 합</th><th>높이</th><th>마지막 입력</th></tr>
        ${rows.map(r => `<tr><td class="num">${r.s.number}</td><td>${esc(r.s.name)}</td><td class="num">${r.count}</td><td class="num">${fmtN(r.pages)}</td>
          <td class="num">${fmtM(heightM(r.pages, cm))}</td><td>${r.last ? fmtDate(r.last) : '<span class="warn">미입력</span>'}</td></tr>`).join('')}
        ${rows.length ? '' : '<tr><td colspan="6" class="muted">학생 탭에서 학생을 등록해 주세요</td></tr>'}
      </table></div></div>
      <div class="frame"><div class="row" style="margin-bottom:8px;flex-wrap:wrap"><h2 class="grow" style="margin:0">전체 기록 ${nWarn ? `<span class="warn small">⚠️ 확인 필요 ${nWarn}건</span>` : ''}</h2>
        <select class="input" style="width:auto" data-x="filter"><option value="">전체 학생</option>
        ${students.map(s => `<option value="${s.id}" ${s.id === filter ? 'selected' : ''}>${s.number}번 ${esc(s.name)}</option>`).join('')}</select></div>
        <div class="scroll-x"><table class="grid"><tr><th>날짜</th><th>학생</th><th>제목</th><th>쪽수</th><th>한 줄 느낌</th><th></th></tr>
        ${list.map(b => { const s = name.get(b.student_id); const w = suspicious(b);
          return `<tr${w ? ' style="background:#fff0ee"' : ''}><td>${fmtDate(b.created_at)}</td><td>${s ? `${s.number}. ${esc(s.name)}` : ''}</td>
          <td>${w ? '⚠️ ' : ''}${esc(b.title)}</td><td class="num${b.pages >= 800 ? ' warn' : ''}">${fmtN(b.pages)}</td><td class="small">${esc(b.note || '')}</td>
          <td><button class="btn small danger" data-del="${b.id}">삭제</button></td></tr>`; }).join('')}
        ${list.length ? '' : '<tr><td colspan="6" class="muted">기록이 없어요</td></tr>'}
        </table></div></div>`;
    X('filter').onchange = e => { filter = e.target.value; renderCheck(); };
    P('check').querySelectorAll('[data-del]').forEach(btn => btn.onclick = async () => {
      const b = books.find(x => x.id === btn.dataset.del), s = name.get(b.student_id);
      if (!await confirmBox(`${s ? s.name + ' 학생의 ' : ''}「${b.title}」 (${b.pages}쪽) 기록을 삭제할까요?`)) return;
      try { await api.deleteBook(b.id); toast('삭제했어요'); await reload(); } catch (e) { toast(errMsg(e)); }
    });
  }

  function renderStudents() {
    const cnt = new Map(); books.forEach(b => cnt.set(b.student_id, (cnt.get(b.student_id) || 0) + 1));
    P('students').innerHTML = `
      <div class="frame" style="margin-bottom:12px;max-width:560px"><h2>학생 일괄 등록</h2>
        <p class="small muted" style="margin-top:0">이름을 한 줄에 한 명씩 붙여 넣으세요. 번호는 ${students.length ? Math.max(...students.map(s => s.number)) + 1 : 1}번부터 자동으로 붙어요.</p>
        <textarea class="input" rows="6" data-x="names" placeholder="김하늘&#10;이도윤&#10;박서연"></textarea>
        <button class="btn primary" style="margin-top:8px" data-x="add">등록</button></div>
      <div class="frame" style="max-width:560px"><h2>학생 목록 (${students.length}명)</h2>
        <table class="grid"><tr><th>번호</th><th>이름</th><th>책</th><th></th></tr>
        ${students.map(s => `<tr><td class="num">${s.number}</td><td>${esc(s.name)}</td><td class="num">${cnt.get(s.id) || 0}권</td>
          <td><button class="btn small danger" data-sdel="${s.id}">삭제</button></td></tr>`).join('')}
        ${students.length ? '' : '<tr><td colspan="4" class="muted">아직 학생이 없어요</td></tr>'}</table></div>`;
    X('add').onclick = async () => {
      const names = X('names').value.split('\n').map(s => s.trim()).filter(Boolean).map(s => s.slice(0, 30));
      if (!names.length) return toast('이름을 한 줄에 한 명씩 적어 주세요');
      try { await api.addStudents(cls.id, names); toast(`${names.length}명을 등록했어요`); await reload(); } catch (e) { toast(errMsg(e)); }
    };
    P('students').querySelectorAll('[data-sdel]').forEach(btn => btn.onclick = async () => {
      const s = students.find(x => x.id === btn.dataset.sdel), n = cnt.get(s.id) || 0;
      if (!await confirmBox(`${s.number}번 ${s.name} 학생을 삭제할까요?\n이 학생이 쌓은 책 ${n}권도 함께 삭제돼요.`)) return;
      try { await api.deleteStudent(s.id); toast('삭제했어요'); await reload(); } catch (e) { toast(errMsg(e)); }
    });
  }

  function renderSettings() {
    P('settings').innerHTML = `<form class="frame" style="max-width:420px" data-x="setform">
      <h2>설정</h2>
      <label class="field"><span>학급 이름</span><input class="input" name="cname" maxlength="50" required value="${esc(cls.name)}"></label>
      <label class="field"><span>우리 반 목표 높이 (m)</span><input class="input" name="goal" type="number" min="1" step="any" required value="${cls.goal_m}"></label>
      <p class="small muted">학생 입장용 반 코드: <b class="code" style="padding:0 6px">${esc(cls.code)}</b></p>
      <button class="btn primary">저장</button></form>`;
    X('setform').onsubmit = async e => {
      e.preventDefault();
      const f = e.target, name = f.cname.value.trim(), goal_m = Number(f.goal.value);
      if (!name || !(goal_m > 0)) return toast('값을 다시 확인해 주세요');
      try {
        await api.updateClass(cls.id, { name, goal_m });
        Object.assign(cls, { name, goal_m });
        toast('저장했어요');
        await reload();
      } catch (err) { toast(errMsg(err)); }
    };
  }

  try {
    classes = await api.listClasses();
    const saved = lsGet(CLASS_KEY);
    await selectClass((classes.find(c => c.id === saved) || classes[0])?.id);
  } catch (e) { toast(errMsg(e)); }
}
