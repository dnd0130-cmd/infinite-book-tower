// Firebase 연결 정보.
// Firebase 콘솔 → 프로젝트 설정 → 일반 → '내 앱'(웹 앱)의 firebaseConfig 값을 아래에 붙여 넣는다.
// 이 값들은 웹 주소처럼 공개되어도 되는 값이다. 데이터 보호는 firestore.rules가 맡는다.
export const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyDj6fBG8McZUQQsPn-a_OEmjtpHQ4zhe1E',
  authDomain: 'infinite-book-tower.firebaseapp.com',
  projectId: 'infinite-book-tower',
  storageBucket: 'infinite-book-tower.firebasestorage.app',
  messagingSenderId: '379259572263',
  appId: '1:379259572263:web:203b64061880595801be02',
};

export const isFirebaseConfigured = () => !!(FIREBASE_CONFIG.apiKey && FIREBASE_CONFIG.projectId && FIREBASE_CONFIG.appId);
