// ========================================================
// 해운대나눔과행복병원 입원비 계산기 - Firebase 클라우드 실시간 동기화 설정
// ========================================================
// 발급받으신 Firebase 웹 앱 구성 정보가 정식 등록되었습니다.
// 모든 사용자/기기(원무팀, 병동, 상담실, 환자 스마트폰)에 수정 내용이 실시간 자동 동기화됩니다.

const FIREBASE_CONFIG = {
  apiKey: "AIzaSyBysMNaSsbyWO-L8qylj513-uL9cKIlRnE",
  authDomain: "hccalculator.firebaseapp.com",
  projectId: "hccalculator",
  storageBucket: "hccalculator.firebasestorage.app",
  messagingSenderId: "85976879311",
  appId: "1:85976879311:web:49e7a5f064941bd04527ba",
  measurementId: "G-RHD1EL9X84",
  databaseURL: "https://hccalculator-default-rtdb.firebaseio.com"
};

// 브라우저 localStorage에 저장된 사용자 입력 커스텀 Firebase 설정이 있다면 자동 우선 적용
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
