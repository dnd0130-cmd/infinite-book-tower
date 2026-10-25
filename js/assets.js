// 이미지·글꼴 자리 (명세서 7장)
// 디자인 파일이 준비되면 경로만 채우면 된다. null이면 코드가 임시 모양으로 그린다.
// 색·여백·도트 크기 등은 css/style.css 맨 위의 CSS 변수에서 바꾼다.

export const U = 3;   // 도트 한 칸의 화면 크기(px). css의 --u와 같은 값으로 맞출 것

export const ASSETS = {
  // 책 스프라이트 8종 (표지색 순서). 세로 3분할: 위 테두리 1칸 / 늘어나는 가운데 / 아래 테두리 1칸
  books: [null, null, null, null, null, null, null, null],
  bookSlice: 1,                  // 스프라이트의 위/아래 테두리 두께(원본 픽셀)
  crown: null,                   // 왕관 (약 13×8칸)
  sky: null,                     // 배경 하늘 (세로 반복)
  city: null,                    // 도시 실루엣 타일 (약 120×60칸, 가로 반복)
  cloud: null,                   // 구름 (약 24×9칸)
  ground: null,                  // 땅 타일 (가로 반복, 높이 40px)
  // 랜드마크 PNG: assets/landmarks/landmark_{id}.png 파일을 넣고, 그 id를 아래 목록에 적으면 격자 대신 사용
  // 예: landmarkPngs: ['busan', 'daegu83']
  landmarkDir: 'assets/landmarks/',
  landmarkPngs: [],
};

// 책 표지색 8종 (스프라이트가 없을 때 임시 표현에 사용)
export const COVER_COLORS = ['#d9534f', '#f0a030', '#e8d44d', '#5cb85c', '#3fa7d6', '#5a6fd6', '#9b59b6', '#e57fb0'];
