# 무한의 책탑

초등학교 학급용 독서 웹앱. 읽은 쪽수만큼(1쪽 = 1cm) 도트 책탑이 쌓이고, 다음 랜드마크에 닿으면 돌파 연출이 나온다.
빌드 없이 정적 파일만으로 동작하고, 데이터는 Firebase(Auth + Firestore)에 저장한다.

## 쓰는 방법

- 선생님: 이메일 또는 구글 계정으로 로그인 → 반 만들기 → 학생 이름을 붙여 넣어 등록 (번호는 자동)
- 학생: 선생님께 받은 **반 코드(6자리)와 내 번호**만 입력. 비밀번호 없음.

## Firebase 설정 (처음 한 번)

1. [Firebase 콘솔](https://console.firebase.google.com)에서 **프로젝트 만들기** (이 앱 전용으로 새로 만들기를 권장. 규칙과 로그인 설정이 프로젝트 전체에 적용된다.)
2. **빌드 → Authentication → 시작하기 → 로그인 방법**에서 **이메일/비밀번호**와 **Google**을 켠다.
3. 같은 화면 **설정 → 승인된 도메인**에 앱을 올릴 주소(예: `dnd0130-cmd.github.io`)를 추가한다.
4. **빌드 → Firestore Database → 데이터베이스 만들기** (프로덕션 모드, 위치는 `asia-northeast3` 서울).
5. Firestore의 **규칙** 탭에 이 저장소의 `firestore.rules` 내용을 통째로 붙여 넣고 **게시**한다.
6. **프로젝트 설정 → 일반 → 내 앱 → 웹 앱(</>) 추가**로 나온 `firebaseConfig` 값을 `js/firebase-config.js`에 붙여 넣는다.
7. 앱 주소를 열어 선생님으로 가입해 본다. 값이 비어 있으면 앱이 설정 안내 화면을 보여 준다.

## 실행

```
python3 -m http.server 8000
# http://localhost:8000          → Firebase에 연결
# http://localhost:8000/?demo    → DB 없이 연습 데이터로 (반 코드 BKTWR2, 번호 1~20)
```

## 데이터와 보안

```
classes/{반코드} ─┬─ students/{번호}   (이름)
                  └─ books/{책 id}     (번호, 제목, 쪽수, 한 줄 느낌, 시각)
```

- 학생은 로그인하지 않는다. **반 코드가 그 반의 비밀 주소**다. 반 목록은 누구도 조회할 수 없어서, 코드를 모르면 어떤 반이 있는지조차 알 수 없다.
- 코드를 아는 사람(그 반 학생)은 그 반의 학생과 책을 읽고, 책을 쌓고, 지울 수 있다. 한 줄 느낌은 반 전체에 공개된다.
- 반·학생을 만들고 고치는 것은 그 반을 만든 선생님(로그인한 계정)만 가능하다.
- 같은 반 학생이 친구 번호로 들어와 책을 쌓거나 지울 수 있다. 번호로만 들어오는 방식이라 막지 않는다.
- 쪽수 1~3000, 제목 100자, 한 줄 느낌 필수(200자), 시각 조작 금지는 `firestore.rules`가 서버에서 검사한다.
- 학생 화면은 반 하나를 실시간으로 지켜보며 보관해, 30초마다 새로 불러도 읽기 횟수가 늘지 않는다 (무료 한도 절약).

### 규칙 시험

가짜 Firebase 서버(에뮬레이터)에서 규칙을 시험한다. Java가 필요하다.

```
npm i -D firebase-tools @firebase/rules-unit-testing firebase
npx firebase emulators:exec --only firestore --project demo-bt "node --test tools/rules-test.mjs"
```

앱 전체를 가짜 서버로 돌려 보려면 `npx firebase emulators:start --only firestore,auth --project demo-bt` 후 주소 끝에 `?emulator`를 붙인다.

## 파일

| 파일 | 내용 |
|---|---|
| `index.html` | 진입점 |
| `css/style.css` | 도트 UI. 맨 위 CSS 변수로 색·도트 크기 조절 |
| `firestore.rules`, `firebase.json` | Firestore 보안 규칙, 에뮬레이터 설정 |
| `js/firebase-config.js` | Firebase 연결 값 (직접 채움) |
| `js/api.js` | 화면이 쓰는 데이터 함수. 연습 모드 또는 Firebase 연결 선택 |
| `js/api-firebase.js` | Firebase 연결 |
| `js/assets.js` | 이미지·글꼴 경로 상수 (디자인 파일 교체 지점) |
| `js/landmarks.js` | 랜드마크 13개와 실루엣 격자 |
| `js/core.js` | 계산 로직 (순수 함수, 시험 있음) |
| `js/tower.js` | 책탑 뷰: 눈금, 실루엣, 책 더미, 하늘, 확대·축소 |
| `js/student.js`, `js/teacher.js` | 학생 / 교사 화면 |

## 디자인 교체

지금의 도트 UI(틀·버튼·책·왕관·구름·새·땅·도시)는 `tools/make-assets.mjs`가 만든 PNG다. 색이나 모양을 바꾸려면 이 파일을 고치고 `npm run assets`.
직접 그린 파일로 바꾸려면 `assets/` 아래 같은 이름·같은 크기로 덮어쓴다 (틀은 9분할이므로 테두리 칸 수를 유지).

- 랜드마크 그림: `assets/landmarks/landmark_{id}.png`를 넣고 `js/assets.js`의 `landmarkPngs`에 id를 적는다.
  크기는 (격자 w+2)×(h+2), 맨 윗줄 = 꼭대기, 맨 아랫줄 = 땅속 테두리. 기본 남색(#5a6aa8) 계열로 그리면 금색·회색은 코드가 만든다.
- 글꼴: `css/style.css` 맨 위 `@font-face`와 `--font`.

## 시험

```
npm test        # 계산 로직
```

## 그림 출처

- 글꼴: [갈무리](https://github.com/quiple/galmuri), SIL OFL 1.1
