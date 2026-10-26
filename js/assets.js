// 이미지·글꼴 자리 (명세서 7장)
// 지금 그림은 tools/make-assets.mjs가 만든 것이다 (`npm run assets`).
// 직접 그린 파일로 바꾸려면 같은 이름으로 덮어쓰거나 여기 경로를 바꾼다. null이면 코드가 임시 모양으로 그린다.
// UI 틀(패널·버튼·입력창·탭·막대)은 css/style.css에서 assets/ui/*.png를 9분할로 쓴다.

export const U = 3;   // 도트 한 칸의 화면 크기(px). css의 --u와 같은 값으로 맞출 것

const BOOK_VARIANTS = 3;

export const ASSETS = {
  // 책 스프라이트: books[표지색 0~7][장식 0~2]. 크기 48×6, 9분할(위 2 / 오른쪽 2 / 아래 2 / 왼쪽 6)
  books: Array.from({ length: 8 }, (_, c) => Array.from({ length: BOOK_VARIANTS }, (_, v) => `assets/books/book_${c}_${v}.png`)),
  bookSlice: { top: 2, right: 2, bottom: 2, left: 6 },
  crown: 'assets/ui/crown.png',          // 13×8
  star: 'assets/ui/star.png',            // 9×10
  booksIcon: 'assets/ui/books.png',      // 12×7
  sky: null,                             // 배경 하늘 (null이면 계단식 색 띠)
  city: 'assets/bg/city.png',            // 120×60, 가로 반복
  cloud: 'assets/bg/cloud.png',          // 24×9
  cloudSmall: 'assets/bg/cloud_small.png', // 14×7
  bird: 'assets/bg/bird.png',            // 날갯짓 4장을 가로로 이은 한 줄 (한 장 9×5)
  ground: 'assets/bg/ground.png',        // 16×14, 가로 반복
  // 랜드마크 PNG: assets/landmarks/landmark_{id}.png 파일을 넣고, 그 id를 아래 목록에 적으면 격자 대신 사용
  // 예: landmarkPngs: ['busan', 'daegu83']
  landmarkDir: 'assets/landmarks/',
  landmarkPngs: [],
};

// 책 표지색 8종 (책 높이가 5px 미만일 때 단색 띠에 사용. 스프라이트 색과 같게)
export const COVER_COLORS = ['#d9534f', '#f0a030', '#e8d44d', '#5cb85c', '#3fa7d6', '#5a6fd6', '#9b59b6', '#e57fb0'];

// 아이콘을 <img>로 (없으면 대체 글자)
export const icon = (key, alt = '') => ASSETS[key]
  ? `<img class="ico" src="${ASSETS[key]}" alt="${alt}">`
  : alt;
