// Firebase 연결 정보.
// Firebase 콘솔 → 프로젝트 설정 → 일반 → '내 앱'(웹 앱)의 firebaseConfig 값을 아래에 붙여 넣는다.
// 이 값들은 웹 주소처럼 공개되어도 되는 값이다. 데이터 보호는 firestore.rules가 맡는다.
export const FIREBASE_CONFIG = {
  apiKey: '',
  authDomain: '',
  projectId: '',
  storageBucket: '',
  messagingSenderId: '',
  appId: '',
};

export const isFirebaseConfigured = () => !!(FIREBASE_CONFIG.apiKey && FIREBASE_CONFIG.projectId && FIREBASE_CONFIG.appId);
