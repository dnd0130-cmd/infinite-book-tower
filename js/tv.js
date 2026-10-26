// 교실 TV 화면: 로그인 없이 `?tv=반코드`로 열면 우리 반 책탑이 크게 보이고, 새 책이 쌓이면 바로 알려 준다.
// 반 코드가 곧 그 반의 비밀 주소이므로 TV 주소를 아는 사람은 그 반 기록을 볼 수 있다 (학생 입장과 같은 수준).
import { api } from './api.js';
import { heightM, leader, josa, numberLabel } from './core.js';
import { getLandmarks } from './landmarks.js';
import { createTower } from './tower.js';
import { $, esc, fmtM, fmtN, confettiHtml } from './ui.js';
import { icon } from './assets.js';

const BANNER_MS = 7000;        // 알림 하나를 보여 주는 시간
const MAX_QUEUE = 4;           // 한꺼번에 많이 쌓이면 묶어서 알린다

export async function startTv(root, code) {
  root.innerHTML = `
  <div class="app tv">
    <div class="tv-head">
      <div class="tv-title"><span class="tv-logo">무한의 책탑</span> <span data-x="name"></span></div>
      <div class="tv-stats" data-x="stats"></div>
      <button class="btn small tv-full" data-x="full">전체 화면</button>
    </div>
    <div class="tv-main"><div data-x="tower"></div></div>
    <div class="tv-banner hidden" data-x="banner" role="status"></div>
    <div class="tv-msg hidden" data-x="msg"></div>
  </div>`;
  const X = k => $(`[data-x="${k}"]`, root);
  X('full').onclick = () => (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen?.());
  document.addEventListener('fullscreenchange', () => { X('full').textContent = document.fullscreenElement ? '전체 화면 끄기' : '전체 화면'; });
  const tower = createTower(X('tower'));

  let sig = '', prevIds = null, prevReached = null, prevGoal = null, first = true;
  const queue = []; let playing = false;

  function say(msg) { const m = X('msg'); m.textContent = msg; m.classList.toggle('hidden', !msg); }

  async function play() {
    if (playing) return; playing = true;
    while (queue.length) {
      const item = queue.shift();
      if (item.landmark) { await tower.flash(item.landmark); }
      const b = X('banner');
      b.className = 'tv-banner frame' + (item.celebrate ? ' celebrate' : '');
      b.innerHTML = (item.celebrate ? confettiHtml(26) : '') + item.html;
      await new Promise(r => setTimeout(r, BANNER_MS));
      b.classList.add('hidden');
      await new Promise(r => setTimeout(r, 400));
    }
    playing = false;
  }
  const push = item => { if (queue.length < MAX_QUEUE * 3) queue.push(item); play(); };

  function render({ cls, students, books }) {
    if (!cls) { say('이 반을 찾을 수 없어요. 주소의 반 코드를 확인해 주세요.'); return; }
    say('');
    // 바뀐 것이 없으면 다시 그리지 않는다 (책 수·마지막 책·쪽수 합과 제목 길이(고친 경우)·학생 목록·목표)
    const s = JSON.stringify([cls.name, cls.goal_m, books.length, books.at(-1)?.id, books.reduce((a, b) => a + b.pages * 31 + b.title.length, 0), students.map(x => `${x.id}${x.name}${x.left ? 1 : 0}`).join()]);
    if (s === sig) return;
    sig = s;

    const cm = Number(cls.cm_per_page) || 1, goal = Number(cls.goal_m) || 0;
    const numberOf = new Map(students.map(x => [x.id, x.number]));
    const nameOf = id => students.find(x => x.id === id)?.name || '';
    tower.update({
      books, cmPerPage: cm, goalM: goal, mode: 'class', numberOf: id => numberOf.get(id), nameOf: id => { const st = students.find(x => x.id === id); return st ? `${numberLabel(st.number, cls)} ${st.name}` : ''; },
      leader: leader(students, books),
    }, { reset: first });
    const pages = books.reduce((a, b) => a + b.pages, 0), M = heightM(pages, cm), pct = goal > 0 ? Math.min(100, M / goal * 100) : 0;
    $('[data-x=name]', root).textContent = cls.name;
    X('stats').innerHTML = `<span><b>${fmtM(M)}</b> 높이</span><span><b>${fmtN(pages)}</b>쪽</span><span><b>${fmtN(books.length)}</b>권</span>
      ${goal > 0 ? `<span class="tv-goal">목표 ${fmtM(goal)}<span class="bar"><i style="width:${pct}%"></i></span><b>${Math.floor(pct)}%</b></span>` : ''}`;

    // 알림: 처음 불러올 때는 조용히 기억만 하고, 그 뒤에 늘어난 것만 알린다
    const L = tower.layout, reached = L?.reachedCount ?? 0, goalNow = goal > 0 && M >= goal;
    if (prevIds) {
      const fresh = books.filter(b => !prevIds.has(b.id));
      if (fresh.length > MAX_QUEUE) push({ html: `<div class="tv-b1">새 책 <b>${fresh.length}권</b>이 쌓였어요!</div>` });
      else for (const b of fresh) { const nm = nameOf(b.student_id) || '친구'; push({ html: `<div class="tv-b1"><b>${esc(nm)}</b>${josa(nm, '이', '가')} 「${esc(b.title)}」 ${fmtN(b.pages)}쪽을 쌓았어요!</div>${b.note ? `<div class="tv-b2">“${esc(b.note)}”</div>` : ''}` }); }
      for (let i = prevReached; i < reached; i++) {
        const lm = getLandmarks()[i];
        push({ landmark: lm, celebrate: true, html: `<div class="tv-b1">${icon('star')} ${esc(lm.name)} 돌파! ${icon('star')}</div><div class="tv-b2">${esc(lm.desc)}</div>` });
      }
      if (goalNow && prevGoal === false) push({ celebrate: true, html: `<div class="tv-b1">${icon('star')} 우리 반 목표 ${fmtM(goal)} 달성! ${icon('star')}</div><div class="tv-b2">모두 함께 읽은 덕분이에요</div>` });
    }
    prevIds = new Set(books.map(b => b.id)); prevReached = reached; prevGoal = goalNow; first = false;
  }

  try {
    await api.subscribeClass(code, render);
  } catch (e) { say('불러오지 못했어요. 인터넷 연결을 확인해 주세요.'); }
}
