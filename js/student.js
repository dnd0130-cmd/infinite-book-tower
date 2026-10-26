// 학생 화면 (명세서 2.2)
import { api } from './api.js';
import { heightM, leader, newlyReached, seenKey, validateBook, sortBooks, needsPageConfirm, goalCheck, numberLabel } from './core.js';
import { createTower } from './tower.js';
import { icon } from './assets.js';
import { $, h, esc, fmtM, fmtN, fmtDate, toast, errMsg, confirmBox, renderDex, breakthroughPopup, showBookNote, editBookModal, goalPopup } from './ui.js';

const REFRESH_MS = 30000;
const store = {
  get(k) { try { const v = localStorage.getItem(k); return v == null ? null : Number(v); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, String(v)); } catch { /* 저장 불가 환경은 무시 */ } },
};

export async function startStudent(root, { code, number, pin, data, onLogout }) {
  let mode = 'class', timer = 0, busy = false, goalState = { reached: false, goal: 0 };

  root.innerHTML = `
  <div class="app">
    <div class="header">
      <span class="title">무한의 책탑</span>
      <span class="muted" data-x="who"></span>
      <span class="spacer"></span>
      <button class="btn small" data-x="logout">나가기</button>
    </div>
    <div class="main">
      <div class="tower-col">
        <div class="tabs" style="margin-bottom:-3px;position:relative;z-index:1">
          <button class="tab on" data-mode="class">우리 반 탑</button>
          <button class="tab" data-mode="me">내 탑</button>
        </div>
        <div data-x="tower"></div>
      </div>
      <div class="side">
        <div class="frame" data-x="summary"></div>
        <form class="frame" data-x="form" autocomplete="off">
          <h2>${icon('booksIcon')} 읽은 책 쌓기</h2>
          <label class="field"><span>책 제목</span><input class="input" name="title" maxlength="100" required></label>
          <label class="field"><span>읽은 쪽수 (1~3000)</span><input class="input" name="pages" type="number" inputmode="numeric" min="1" max="3000" step="1" required></label>
          <label class="field"><span>한 줄 느낌 (꼭 적어 주세요)</span><input class="input" name="note" maxlength="200" required></label>
          <button class="btn primary" style="width:100%">쌓기!</button>
        </form>
        <div class="frame"><h2>내가 쌓은 책</h2><ul class="booklist" data-x="mine"></ul></div>
        <div class="frame"><h2>랜드마크 도감</h2><div class="small muted" data-x="dexlabel"></div><div class="dex" data-x="dex"></div></div>
      </div>
    </div>
  </div>`;
  const X = k => $(`[data-x="${k}"]`, root);
  const towerEl = X('tower');
  const tower = createTower(towerEl);

  X('logout').onclick = () => { clearInterval(timer); onLogout(); };
  root.querySelectorAll('.tab').forEach(t => t.onclick = () => {
    mode = t.dataset.mode;
    root.querySelectorAll('.tab').forEach(x => x.classList.toggle('on', x === t));
    render({ reset: true });
  });

  X('form').onsubmit = async e => {
    e.preventDefault();
    const f = e.target, v = validateBook({ title: f.title.value, pages: f.pages.value, note: f.note.value });
    if (v.error) return toast(v.error);
    const btn = f.querySelector('button'); btn.disabled = true;
    try {
      if (needsPageConfirm(v.pages) && !await confirmBox(`「${v.title}」 ${fmtN(v.pages)}쪽이 맞나요?\n쪽수를 잘못 쓰면 탑이 엄청 높아져요.`, '맞아요', { cancel: '다시 쓸게요', tone: 'primary' })) {
        f.pages.focus(); f.pages.select();
        return;
      }
      await api.addBook(code, number, v);
      f.reset();
      toast(`「${v.title}」 ${v.pages}쪽을 쌓았어요!`);
      await reload();
    } catch (err) { toast(errMsg(err)); } finally { btn.disabled = false; }
  };

  function render({ reset = false } = {}) {
    const { cls, me, students } = data;
    const cm = Number(cls.cm_per_page), goal = Number(cls.goal_m);
    const numberOf = new Map(students.map(s => [s.id, s.number]));
    const mine = data.books.filter(b => b.student_id === me.id);
    const books = mode === 'class' ? data.books : mine;
    X('who').textContent = `${cls.name} · ${numberLabel(me.number, cls)} ${me.name}`;

    tower.update({
      books, cmPerPage: cm, goalM: goal, mode,
      numberOf: id => numberOf.get(id),
      nameOf: id => id === me.id ? '나' : `${numberLabel(numberOf.get(id) ?? 0, cls)} ${students.find(s => s.id === id)?.name ?? ''}`.trim(),
      leader: leader(students, data.books),
    }, { reset });
    const L = tower.layout;

    // 요약
    const sum = arr => arr.reduce((s, b) => s + b.pages, 0);
    const cp = sum(data.books), mp = sum(mine), cM = heightM(cp, cm), mM = heightM(mp, cm);
    const pct = goal > 0 ? Math.min(100, cM / goal * 100) : 0;
    const nextTxt = !L ? '' : L.allDone ? `${icon('star')} 모든 랜드마크를 넘었어요!`
      : `${mode === 'class' ? '우리 반' : '내 탑'} 다음 목표 <b>${esc(L.next.name)}</b>까지 <b>${fmtM(L.landmark.remainingM)}</b>`;
    X('summary').innerHTML = `
      <h2>우리 반 책탑</h2>
      <div class="stat"><span>높이</span><b>${fmtM(cM)}</b></div>
      <div class="stat"><span>쪽수 · 권수</span><span>${fmtN(cp)}쪽 · ${fmtN(data.books.length)}권</span></div>
      <div class="small" style="margin-top:6px">목표 ${fmtM(goal)} 중 ${Math.floor(pct)}% ${cM >= goal && goal > 0 ? `${icon('star')} 목표 달성!` : `· ${fmtM(Math.max(0, goal - cM))} 남음`}</div>
      <div class="bar"><i style="width:${pct}%"></i></div>
      <p class="small" style="margin:8px 0">${nextTxt}</p>
      <h2 style="margin-top:8px">내 책탑</h2>
      <div class="stat"><span>높이</span><b>${fmtM(mM)}</b></div>
      <div class="stat"><span>쪽수 · 권수</span><span>${fmtN(mp)}쪽 · ${fmtN(mine.length)}권</span></div>`;

    // 내가 쌓은 책 (최신순)
    const ul = X('mine');
    ul.innerHTML = mine.length ? '' : '<li class="muted">아직 쌓은 책이 없어요</li>';
    for (const b of sortBooks(mine).reverse()) {
      const li = h(`<li title="${esc(b.title)}${b.note ? ' — ' + esc(b.note) : ''}"><div class="grow" style="flex:1;min-width:0">
        <div class="t1"><b>${esc(b.title)}</b><span class="small muted">${fmtN(b.pages)}쪽 · ${fmtDate(b.created_at)}</span></div>
        <div class="note">${b.note ? esc(b.note) : '&nbsp;'}</div></div>
        <div class="rowbtns"><button class="btn small" data-edit>고치기</button><button class="btn small" data-del>삭제</button></div></li>`);
      li.style.cursor = 'pointer';
      li.onclick = e => { if (!e.target.closest('button')) showBookNote({ title: b.title, pages: b.pages, who: '나', date: b.created_at, note: b.note }); };
      li.querySelector('[data-edit]').onclick = async () => {
        const v = await editBookModal(b);
        if (!v) return;
        if (needsPageConfirm(v.pages) && v.pages !== b.pages && !await confirmBox(`「${v.title}」 ${fmtN(v.pages)}쪽이 맞나요?\n쪽수를 잘못 쓰면 탑이 엄청 높아져요.`, '맞아요', { cancel: '다시 쓸게요', tone: 'primary' })) return;
        try { await api.updateBook(code, number, b.id, v); toast('고쳤어요'); await reload(); } catch (err) { toast(errMsg(err)); }
      };
      li.querySelector('[data-del]').onclick = async () => {
        if (!await confirmBox(`「${b.title}」 기록을 삭제할까요?`)) return;
        try { await api.deleteMyBook(code, number, b.id); toast('삭제했어요'); await reload(); } catch (err) { toast(errMsg(err)); }
      };
      ul.append(li);
    }

    // 도감 (현재 탭 기준)
    X('dexlabel').textContent = mode === 'class' ? '우리 반 탑 기준' : '내 탑 기준';
    if (L) renderDex(X('dex'), L.reachedCount);
    goalState = { reached: goal > 0 && cM >= goal, goal };
    checkBreakthrough();
  }

  // 돌파 연출 (명세 4.5)
  // 랜드마크 돌파와 반 목표 달성 연출 (첫 방문·기록 삭제 때는 조용히 저장만)
  async function checkBreakthrough() {
    const L = tower.layout;
    if (!L || busy) return;
    const key = seenKey(code, number, mode);
    const seen = store.get(key), reached = L.reachedCount;
    let list = [];
    if (seen == null || reached < seen) store.set(key, reached);
    else { list = newlyReached(seen, reached); if (list.length) store.set(key, reached); }
    const gkey = `bt_goal_${code}_${number}`;
    const g = goalCheck(store.get(gkey), goalState.reached);
    store.set(gkey, g.store);
    if (!list.length && !g.popup) return;
    busy = true;
    try {
      if (list.length) { await tower.flash(list[0]); for (const lm of list) await breakthroughPopup(lm); }
      if (g.popup) await goalPopup(goalState.goal);
    } finally { busy = false; }
  }

  async function reload() {
    const d = await api.studentData(code, number, pin);
    if (!d) { toast('반 코드나 번호를 다시 확인해 주세요'); clearInterval(timer); onLogout(); return; }
    data = d;
    render();
  }

  render({ reset: true });
  timer = setInterval(() => { if (!document.hidden && !busy) reload().catch(() => {}); }, REFRESH_MS);
  return () => clearInterval(timer);
}
