// 공통 화면 부품: 알림, 확인창, 설명 카드, 돌파 팝업, 도감
import { escapeHtml as esc, SIL_FAR } from './core.js';
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

/** 확인창. 확인을 누르면 true */
export function confirmBox(message, okLabel = '삭제') {
  return new Promise(res => {
    const back = openModal(`<p style="white-space:pre-line">${esc(message)}</p>
      <div class="actions"><button class="btn" data-a="no">취소</button><button class="btn danger" data-a="ok">${esc(okLabel)}</button></div>`);
    back.addEventListener('click', e => {
      const a = e.target.dataset?.a;
      if (a || e.target === back) { back.remove(); res(a === 'ok'); }
    });
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
