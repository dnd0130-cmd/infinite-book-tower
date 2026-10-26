// 랜드마크 실루엣 이미지 만들기
// assets/landmarks/landmark_{id}.png가 있으면 그것을, 없으면 부록 A 격자로 그린다.
// 금색·회색 같은 다른 색은 기본 남색 그림의 명암을 유지한 채 색만 바꿔 만든다.
import { getLandmarks, getSilhouette } from './landmarks.js';
import { silhouettePixels, hexToRgb, OUTLINE_RGB, SIL_COLOR } from './core.js';
import { ASSETS } from './assets.js';

const pngs = new Map();     // id → HTMLImageElement (로드 성공한 것만)
const cache = new Map();    // `${id}|${color}` → { url, w, h }

// 앱 시작 때 한 번 호출: ASSETS.landmarkPngs에 적힌 그림을 불러 둔다
export function preloadLandmarkPngs() {
  const ids = new Set(getLandmarks().map(l => l.id));
  return Promise.all(ASSETS.landmarkPngs.filter(id => ids.has(id)).map(id => new Promise(res => {
    const img = new Image();
    img.onload = () => { pngs.set(id, img); res(); };
    img.onerror = () => { console.warn(`랜드마크 그림을 찾지 못해 격자로 그려요: landmark_${id}.png`); res(); };
    img.src = `${ASSETS.landmarkDir}landmark_${id}.png`;
  })));
}

function toCanvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }

function recolor(data, toHex) {
  const from = hexToRgb(SIL_COLOR), to = hexToRgb(toHex);
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] === 0) continue;
    const isOutline = Math.abs(data[i] - OUTLINE_RGB[0]) + Math.abs(data[i + 1] - OUTLINE_RGB[1]) + Math.abs(data[i + 2] - OUTLINE_RGB[2]) < 30;
    if (isOutline) continue;
    // 기본색 대비 밝기 비율을 새 색에 적용
    const lum = (data[i] + data[i + 1] + data[i + 2]) / (from[0] + from[1] + from[2]);
    for (let k = 0; k < 3; k++) data[i + k] = Math.min(255, to[k] * lum);
  }
}

/** 실루엣 이미지 { url, w, h }. w/h는 원본 픽셀 크기 (테두리 포함) */
export function silhouetteImage(id, color = SIL_COLOR) {
  const key = `${id}|${color}`;
  if (cache.has(key)) return cache.get(key);
  let out;
  const png = pngs.get(id);
  if (png) {
    const c = toCanvas(png.naturalWidth, png.naturalHeight), ctx = c.getContext('2d');
    ctx.drawImage(png, 0, 0);
    if (color !== SIL_COLOR) {
      const im = ctx.getImageData(0, 0, c.width, c.height);
      recolor(im.data, color);
      ctx.putImageData(im, 0, 0);
    }
    out = { url: c.toDataURL(), w: c.width, h: c.height };
  } else {
    const px = silhouettePixels(getSilhouette(id), { color });
    const c = toCanvas(px.w, px.h);
    c.getContext('2d').putImageData(new ImageData(px.data, px.w, px.h), 0, 0);
    out = { url: c.toDataURL(), w: px.w, h: px.h };
  }
  cache.set(key, out);
  return out;
}

/** 화면에 놓을 위치. 그림의 몸통 높이(h−2)가 랜드마크 높이에 맞도록 (명세 4.6) */
export function placeSilhouette(img, heightPx, cx, groundY) {
  const bodyH = img.h - 2, bodyW = img.w - 2;
  const cell = heightPx / bodyH;
  return {
    left: cx - (bodyW + 2) * cell / 2,
    top: groundY - (bodyH + 1) * cell,
    width: (bodyW + 2) * cell,
    height: (bodyH + 2) * cell,
  };
}
