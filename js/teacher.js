// 교사 화면 (명세서 2.3)
import { api } from './api.js';
import { heightM, leader, statsByStudent, suspicious, validateBook, needsPageConfirm, parseStudentLines, toCsv, numberLabel, usesHakbun, hakbunBase, hakbun, validateClassCode, genCode } from './core.js';
import { createTower } from './tower.js';
import { $, h, esc, fmtM, fmtN, fmtDate, toast, errMsg, confirmBox, renderDex, downloadCsv, qrDialog } from './ui.js';

const CLASS_KEY = 'bt_teacher_class';
const lsGet = k => { try { return localStorage.getItem(k); } catch { return null; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch { /* 무시 */ } };

function promptBox(title, placeholder = '', { value = '', ok = '만들기', max = 50 } = {}) {
  return new Promise(res => {
    const back = h(`<div class="modal-back"><form class="modal frame"><h3>${esc(title)}</h3>
      <input class="input" name="v" maxlength="${max}" placeholder="${esc(placeholder)}" value="${esc(value)}" required style="margin:8px 0">
      <div class="actions"><button type="button" class="btn" data-a="no">취소</button><button class="btn primary">${esc(ok)}</button></div></form></div>`);
    document.body.append(back);
    const f = back.querySelector('form');
    f.v.focus(); f.v.select();
    f.onsubmit = e => { e.preventDefault(); const v = f.v.value.trim(); if (!v) return; back.remove(); res(v); };
    back.addEventListener('click', e => { if (e.target.dataset?.a === 'no' || e.target === back) { back.remove(); res(null); } });
  });
}

// 새 반 만들기 창: 학년·반(선택), 반 이름, 반 코드(선생님이 정하고 중복 확인, 비우면 무작위)
function newClassDialog() {
  return new Promise(res => {
    const back = h(`<div class="modal-back"><form class="modal frame" style="text-align:left" autocomplete="off"><h3 style="text-align:center">새 반 만들기</h3>
      <div class="row"><label class="field grow"><span>학년 (선택)</span><select class="input" name="grade"><option value="">정하지 않음</option>${[1, 2, 3, 4, 5, 6].map(g => `<option value="${g}">${g}학년</option>`).join('')}</select></label>
      <label class="field grow"><span>반 (선택)</span><input class="input" name="room" type="number" inputmode="numeric" min="1" max="99" placeholder="2"></label></div>
      <p class="small muted" style="margin:-2px 0 8px">학년과 반을 정하면 학생 번호가 <b>학번</b>이 돼요 (4학년 2반 1번 → 4201). 정하지 않으면 1, 2, 3… 번호를 써요. 만든 뒤에는 바꿀 수 없어요.</p>
      <label class="field"><span>반 이름</span><input class="input" name="name" maxlength="50" required placeholder="예: 4학년 2반"></label>
      <label class="field"><span>반 코드 (6~12자, 영문 대문자+숫자)</span>
        <div class="row"><input class="input grow" name="code" maxlength="12" autocapitalize="characters" spellcheck="false" placeholder="예: MUMU42" style="letter-spacing:2px"><button type="button" class="btn small" data-a="rand">무작위</button></div></label>
      <p class="small" data-codemsg style="min-height:1.6em;margin:0 0 6px"></p>
      <p class="small warn" style="margin:0 0 6px">반 코드를 아는 사람은 이 반의 기록을 볼 수 있어요. 너무 쉬운 코드는 피해 주세요. 만든 뒤에는 바꿀 수 없어요.</p>
      <div class="actions"><button type="button" class="btn" data-a="no">취소</button><button class="btn primary">만들기</button></div></form></div>`);
    document.body.append(back);
    const f = back.querySelector('form'), msg = back.querySelector('[data-codemsg]');
    let nameTouched = false, free = null, token = 0, timer = 0;
    const say = (t, tone = '') => { msg.textContent = t; msg.className = 'small' + (tone ? ' ' + tone : ''); };
    async function check() {
      const my = ++token, code = f.code.value;
      free = null;
      if (!code) { say('비워 두면 무작위 코드가 만들어져요.', 'muted'); return; }
      const err = validateClassCode(code);
      if (err) { say(err, 'warn'); return; }
      say('확인 중…', 'muted');
      try {
        const ok = await api.isCodeFree(code);
        if (my !== token) return;                                     // 그 사이 글자가 바뀌었으면 옛 결과는 버린다
        free = ok; say(ok ? '✔ 사용할 수 있는 코드예요' : '이미 사용 중인 코드예요. 다른 코드를 정해 주세요', ok ? 'okmsg' : 'warn');
      } catch { if (my === token) say('중복을 확인하지 못했어요. 만들 때 다시 확인해요', 'muted'); }
    }
    f.code.oninput = () => { f.code.value = f.code.value.toUpperCase().replace(/[^A-Z0-9]/g, ''); clearTimeout(timer); timer = setTimeout(check, 350); };
    f.name.oninput = () => { nameTouched = true; };
    const autoName = () => { if (!nameTouched && f.grade.value && f.room.value) f.name.value = `${f.grade.value}학년 ${f.room.value}반`; };
    f.grade.onchange = autoName; f.room.oninput = autoName;
    f.grade.focus();
    f.onsubmit = async e => {
      e.preventDefault();
      if (!!f.grade.value !== !!f.room.value) return say('학년과 반을 모두 정하거나, 둘 다 비워 주세요', 'warn');
      const name = f.name.value.trim(); if (!name) return;
      if (f.code.value) {
        const err = validateClassCode(f.code.value);
        if (err) return say(err, 'warn');
        if (free === null) await check();
        if (free === false) return;
      }
      back.remove(); res({ name, code: f.code.value || undefined, grade: f.grade.value ? Number(f.grade.value) : undefined, room: f.room.value ? Number(f.room.value) : undefined });
    };
    back.addEventListener('click', async e => {
      const a = e.target.dataset?.a;
      if (a === 'rand') { let c; do { c = genCode(); } while (validateClassCode(c)); f.code.value = c; check(); }
      else if (a === 'no' || e.target === back) { back.remove(); res(null); }
    });
  });
}

export async function startTeacher(root, { user, onLogout }) {
  let classes = [], cls = null, students = [], books = [], tab = 'tower', filter = '', unsub = null, liveSig = '';
  const nl = n => numberLabel(n, cls);                                // "7번" (학번 방식 반이면 학번에서 출석번호만)
  const numHead = () => (usesHakbun(cls) ? '학번' : '번호');         // 표의 머리글

  root.innerHTML = `
  <div class="app">
    <div class="header">
      <span class="title">무한의 책탑</span>
      <select class="input" style="width:auto" data-x="sel"></select>
      <button class="btn small" data-x="new">＋ 새 반</button>
      <span class="small muted">반 코드</span><span class="code" data-x="code">------</span>
      <button class="btn small" data-x="qr" title="학생 입장 QR 코드">QR</button>
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
        <form class="frame" data-x="mybook" autocomplete="off">
          <h2>선생님도 책 쌓기</h2>
          <label class="field"><span>책 제목</span><input class="input" name="title" maxlength="100" required></label>
          <label class="field"><span>읽은 쪽수 (1~3000)</span><input class="input" name="pages" type="number" inputmode="numeric" min="1" max="3000" step="1" required></label>
          <label class="field"><span>한 줄 느낌 (꼭 적어 주세요)</span><input class="input" name="note" maxlength="200" required></label>
          <button class="btn primary" style="width:100%">쌓기!</button>
          <p class="small muted" style="margin:6px 0 0">처음 쌓으면 학생 명단에 '선생님'이 등록돼요.</p>
        </form>
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
  let visitText = '';
  api.visits?.({ count: false }).then(v => { if (!v) return; visitText = `방문 오늘 ${fmtN(v.today)} · 누적 ${fmtN(v.total)}`; const el = X('visits'); if (el) el.textContent = visitText; }).catch(() => {});

  // 선생님도 학생처럼 책을 쌓는다: 처음이면 '선생님'을 학생으로 등록(99번부터 거꾸로 빈 번호)하고 그 번호로 쌓는다
  X('mybook').onsubmit = async e => {
    e.preventDefault();
    const f = e.target, v = validateBook({ title: f.title.value, pages: f.pages.value, note: f.note.value });
    if (v.error) return toast(v.error);
    const btn = f.querySelector('button'); btn.disabled = true;
    try {
      if (needsPageConfirm(v.pages) && !await confirmBox(`「${v.title}」 ${fmtN(v.pages)}쪽이 맞나요?\n쪽수를 잘못 쓰면 탑이 엄청 높아져요.`, '맞아요', { cancel: '다시 쓸게요', tone: 'primary' })) return;
      let me = students.find(s => s.name === '선생님' && !s.left);
      if (!me) {
        const base = hakbunBase(cls), used = new Set(students.map(s => s.number));
        let seat = 99; while (seat > 1 && used.has(base + seat)) seat--;
        me = { number: base + seat };
        await api.addStudents(cls.id, [{ number: me.number, name: '선생님' }]);
      }
      await api.addBook(cls.code, me.number, v);
      f.reset(); toast(`「${v.title}」 ${v.pages}쪽을 쌓았어요!`); await reload();
    } catch (err) { toast(errMsg(err)); } finally { btn.disabled = false; }
  };

  X('qr').onclick = () => {
    if (!cls) return;
    const u = new URL(location.href); u.search = ''; u.hash = '';
    for (const k of ['demo', 'emulator']) if (new URL(location.href).searchParams.has(k)) u.searchParams.set(k, '');
    u.searchParams.set('code', cls.code);
    qrDialog(cls.code, u.href);
  };
  X('logout').onclick = async () => { unsub?.(); unsub = null; await api.signOut(); onLogout(); };
  X('new').onclick = async () => {
    const v = await newClassDialog();
    if (!v) return;
    try { const c = await api.createClass(v.name, { code: v.code, grade: v.grade, room: v.room }); classes.push(c); await selectClass(c.id); toast(`「${v.name}」을 만들었어요. 반 코드: ${c.code}`); }
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
    X('qr').disabled = !cls;
    if (!cls) { renderEmpty(); showTab(tab); return; }
    lsSet(CLASS_KEY, cls.id);
    [students, books] = await Promise.all([api.listStudents(cls.id), api.listBooks(cls.id)]);
    showTab(tab);
    renderAll({ reset });
    watchLive();
  }

  // 학생이 책을 쌓거나 고치면 선생님 화면도 바로 바뀐다 (책탑·기록 점검·학생 목록)
  async function watchLive() {
    unsub?.(); unsub = null; liveSig = '';
    if (!cls) return;
    const id = cls.id;
    try {
      unsub = await api.subscribeClass(cls.code, snap => {
        if (!cls || cls.id !== id || !snap.cls) return;
        const sig = JSON.stringify([snap.cls.name, snap.cls.goal_m, snap.books.length, snap.books.at(-1)?.id,
          snap.books.reduce((a, b) => a + b.pages * 31 + b.title.length + (b.note || '').length, 0), snap.students.map(s => `${s.id}${s.name}${s.left ? 1 : 0}`).join()]);
        if (sig === liveSig) return;
        const firstTick = liveSig === ''; liveSig = sig;
        if (firstTick) return;                                  // 처음 한 번은 방금 불러온 것과 같으므로 건너뜀
        Object.assign(cls, { name: snap.cls.name, goal_m: snap.cls.goal_m });
        students = snap.students; books = snap.books;
        renderTower(false); renderCheck();
        const ta = X('names'); if (!ta || (!ta.value && document.activeElement !== ta)) renderStudents();   // 입력 중인 글을 지우지 않는다
      });
    } catch { /* 실시간 연결이 안 돼도 화면은 그대로 쓸 수 있다 */ }
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
    tower.update({ books, cmPerPage: cm, goalM: goal, mode: 'class', numberOf: id => num.get(id), nameOf: id => { const s = students.find(x => x.id === id); return s ? `${nl(s.number)} ${s.name}` : ''; }, leader: leader(students, books) }, { reset });
    const pages = books.reduce((s, b) => s + b.pages, 0), M = heightM(pages, cm);
    const pct = goal > 0 ? Math.min(100, M / goal * 100) : 0;
    const L = tower.layout;
    X('summary').innerHTML = `<h2>${esc(cls.name)}</h2>
      <div class="stat"><span>높이</span><b>${fmtM(M)}</b></div>
      <div class="stat"><span>쪽수 · 권수</span><span>${fmtN(pages)}쪽 · ${fmtN(books.length)}권</span></div>
      <div class="small" style="margin-top:6px">목표 ${fmtM(goal)} 중 ${Math.floor(pct)}%</div>
      <div class="bar"><i style="width:${pct}%"></i></div>
      ${L && !L.allDone ? `<p class="small" style="margin:8px 0 0">다음 목표 <b>${esc(L.next.name)}</b>까지 <b>${fmtM(L.landmark.remainingM)}</b></p>` : ''}
      <p class="small muted" style="margin:8px 0 0">환산 비율: 1쪽 = ${cm}cm (100쪽 = ${fmtM(cm)})</p>
      <p class="small muted" style="margin:2px 0 0" data-x="visits">${visitText}</p>
      <button class="btn small" style="margin-top:10px" data-x="tvbtn">📺 교실 TV로 열기</button>`;
    X('tvbtn').onclick = () => { const u = new URL(location.href); u.search = ''; for (const k of ['demo', 'emulator']) if (new URL(location.href).searchParams.has(k)) u.searchParams.set(k, ''); u.searchParams.set('tv', cls.code); window.open(u.toString(), '_blank'); };
    if (L) renderDex(X('dex'), L.reachedCount);
  }

  function renderCheck() {
    const cm = Number(cls.cm_per_page);
    const rows = statsByStudent(students, books).sort((a, b) => a.s.number - b.s.number);
    const name = new Map(students.map(s => [s.id, s]));
    const list = books.filter(b => !filter || b.student_id === filter).sort((a, b) => b.created_at.localeCompare(a.created_at));
    const nWarn = books.filter(suspicious).length;
    P('check').innerHTML = `
      <div class="frame" style="margin-bottom:12px"><div class="row" style="margin-bottom:8px"><h2 class="grow" style="margin:0">학생별 현황</h2><button class="btn small" data-x="csv1">CSV 받기</button></div><div class="scroll-x"><table class="grid">
        <tr><th>${numHead()}</th><th>이름</th><th>책 수</th><th>쪽수 합</th><th>높이</th><th>마지막 입력</th><th></th></tr>
        ${rows.map(r => `<tr><td class="num">${r.s.number}</td><td>${esc(r.s.name)}${r.s.left ? ' <span class="muted">(전학)</span>' : ''}</td><td class="num">${r.count}</td><td class="num">${fmtN(r.pages)}</td>
          <td class="num">${fmtM(heightM(r.pages, cm))}</td><td>${r.last ? fmtDate(r.last) : '<span class="warn">미입력</span>'}</td>
          <td><button class="btn small" data-view="${r.s.id}">기록 보기</button></td></tr>`).join('')}
        ${rows.length ? '' : '<tr><td colspan="7" class="muted">학생 탭에서 학생을 등록해 주세요</td></tr>'}
      </table></div></div>
      <div class="frame"><div class="row" style="margin-bottom:8px;flex-wrap:wrap"><h2 class="grow" style="margin:0">전체 기록 ${nWarn ? `<span class="warn small">⚠️ 확인 필요 ${nWarn}건</span>` : ''}</h2>
        <button class="btn small" data-x="csv2">CSV 받기</button>
        <select class="input" style="width:auto" data-x="filter"><option value="">전체 학생</option>
        ${students.map(s => `<option value="${s.id}" ${s.id === filter ? 'selected' : ''}>${nl(s.number)} ${esc(s.name)}${s.left ? ' (전학)' : ''}</option>`).join('')}</select></div>
        <div class="scroll-x"><table class="grid"><tr><th>날짜</th><th>학생</th><th>제목</th><th>쪽수</th><th>한 줄 느낌</th><th></th></tr>
        ${list.map(b => { const s = name.get(b.student_id); const w = suspicious(b);
          return `<tr${w ? ' style="background:#fff0ee"' : ''}><td>${fmtDate(b.created_at)}</td><td>${s ? `${s.number}. ${esc(s.name)}` : ''}</td>
          <td>${w ? '⚠️ ' : ''}${esc(b.title)}</td><td class="num${b.pages >= 800 ? ' warn' : ''}">${fmtN(b.pages)}</td><td class="small">${esc(b.note || '')}</td>
          <td><button class="btn small danger" data-del="${b.id}">삭제</button></td></tr>`; }).join('')}
        ${list.length ? '' : '<tr><td colspan="6" class="muted">기록이 없어요</td></tr>'}
        </table></div></div>`;
    X('filter').onchange = e => { filter = e.target.value; renderCheck(); };
    P('check').querySelectorAll('[data-view]').forEach(btn => btn.onclick = () => {
      filter = btn.dataset.view; renderCheck(); X('filter').scrollIntoView({ behavior: 'smooth', block: 'start' });   // 그 학생의 기록만 모아서 보고, 잘못된 것은 삭제
    });
    const ymd = iso => new Date(iso).toLocaleDateString('sv-SE');
    const fname = kind => `${cls.name.replace(/[\\/:*?"<>|]/g, '_')}_${kind}.csv`;
    X('csv1').onclick = () => {
      const out = [[numHead(), '이름', '상태', '책 수', '쪽수 합', '높이(m)', '마지막 입력']];
      rows.forEach(r => out.push([r.s.number, r.s.name, r.s.left ? '전학' : '', r.count, r.pages, Math.round(heightM(r.pages, cm) * 100) / 100, r.last ? ymd(r.last) : '']));
      downloadCsv(fname('학생별_요약'), toCsv(out)); toast('학생별 요약을 내려받았어요');
    };
    X('csv2').onclick = () => {
      const out = [['날짜', numHead(), '이름', '책 제목', '쪽수', '한 줄 느낌']];
      books.slice().sort((a, b) => a.created_at.localeCompare(b.created_at)).forEach(b => { const s = name.get(b.student_id); out.push([ymd(b.created_at), s?.number ?? '', s?.name ?? '', b.title, b.pages, b.note || '']); });
      downloadCsv(fname('전체_기록'), toCsv(out)); toast('전체 기록을 내려받았어요');
    };
    P('check').querySelectorAll('[data-del]').forEach(btn => btn.onclick = async () => {
      const b = books.find(x => x.id === btn.dataset.del), s = name.get(b.student_id);
      if (!await confirmBox(`${s ? s.name + ' 학생의 ' : ''}「${b.title}」 (${b.pages}쪽) 기록을 삭제할까요?`)) return;
      try { await api.deleteBook(cls.id, b.id); toast('삭제했어요'); await reload(); } catch (e) { toast(errMsg(e)); }
    });
  }

  function renderStudents() {
    const cnt = new Map(); books.forEach(b => cnt.set(b.student_id, (cnt.get(b.student_id) || 0) + 1));
    const base = hakbunBase(cls), inBlock = students.map(s => s.number).filter(n => !base || (n > base && n <= base + 99));
    const nextNo = (inBlock.length ? Math.max(...inBlock) - base : 0) + 1;
    const nLeft = students.filter(s => s.left).length;
    P('students').innerHTML = `
      <div class="frame" style="margin-bottom:12px;max-width:640px"><h2>학생 등록</h2>
        <p class="small muted" style="margin-top:0">이름을 한 줄에 한 명씩 적으세요. 번호를 안 쓰면 <b>${nextNo}번</b>부터 차례로 붙고,
        <b>7 박서연</b>처럼 앞에 번호를 쓰면 그 번호로 등록해요.
        ${usesHakbun(cls) ? `<br>학번 방식이에요: 번호 <b>1</b>번은 학번 <b>${hakbun(cls.grade, cls.room, 1)}</b>이 되고, 학생은 학번(또는 번호만)을 입력해 들어와요.` : ''}</p>
        <p class="small muted">이름은 <b>별명이나 이니셜(예: 김하)</b>로 등록해도 돼요. 이름 말고 다른 개인정보는 받지 않아요.</p>
        <textarea class="input" rows="6" data-x="names" placeholder="김하늘&#10;이도윤&#10;7 박서연"></textarea>
        <div class="row" style="margin-top:8px;flex-wrap:wrap"><button class="btn primary" data-x="add">등록</button></div></div>
      <div class="frame" style="max-width:640px"><div class="row" style="flex-wrap:wrap;margin-bottom:6px"><h2 class="grow" style="margin:0">학생 목록 (${students.length}명${nLeft ? ` · 전학 ${nLeft}명` : ''})</h2>
</div>
        <p class="small muted" style="margin-top:0">전학 간 친구는 <b>전학</b>을 누르세요. 입장이 막히고 다독왕에서 빠지지만, 쌓은 책은 반 탑에 남아요.
        새로 온 친구는 새 번호로 등록하세요 (옛 번호를 이어 쓰지 않아요).</p>
        <div class="scroll-x"><table class="grid"><tr><th>${numHead()}</th><th>이름</th><th>책</th><th></th></tr>
        ${students.map(s => `<tr${s.left ? ' style="opacity:.6"' : ''}><td class="num">${s.number}</td>
          <td>${esc(s.name)}${s.left ? ' <span class="warn small">전학</span>' : ''}</td><td class="num">${cnt.get(s.id) || 0}권</td>
          <td style="white-space:nowrap"><button class="btn small" data-srename="${s.id}">이름</button>
            <button class="btn small" data-sleft="${s.id}">${s.left ? '복귀' : '전학'}</button>
            <button class="btn small danger" data-sdel="${s.id}">삭제</button></td></tr>`).join('')}
        ${students.length ? '' : `<tr><td colspan="4" class="muted">아직 학생이 없어요</td></tr>`}</table></div></div>`;
    X('add').onclick = async () => {
      const r = parseStudentLines(X('names').value, students.map(s => s.number), hakbunBase(cls));
      if (r.error) return toast(r.error);
      try { await api.addStudents(cls.id, r.entries); toast(`${r.entries.length}명을 등록했어요 (${r.entries.map(e => e.number).join(', ')}${usesHakbun(cls) ? '' : '번'})`); await reload(); } catch (e) { toast(errMsg(e)); }
    };
    P('students').querySelectorAll('[data-srename]').forEach(btn => btn.onclick = async () => {
      const s = students.find(x => x.id === btn.dataset.srename);
      const name = await promptBox(`${nl(s.number)} 이름 고치기`, '', { value: s.name, ok: '저장', max: 30 });
      if (!name || name === s.name) return;
      try { await api.renameStudent(cls.id, s.id, name); toast('이름을 고쳤어요'); await reload(); } catch (e) { toast(errMsg(e)); }
    });
    P('students').querySelectorAll('[data-sleft]').forEach(btn => btn.onclick = async () => {
      const s = students.find(x => x.id === btn.dataset.sleft), to = !s.left;
      if (to && !await confirmBox(`${nl(s.number)} ${s.name} 학생을 전학 처리할까요?\n이 번호로는 입장할 수 없고 다독왕에서 빠져요.\n쌓은 책 ${cnt.get(s.id) || 0}권은 반 탑에 그대로 남아요.`, '전학 처리')) return;
      try { await api.setStudentLeft(cls.id, s.id, to); toast(to ? '전학 처리했어요' : '다시 반에 넣었어요'); await reload(); } catch (e) { toast(errMsg(e)); }
    });
    P('students').querySelectorAll('[data-sdel]').forEach(btn => btn.onclick = async () => {
      const s = students.find(x => x.id === btn.dataset.sdel), n = cnt.get(s.id) || 0;
      if (!await confirmBox(`${nl(s.number)} ${s.name} 학생을 완전히 삭제할까요?\n이 학생이 쌓은 책 ${n}권도 함께 삭제되고, 반 탑이 낮아져요.\n(전학이라면 삭제 대신 '전학'을 쓰세요)`)) return;
      try { await api.deleteStudent(cls.id, s.id); toast('삭제했어요'); await reload(); } catch (e) { toast(errMsg(e)); }
    });
  }

  // 이름을 그대로 적어야 진행되는 확인 (되돌릴 수 없는 일)
  async function typedConfirm(message, okLabel) {
    const v = await promptBox(message, cls.name, { ok: okLabel });
    if (v == null) return false;
    if (v !== cls.name) { toast('반 이름이 달라서 취소했어요'); return false; }
    return true;
  }

  function renderSettings() {
    P('settings').innerHTML = `<form class="frame" style="max-width:460px;margin-bottom:12px" data-x="setform">
      <h2>설정</h2>
      <label class="field"><span>학급 이름</span><input class="input" name="cname" maxlength="50" required value="${esc(cls.name)}"></label>
      <label class="field"><span>우리 반 목표 높이 (m)</span><input class="input" name="goal" type="number" min="1" step="any" required value="${cls.goal_m}"></label>
      <p class="small muted">학생 입장용 반 코드: <b class="code" style="padding:0 6px">${esc(cls.code)}</b></p>
      ${usesHakbun(cls) ? `<p class="small muted">학번 방식: ${cls.grade}학년 ${cls.room}반 (예: 1번 → ${hakbun(cls.grade, cls.room, 1)})</p>` : ''}
      <button class="btn primary">저장</button></form>
      <div class="frame" style="max-width:460px"><h2>반 관리</h2>
        <p class="small muted" style="margin-top:0">지우기 전에 <b>기록 점검</b> 탭에서 CSV로 받아 두세요.</p>
        <p class="small"><b>새 학기 준비</b> — 책 기록만 모두 지우고, 반과 학생은 그대로 둬요.</p>
        <button class="btn danger" data-x="clearbooks">책 기록 모두 지우기</button>
        <p class="small" style="margin-top:16px"><b>반 삭제</b> — 반, 학생, 책 기록이 모두 사라져요. 되돌릴 수 없어요.</p>
        <button class="btn danger" data-x="delclass">이 반 삭제하기</button></div>`;
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
    X('clearbooks').onclick = async () => {
      if (!await typedConfirm(`책 기록 ${books.length}권을 모두 지워요. 계속하려면 반 이름을 그대로 적어 주세요.`, '모두 지우기')) return;
      try { await api.clearBooks(cls.id); toast('책 기록을 모두 지웠어요'); await reload(); } catch (err) { toast(errMsg(err)); }
    };
    X('delclass').onclick = async () => {
      if (!await typedConfirm(`「${cls.name}」 반과 학생, 책 기록이 모두 사라져요. 계속하려면 반 이름을 그대로 적어 주세요.`, '반 삭제')) return;
      try {
        await api.deleteClass(cls.id);
        classes = classes.filter(c => c.id !== cls.id);
        toast('반을 삭제했어요');
        await selectClass(classes[0]?.id);
      } catch (err) { toast(errMsg(err)); }
    };
  }

  try {
    classes = await api.listClasses();
    const saved = lsGet(CLASS_KEY);
    await selectClass((classes.find(c => c.id === saved) || classes[0])?.id);
  } catch (e) { toast(errMsg(e)); }
}
