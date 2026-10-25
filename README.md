# 무한의 책탑

초등학교 학급용 독서 웹앱. 읽은 쪽수만큼(1쪽 = 1cm) 도트 책탑이 쌓이고, 다음 랜드마크에 닿으면 돌파 연출이 나온다.

## 실행

빌드 없이 정적 파일만으로 동작한다. 아무 정적 서버로 폴더를 열면 된다.

```
python3 -m http.server 8000
# http://localhost:8000          → 실제 Supabase 연결
# http://localhost:8000/?demo    → DB 없이 연습 데이터로 (반 코드 BKTWR2, 번호 1~20)
```

## 파일

| 파일 | 내용 |
|---|---|
| `index.html` | 진입점 |
| `css/style.css` | 임시 디자인. 맨 위 CSS 변수로 색·도트 크기 조절 |
| `js/config.js` | Supabase 주소와 공개 키 |
| `js/assets.js` | 이미지·글꼴 경로 상수 (디자인 파일 교체 지점) |
| `js/landmarks.js` | 랜드마크 13개와 실루엣 격자 |
| `js/core.js` | 계산 로직 (순수 함수, 시험 있음) |
| `js/tower.js` | 책탑 뷰: 눈금, 실루엣, 책 더미, 확대·축소 |
| `js/student.js`, `js/teacher.js` | 학생 / 교사 화면 |
| `js/api.js` | Supabase 호출 (+ `?demo` 연습용) |

## 디자인 교체

- 랜드마크 그림: `assets/landmarks/landmark_{id}.png`를 넣고 `js/assets.js`의 `landmarkPngs`에 id를 적는다.
  크기는 (격자 w+2)×(h+2), 맨 윗줄 = 꼭대기, 맨 아랫줄 = 땅속 테두리. 기본 남색(#5a6aa8) 계열로 그리면 금색·회색은 코드가 만든다.
- 책·왕관·하늘·구름·땅·도시: `js/assets.js`의 `ASSETS`에 경로를 넣는다.
- 글꼴: `css/style.css`의 `@font-face` 주석을 풀고 `--font`에 이름을 둔다.

## 시험

```
npm test
```
