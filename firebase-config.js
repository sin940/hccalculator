// ========================================================
// 해운대나눔과행복병원 입원비 계산기 - Firebase 클라우드 실시간 동기화 설정
// ========================================================
// 1. Firebase 콘솔(https://console.firebase.google.com)에서 무료 프로젝트를 생성합니다.
// 2. Realtime Database를 생성한 후 아래에 발급받은 구성 정보를 입력하세요.
// 3. 설정을 입력하면 모든 사용자/기기(원무팀, 병동, 상담실, 환자 스마트폰)에 수정 내용이 실시간 자동 동기화됩니다.
// ※ 미입력 시에도 로컬 기본 데이터(data.js)로 정상 작동합니다.

const FIREBASE_CONFIG = {
  apiKey: "",
  authDomain: "",
  databaseURL: "",
  projectId: "",
  storageBucket: "",
  messagingSenderId: "",
  appId: ""
};

// 브라우저 localStorage에 저장된 사용자 입력 Firebase 설정이 있다면 자동 우선 적용
(function initFirebaseConfigFromStorage() {
  try {
    const saved = localStorage.getItem('HN_FIREBASE_CONFIG_CUSTOM');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed && (parsed.apiKey || parsed.databaseURL)) {
        Object.assign(FIREBASE_CONFIG, parsed);
      }
    }
  } catch (e) {
    console.warn('initFirebaseConfigFromStorage error:', e);
  }
})();
