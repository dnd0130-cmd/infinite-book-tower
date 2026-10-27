// 공통 화면 부품: 알림, 확인창, 설명 카드, 돌파 팝업, 도감
import qrcode from './vendor/qrcode.js';
import { escapeHtml as esc, SIL_FAR, validateBook } from './core.js';
import { getLandmarks } from './landmarks.js';
import { silhouetteImage } from './sil-render.js';
import { icon } from './assets.js';

export { esc };
export const $ = (sel, root = document) => root.querySelector(sel);

export function h(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

export const fmtM = m => {
  if (m >= 100) return `${Math.round(m).toLocaleString('ko-KR')}m`;
  if (m >= 10) return `${(Math.round(m * 10) / 10).toLocaleString('ko-KR')}m`;
  return `${(Math.round(m * 100) / 100).toLocaleString('ko-KR')}m`;
};
export const fmtN = n => n.toLocaleString('ko-KR');
export const fmtDate = iso => {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()}`;
};

let toastTimer;
export function toast(msg) {
  let t = $('.toast');
  if (!t) { t = h('<div class="toast"></div>'); document.body.append(t); }
  t.textContent = msg;
  t.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.add('hidden'), 2600);
}

export function errMsg(e) {
  const m = e?.message || String(e);
  if (/fetch|network/i.test(m)) return '인터넷 연결을 확인해 주세요';
  return m;
}

function openModal(inner) {
  const back = h(`<div class="modal-back"><div class="modal frame">${inner}</div></div>`);
  document.body.append(back);
  return back;
}

/**
 * 책 한 권의 한 줄 느낌을 화면 아래쪽에 보여 준다. X 버튼이나 Esc로 닫고, 다른 책을 누르면 바로 바뀐다.
 * 한 줄 느낌은 같은 반 모두가 볼 수 있다. 비어 있으면(예전 기록) '적어 둔 느낌이 없음'으로 안내한다.
 */
export function showBookNote({ title, pages, who, date, note }, onHide) {
  document.querySelector('.note-card')?.dispatchEvent(new Event('hide'));   // 이전 카드 정리
  const text = note ? esc(note) : '<span class="muted">적어 둔 한 줄 느낌이 없어요</span>';
  const card = h(`<div class="note-card frame" role="status">
    <div class="nc-title">${esc(title)}</div>
    <div class="small muted">${esc(who)} · ${fmtN(pages)}쪽${date ? ' · ' + fmtDate(date) : ''}</div>
    <div class="nc-note">${text}</div><button class="btn small nc-x" aria-label="닫기" title="닫기">✕</button></div>`);
  document.body.append(card);
  const onKey = e => { if (e.key === 'Escape') hide(); };
  const hide = () => { document.removeEventListener('keydown', onKey); card.remove(); onHide?.(); };
  card.addEventListener('hide', hide, { once: true });
  card.querySelector('.nc-x').onclick = hide;
  document.addEventListener('keydown', onKey);
}

/** 확인창. 확인을 누르면 true */
export function confirmBox(message, okLabel = '삭제', { cancel = '취소', tone = 'danger' } = {}) {
  return new Promise(res => {
    const back = openModal(`<p style="white-space:pre-line">${esc(message)}</p>
      <div class="actions"><button class="btn" data-a="no">${esc(cancel)}</button><button class="btn ${tone}" data-a="ok">${esc(okLabel)}</button></div>`);
    back.addEventListener('click', e => {
      const a = e.target.dataset?.a;
      if (a || e.target === back) { back.remove(); res(a === 'ok'); }
    });
  });
}

/** 책 고치기 창. 저장하면 { title, pages, note }, 취소하면 null */
export function editBookModal(book) {
  return new Promise(res => {
    const back = h(`<div class="modal-back"><form class="modal frame" style="text-align:left"><h3 style="text-align:center">책 고치기</h3>
      <label class="field"><span>책 제목</span><input class="input" name="title" maxlength="100" required value="${esc(book.title)}"></label>
      <label class="field"><span>읽은 쪽수 (1~3000)</span><input class="input" name="pages" type="number" inputmode="numeric" min="1" max="3000" step="1" required value="${esc(book.pages)}"></label>
      <label class="field"><span>한 줄 느낌</span><input class="input" name="note" maxlength="200" required value="${esc(book.note || '')}"></label>
      <p class="warn small hidden" data-err></p>
      <div class="actions"><button type="button" class="btn" data-a="no">취소</button><button class="btn primary">저장</button></div></form></div>`);
    document.body.append(back);
    const f = back.querySelector('form');
    f.pages.focus(); f.pages.select();
    f.onsubmit = e => {
      e.preventDefault();
      const v = validateBook({ title: f.title.value, pages: f.pages.value, note: f.note.value });
      if (v.error) { const p = back.querySelector('[data-err]'); p.textContent = v.error; p.classList.remove('hidden'); return; }
      back.remove(); res(v);
    };
    back.addEventListener('click', e => { if (e.target.dataset?.a === 'no' || e.target === back) { back.remove(); res(null); } });
  });
}

/** 떨어지는 색종이 (CSS 애니메이션) */
export const confettiHtml = (n = 18) => `<div class="confetti" aria-hidden="true">${Array.from({ length: n }, (_, i) =>
  `<i style="--x:${(i * 53) % 100}%;--d:${((i * 37) % 20) / 10}s;--t:${2 + (i % 4) * 0.4}s;--c:${['#e8743b', '#f4c542', '#3b7be8', '#5cb85c', '#d9534f', '#9b59b6'][i % 6]}"></i>`).join('')}</div>`;

/** 반 목표 달성 축하 팝업 */
export function goalPopup(goalM) {
  return new Promise(res => {
    const back = openModal(`${confettiHtml()}<div class="burst">${icon('star')} 목표 달성! ${icon('star')}</div>
      <p style="margin:12px 0">우리 반이 목표 <b>${fmtM(goalM)}</b>를 해냈어요!<br>모두 함께 읽은 덕분이에요.</p>
      <div class="actions"><button class="btn primary" data-a="ok">만세!</button></div>`);
    back.addEventListener('click', e => { if (e.target.dataset?.a) { back.remove(); res(); } });
  });
}

/** CSV 파일 내려받기 (text는 core.js의 toCsv 결과) */
export function downloadCsv(filename, text) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url; a.download = filename; document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/** 개인정보 안내 */
export function privacyDialog() {
  return new Promise(res => {
    const back = openModal(`<h3>저장하는 정보</h3>
      <ul class="small" style="text-align:left;margin:8px 0;padding-left:18px;line-height:1.7">
        <li>반 이름, 반 코드, 학생 번호와 <b>이름(또는 별명)</b></li>
        <li>학생이 적은 책 제목, 읽은 쪽수, 한 줄 느낌, 날짜</li>
        <li>사이트 방문 횟수(하루 한 번, <b>숫자만</b> 세고 누가 왔는지는 저장하지 않아요)</li>
        <li>선생님의 로그인 이메일(구글 또는 이메일 계정)</li>
        <li>학생의 사진, 연락처, 학교·주소는 <b>받지 않아요</b>.</li>
      </ul>
      <p class="small" style="text-align:left">이름은 <b>별명이나 이니셜(예: 김하)</b>로 등록해도 돼요. 데이터는 Google Firebase에 저장되고,
      반 코드를 아는 사람만 그 반의 기록을 볼 수 있어요. 선생님은 언제든 학생이나 반을 지울 수 있어요.</p>
      <div class="actions"><button class="btn primary" data-a="ok">확인</button></div>`);
    back.addEventListener('click', e => { if (e.target.dataset?.a || e.target === back) { back.remove(); res(); } });
  });
}

/** 설명 카드: 큰 실루엣, 이름, 높이, 설명 */
export function landmarkCard(lm, color) {
  const img = silhouetteImage(lm.id, color);
  return new Promise(res => {
    const back = openModal(`<img class="big-sil" src="${img.url}" alt="">
      <h3>${esc(lm.name)}</h3><div class="muted">${fmtM(lm.m)}</div>
      <p>${esc(lm.desc)}</p><div class="actions"><button class="btn primary" data-a="ok">닫기</button></div>`);
    back.addEventListener('click', e => { if (e.target.dataset?.a || e.target === back) { back.remove(); res(); } });
  });
}

/** 돌파 팝업 */
export function breakthroughPopup(lm) {
  const img = silhouetteImage(lm.id);
  return new Promise(res => {
    const back = openModal(`<div class="burst">${icon('star')} ${esc(lm.name)} 돌파! ${icon('star')}</div>
      <img class="big-sil" src="${img.url}" alt=""><div class="muted">${fmtM(lm.m)}</div>
      <p>${esc(lm.desc)}</p><div class="actions"><button class="btn primary" data-a="ok">확인</button></div>`);
    back.addEventListener('click', e => { if (e.target.dataset?.a) { back.remove(); res(); } });
  });
}

/** 도감 (명세 4.4). reachedCount 기준으로 13칸을 그린다 */
export function renderDex(el, reachedCount) {
  const L = getLandmarks();
  el.innerHTML = '';
  L.forEach((lm, i) => {
    let cell;
    if (i < reachedCount) {
      cell = h(`<div class="dex-cell done" title="${esc(lm.name)}"><img src="${silhouetteImage(lm.id).url}" alt="">
        <div>${esc(lm.name)}</div><div class="muted">${fmtM(lm.m)}</div></div>`);
      cell.addEventListener('click', () => landmarkCard(lm));
    } else if (i === reachedCount) {
      cell = h(`<div class="dex-cell"><span class="next">다음</span><img src="${silhouetteImage(lm.id, SIL_FAR).url}" alt="">
        <div>${esc(lm.name)}</div></div>`);
    } else {
      cell = h(`<div class="dex-cell far"><img src="${silhouetteImage(lm.id, SIL_FAR).url}" alt=""><div class="q">?</div></div>`);
    }
    el.append(cell);
  });
}

// 반 코드와 바로 입장하는 QR 코드를 크게 보여 준다 (교실 화면에 띄워 학생이 휴대폰으로 찍는다)
export function qrDialog(code, url) {
  return new Promise(res => {
    const q = qrcode(0, 'M'); q.addData(url); q.make();
    const back = openModal(`<h3>학생 입장 QR</h3>
      <div style="background:#fff;padding:10px;margin:8px auto;width:min(70vw,60vh,360px);line-height:0;border:3px solid #000">${q.createSvgTag({ cellSize: 4, margin: 0, scalable: true })}</div>
      <p class="small muted" style="margin:6px 0 0">휴대폰 카메라로 찍으면 반 코드가 채워진 입장 화면이 열려요</p>
      <div class="code" style="font-size:clamp(28px,8vw,48px);letter-spacing:6px;margin:8px 0">${esc(code)}</div>
      <div class="actions"><button class="btn primary" data-a="ok">닫기</button></div>`);
    back.addEventListener('click', e => { if (e.target.dataset?.a || e.target === back) { back.remove(); res(); } });
  });
}
