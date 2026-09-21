// 2026 Haeundae Nanum & Haengbok Hospital Inpatient Fee Database
// Decay points: d15 (1-15 days), d16 (16-30 days), d31 (31+ days)
const INPATIENT_FEE_DB = {
  general: {
    '2인실': { d15: 124521, d16: 124521, d31: 124521 }, // 일반병동 2인실(715호) 실영수증 기준 일 124,521원 (본인부담 40% 기준 30일 약 149.4만~150만원, 31일 1,544,060원)
    '3인실': { d15: 142390, d16: 130150, d31: 124030 },
    '4인실': { d15: 121990, d16: 111790, d31: 106690 }
  },
  integrated: {
    '2인실': { d15: 243450, d16: 243450, d31: 243450 }, // 간호간병통합 2인실 체감 미적용 고정 수가 (실영수증 243,450원/일, 본인부담 40% 기준 30일 약 292만원, 31일 3,018,780원)
    '3인실': { d15: 228310, d16: 205470, d31: 194050 },
    '4인실': { d15: 213180, d16: 191850, d31: 181190 },
    '8인실': { d15: 182020, d16: 163810, d31: 154700 }
  }
};

// Detailed Wards and Rooms configuration mapping (User Specifications)
const WARD_ROOM_CONFIG = {
  '5병동': {
    type: 'integrated',
    rooms: {
      '8인실': { name: '8인실', baseRoomKey: '8인실' }
    }
  },
  '6병동': {
    type: 'general',
    rooms: {
      '3인실': { name: '3인실 (606호, 609호) [4인실 수가]', baseRoomKey: '4인실' },
      '4인실': { name: '4인실', baseRoomKey: '4인실' }
    }
  },
  '7병동': {
    type: 'general',
    rooms: {
      '2인실': { name: '2인실 (715호)', baseRoomKey: '2인실' },
      '3인실': { name: '3인실 (717호, 718호)', baseRoomKey: '3인실' },
      '3인실 [4인실 수가]': { name: '3인실 (706호, 709호) [4인실 수가]', baseRoomKey: '4인실' },
      '4인실': { name: '4인실', baseRoomKey: '4인실' }
    }
  },
  '8병동': {
    type: 'integrated',
    rooms: {
      '2인실': { name: '2인실 (806호, 815호, 818호)', baseRoomKey: '2인실' },
      '3인실 [4인실 수가]': { name: '3인실 (809호, 819호) [4인실 수가]', baseRoomKey: '4인실' },
      '4인실': { name: '4인실', baseRoomKey: '4인실' }
    }
  }
};

// Disease classifications, limits, and onset guidelines from MoHW/HIRA
const DISEASE_GUIDELINES = {
  cns_stroke: { name: '뇌졸중 (뇌경색, 뇌출혈)', onsetLimit: 90, stayLimit: 180, category: '중추신경계' },
  cns_brain_injury: { name: '외상성/비외상성 뇌손상', onsetLimit: 90, stayLimit: 180, category: '중추신경계' },
  cns_spinal_injury: { name: '척수손상 (신경계 마비 등)', onsetLimit: 90, stayLimit: 180, category: '중추신경계' },
  msk_hip_single: { name: '고관절·골반·대퇴 골절 (단일 부위)', onsetLimit: 30, stayLimit: 30, category: '근골격계' },
  msk_hip_multi: { name: '고관절·골반·대퇴 골절 (다발 부위)', onsetLimit: 60, stayLimit: 60, category: '근골격계' },
  msk_knee_double: { name: '양측 슬관절 치환술', onsetLimit: 30, stayLimit: 30, category: '근골격계' },
  amputation: { name: '하지 부위 절단', onsetLimit: 60, stayLimit: 60, category: '하지절단' },
  disuse_syndrome: { name: '비사용 증후군', onsetLimit: 60, stayLimit: 60, category: '비사용증후군' }
};

// Patient category definitions and benefit copay rates
const COPAY_RATES = {
  nhi_general: { name: '일반병', rate: 0.20, type: 'nhi', label: '고관절 / 척수·뇌질환 일반' },
  nhi_rare: { name: '희귀', rate: 0.10, type: 'nhi', label: '희귀난치성 질환' },
  nhi_severe: { name: '중증', rate: 0.05, type: 'nhi', label: '중증질환자' },
  medical_type2: { name: '급여', rate: 0.10, type: 'medical', label: '의료급여 2종' },
  medical_type2_disabled: { name: '급여', rate: null, type: 'special_billing', label: '의료급여 2종 장애인 (식대+전액+비급여)' },
  medical_type1: { name: '급여1종', rate: null, type: 'special_billing', label: '의료급여 1종 (식대+전액+비급여)' },
  near_poverty_type2: { name: '차상위', rate: 0.14, type: 'nhi', label: '차상위 2종' },
  near_poverty_type1: { name: '차상위1종', rate: null, type: 'special_billing', label: '차상위 1종 (식대+전액+비급여)' },
  workers_comp: { name: '산재', rate: 0.00, type: 'workers_comp', label: '근로복지공단 산재보험' }
};

// 2026 Inpatient Ceiling Thresholds (Annual) - MoHW / HIRA Standard
const CEILING_THRESHOLDS_2026 = {
  decile_1: { name: '1구간 (1분위)', threshold: 900000, longStayThreshold: 1430000 },
  decile_2_3: { name: '2구간 (2~3분위)', threshold: 1120000, longStayThreshold: 1810000 },
  decile_4_5: { name: '3구간 (4~5분위)', threshold: 1730000, longStayThreshold: 2450000 },
  decile_6_7: { name: '4구간 (6~7분위)', threshold: 3260000, longStayThreshold: 4040000 },
  decile_8: { name: '5구간 (8분위)', threshold: 4460000, longStayThreshold: 5800000 },
  decile_9: { name: '6구간 (9분위)', threshold: 5360000, longStayThreshold: 6980000 },
  decile_10: { name: '7구간 (10분위)', threshold: 8430000, longStayThreshold: 10960000 }
};

// 2026 Prepay Ceiling Max Amounts
const MAX_PREPAY_CEILING_2026 = {
  standard: 8430000,
  longStay: 10960000
};


// Rehab treatment daily cost constants before insurance (2026 심평원 고시 및 영수증 실청구액 반영)
const REHAB_COST_DAILY_BEFORE_INS = {
  intensive: 215000, // 일 215,000원 (실영수증 일 207,000~215,000원 기준, 월 약 650만원 상당, 본인부담 20% 약 129만원)
  standard: 110000,  // 일 110,000원 (월 약 330만원 상당)
  none: 0
};

// 기본 진료·검사·약제비 일일 기준 (보험 적용 전 수가: 진찰료, 기본 혈액/소변검사, 영상진단, 기본 원내약제 및 필수처치료)
const BASIC_CARE_DAILY_BEFORE_INS = {
  '5병동': 50000,    // 5병동 8인실 간호간병통합 (급여 20% 본인부담 시 30일 약 30만원, 영수증 기준 총병원비 약 299만~300만원 맞춤)
  '8병동_2인실': 85000, // 8병동 2인실 (급여 20% 본인부담 시 30일 약 51만원, 2인실 총액 약 510만원 기준)
  general: 38000,    // 일반병동 기본 (3인실 718호 총액 약 310만원 기준)
  integrated: 50000  // 간호간병통합병동 기본 (5병동 다인실 최대입원비 약 300만원 기준)
};

const ROOM_COP_FIXED = { '2인실': 0.40, '3인실': 0.30 };
let MEAL_COST_PER_MEAL = 8100;

// Important Contacts & FAX Directory (from User Specifications)
const CONTACT_DIRECTORY = [
  // 1. 기관 (Organizations)
  { category: 'org', name: '두리발 (장애인 콜택시)', tel: '1555-1114', er: '-', fax: '0502-922-8001', query: '부산 두리발' },
  { category: 'org', name: '햇님 약국 (해운대)', tel: '051-747-0880', er: '-', fax: '051-747-0881', query: '해운대 햇님약국' },
  { category: 'org', name: '해운대나눔과행복병원 3층 원무', tel: '051-744-0123', er: '-', fax: '051-726-0544', query: '해운대나눔과행복병원' },
  { category: 'org', name: '해운대나눔과행복병원 총무팀', tel: '051-726-0812', er: '-', fax: '051-726-0564', query: '해운대나눔과행복병원' },
  { category: 'org', name: '근로복지공단 본부', tel: '1588-0075', er: '-', fax: '0505-042-2200', query: '근로복지공단' },
  { category: 'org', name: '근로복지공단 부산동부지사', tel: '1588-0075', er: '-', fax: '0505-067-2102', query: '근로복지공단 부산동부지사' },
  
  // 2. 병원 (Hospitals & ER)
  { category: 'hosp', name: '해운대백병원', tel: '051-797-0100', er: '051-797-1119', fax: '051-797-0298', query: '인제대학교 해운대백병원' },
  { category: 'hosp', name: '좋은강안병원', tel: '051-625-0900', er: '051-610-9119', fax: '051-621-1500', query: '좋은강안병원' },
  { category: 'hosp', name: '세웅병원', tel: '051-500-9700', er: '051-500-9119', fax: '051-500-9393 / 051-989-5008', query: '금정구 세웅병원' },
  { category: 'hosp', name: '부산센텀병원', tel: '051-750-5000', er: '051-750-5119', fax: '051-751-1095', query: '센텀종합병원' },
  { category: 'hosp', name: '부산대학교병원', tel: '051-240-7000', er: '051-240-7000', fax: '051-247-3216', query: '부산대학교병원' },
  { category: 'hosp', name: '양산부산대학교병원', tel: '1577-7512', er: '055-360-1476', fax: '-', query: '양산부산대학교병원' },
  { category: 'hosp', name: '부산백병원', tel: '051-890-6114', er: '051-890-5995', fax: '051-891-6438', query: '인제대학교 부산백병원' },
  { category: 'hosp', name: '동아대학교병원 (권역응급의료센터)', tel: '051-240-2000', er: '051-240-5300', fax: '-', query: '동아대학교 의료원' },
  { category: 'hosp', name: '동의병원', tel: '051-867-5101', er: '051-850-8777', fax: '051-867-5162', query: '동의병원' },
  { category: 'hosp', name: 'BHS한서병원', tel: '1666-8275', er: '051-998-0118', fax: '051-751-4372', query: 'BHS한서병원' },
  { category: 'hosp', name: '부산의료원', tel: '051-507-3000', er: '051-607-2140', fax: '051-507-3001', query: '부산광역시의료원' },
  { category: 'hosp', name: '고신대학교복음병원', tel: '051-990-6114', er: '051-990-6200', fax: '051-990-3005', query: '고신대학교복음병원' },
  { category: 'hosp', name: '메드윌병원', tel: '051-519-8000', er: '-', fax: '051-519-8007', query: '메드윌병원' },
  { category: 'hosp', name: '워크재활병원', tel: '051-714-4119', er: '-', fax: '051-955-3118', query: '워크재활병원' },
  { category: 'hosp', name: '센텀이루다병원', tel: '051-608-7000', er: '-', fax: '051-745-8389', query: '센텀이루다요양병원' },
  { category: 'hosp', name: '광혜병원', tel: '051-503-2111', er: '051-504-2119', fax: '051-590-3397', query: '광혜병원' },
  { category: 'hosp', name: '대동병원', tel: '051-554-1233', er: '051-550-9390', fax: '-', query: '대동병원' },
  { category: 'hosp', name: '큰솔1병원', tel: '051-322-9000', er: '-', fax: '051-322-9300', query: '큰솔병원' },
  { category: 'hosp', name: '큰솔2병원', tel: '051-322-9000', er: '-', fax: '051-322-0053', query: '큰솔병원' },
  { category: 'hosp', name: '파크사이드병원', tel: '051-629-8000', er: '-', fax: '051-429-8188', query: '파크사이드재활의학병원' },
  { category: 'hosp', name: '새봄병원', tel: '051-503-8288', er: '-', fax: '051-501-1555', query: '새봄병원' }
];

// 54개 병실 마스터 데이터 (병실별_수가적용_정리표.xlsx 기준)
const ROOM_DIRECTORY_DATA = [
  { id: '5병동_500', ward: '5병동', wardType: 'integrated', room: '500', roomType: '7인실', feeApplied: '7인실', baseRoomKey: '8인실', capacity: 7, note: '' },
  { id: '5병동_501', ward: '5병동', wardType: 'integrated', room: '501', roomType: '8인실', feeApplied: '8인실', baseRoomKey: '8인실', capacity: 8, note: '' },
  { id: '5병동_502', ward: '5병동', wardType: 'integrated', room: '502', roomType: '8인실', feeApplied: '8인실', baseRoomKey: '8인실', capacity: 8, note: '' },
  { id: '5병동_503', ward: '5병동', wardType: 'integrated', room: '503', roomType: '8인실', feeApplied: '8인실', baseRoomKey: '8인실', capacity: 8, note: '' },
  { id: '5병동_504', ward: '5병동', wardType: 'integrated', room: '504', roomType: '8인실', feeApplied: '8인실', baseRoomKey: '8인실', capacity: 8, note: '' },
  { id: '5병동_505', ward: '5병동', wardType: 'integrated', room: '505', roomType: '7인실', feeApplied: '7인실', baseRoomKey: '8인실', capacity: 7, note: '' },
  { id: '5병동_506', ward: '5병동', wardType: 'integrated', room: '506', roomType: '8인실', feeApplied: '8인실', baseRoomKey: '8인실', capacity: 8, note: '' },
  { id: '6병동_601', ward: '6병동', wardType: 'general', room: '601', roomType: '4인실', feeApplied: '4인실', baseRoomKey: '4인실', capacity: 4, note: '' },
  { id: '6병동_602', ward: '6병동', wardType: 'general', room: '602', roomType: '4인실', feeApplied: '4인실', baseRoomKey: '4인실', capacity: 4, note: '' },
  { id: '6병동_603', ward: '6병동', wardType: 'general', room: '603', roomType: '4인실', feeApplied: '4인실', baseRoomKey: '4인실', capacity: 4, note: '' },
  { id: '6병동_605', ward: '6병동', wardType: 'general', room: '605', roomType: '4인실', feeApplied: '4인실', baseRoomKey: '4인실', capacity: 4, note: '' },
  { id: '6병동_606', ward: '6병동', wardType: 'general', room: '606', roomType: '3인실', feeApplied: '4인실', baseRoomKey: '4인실', capacity: 3, note: '3인실이나 4인실 수가 적용' },
  { id: '6병동_607', ward: '6병동', wardType: 'general', room: '607', roomType: '4인실', feeApplied: '4인실', baseRoomKey: '4인실', capacity: 4, note: '' },
  { id: '6병동_608', ward: '6병동', wardType: 'general', room: '608', roomType: '4인실', feeApplied: '4인실', baseRoomKey: '4인실', capacity: 4, note: '' },
  { id: '6병동_609', ward: '6병동', wardType: 'general', room: '609', roomType: '3인실', feeApplied: '4인실', baseRoomKey: '4인실', capacity: 3, note: '3인실이나 4인실 수가 적용' },
  { id: '6병동_610', ward: '6병동', wardType: 'general', room: '610', roomType: '4인실', feeApplied: '4인실', baseRoomKey: '4인실', capacity: 4, note: '' },
  { id: '7병동_701', ward: '7병동', wardType: 'general', room: '701', roomType: '4인실', feeApplied: '4인실', baseRoomKey: '4인실', capacity: 4, note: '' },
  { id: '7병동_702', ward: '7병동', wardType: 'general', room: '702', roomType: '4인실', feeApplied: '4인실', baseRoomKey: '4인실', capacity: 4, note: '' },
  { id: '7병동_703', ward: '7병동', wardType: 'general', room: '703', roomType: '4인실', feeApplied: '4인실', baseRoomKey: '4인실', capacity: 4, note: '' },
  { id: '7병동_704', ward: '7병동', wardType: 'general', room: '704', roomType: '4인실', feeApplied: '4인실', baseRoomKey: '4인실', capacity: 4, note: '' },
  { id: '7병동_705', ward: '7병동', wardType: 'general', room: '705', roomType: '4인실', feeApplied: '4인실', baseRoomKey: '4인실', capacity: 4, note: '' },
  { id: '7병동_706', ward: '7병동', wardType: 'general', room: '706', roomType: '3인실', feeApplied: '4인실', baseRoomKey: '4인실', capacity: 3, note: '3인실이나 4인실 수가 적용' },
  { id: '7병동_707', ward: '7병동', wardType: 'general', room: '707', roomType: '4인실', feeApplied: '4인실', baseRoomKey: '4인실', capacity: 4, note: '' },
  { id: '7병동_708', ward: '7병동', wardType: 'general', room: '708', roomType: '4인실', feeApplied: '4인실', baseRoomKey: '4인실', capacity: 4, note: '' },
  { id: '7병동_709', ward: '7병동', wardType: 'general', room: '709', roomType: '3인실', feeApplied: '4인실', baseRoomKey: '4인실', capacity: 3, note: '3인실이나 4인실 수가 적용' },
  { id: '7병동_710', ward: '7병동', wardType: 'general', room: '710', roomType: '4인실', feeApplied: '4인실', baseRoomKey: '4인실', capacity: 4, note: '' },
  { id: '7병동_711', ward: '7병동', wardType: 'general', room: '711', roomType: '4인실', feeApplied: '4인실', baseRoomKey: '4인실', capacity: 4, note: '' },
  { id: '7병동_712', ward: '7병동', wardType: 'general', room: '712', roomType: '4인실', feeApplied: '4인실', baseRoomKey: '4인실', capacity: 4, note: '' },
  { id: '7병동_713', ward: '7병동', wardType: 'general', room: '713', roomType: '4인실', feeApplied: '4인실', baseRoomKey: '4인실', capacity: 4, note: '' },
  { id: '7병동_714', ward: '7병동', wardType: 'general', room: '714', roomType: '4인실', feeApplied: '4인실', baseRoomKey: '4인실', capacity: 4, note: '' },
  { id: '7병동_715', ward: '7병동', wardType: 'general', room: '715', roomType: '2인실', feeApplied: '2인실', baseRoomKey: '2인실', capacity: 2, note: '' },
  { id: '7병동_717', ward: '7병동', wardType: 'general', room: '717', roomType: '3인실', feeApplied: '3인실', baseRoomKey: '3인실', capacity: 3, note: '' },
  { id: '7병동_718', ward: '7병동', wardType: 'general', room: '718', roomType: '3인실', feeApplied: '3인실', baseRoomKey: '3인실', capacity: 3, note: '' },
  { id: '7병동_720', ward: '7병동', wardType: 'general', room: '720', roomType: '4인실', feeApplied: '4인실', baseRoomKey: '4인실', capacity: 4, note: '' },
  { id: '8병동_801', ward: '8병동', wardType: 'integrated', room: '801', roomType: '4인실', feeApplied: '4인실', baseRoomKey: '4인실', capacity: 4, note: '' },
  { id: '8병동_802', ward: '8병동', wardType: 'integrated', room: '802', roomType: '4인실', feeApplied: '4인실', baseRoomKey: '4인실', capacity: 4, note: '' },
  { id: '8병동_803', ward: '8병동', wardType: 'integrated', room: '803', roomType: '4인실', feeApplied: '4인실', baseRoomKey: '4인실', capacity: 4, note: '' },
  { id: '8병동_804', ward: '8병동', wardType: 'integrated', room: '804', roomType: '4인실', feeApplied: '4인실', baseRoomKey: '4인실', capacity: 4, note: '' },
  { id: '8병동_805', ward: '8병동', wardType: 'integrated', room: '805', roomType: '4인실', feeApplied: '4인실', baseRoomKey: '4인실', capacity: 4, note: '' },
  { id: '8병동_806', ward: '8병동', wardType: 'integrated', room: '806', roomType: '2인실', feeApplied: '2인실', baseRoomKey: '2인실', capacity: 2, note: '' },
  { id: '8병동_807', ward: '8병동', wardType: 'integrated', room: '807', roomType: '4인실', feeApplied: '4인실', baseRoomKey: '4인실', capacity: 4, note: '' },
  { id: '8병동_808', ward: '8병동', wardType: 'integrated', room: '808', roomType: '4인실', feeApplied: '4인실', baseRoomKey: '4인실', capacity: 4, note: '' },
  { id: '8병동_809', ward: '8병동', wardType: 'integrated', room: '809', roomType: '3인실', feeApplied: '4인실', baseRoomKey: '4인실', capacity: 3, note: '3인실이나 4인실 수가 적용' },
  { id: '8병동_810', ward: '8병동', wardType: 'integrated', room: '810', roomType: '4인실', feeApplied: '4인실', baseRoomKey: '4인실', capacity: 4, note: '' },
  { id: '8병동_811', ward: '8병동', wardType: 'integrated', room: '811', roomType: '4인실', feeApplied: '4인실', baseRoomKey: '4인실', capacity: 4, note: '' },
  { id: '8병동_812', ward: '8병동', wardType: 'integrated', room: '812', roomType: '4인실', feeApplied: '4인실', baseRoomKey: '4인실', capacity: 4, note: '' },
  { id: '8병동_813', ward: '8병동', wardType: 'integrated', room: '813', roomType: '4인실', feeApplied: '4인실', baseRoomKey: '4인실', capacity: 4, note: '' },
  { id: '8병동_814', ward: '8병동', wardType: 'integrated', room: '814', roomType: '4인실', feeApplied: '4인실', baseRoomKey: '4인실', capacity: 4, note: '' },
  { id: '8병동_815', ward: '8병동', wardType: 'integrated', room: '815', roomType: '2인실', feeApplied: '2인실', baseRoomKey: '2인실', capacity: 2, note: '' },
  { id: '8병동_816', ward: '8병동', wardType: 'integrated', room: '816', roomType: '4인실', feeApplied: '4인실', baseRoomKey: '4인실', capacity: 4, note: '' },
  { id: '8병동_817', ward: '8병동', wardType: 'integrated', room: '817', roomType: '4인실', feeApplied: '4인실', baseRoomKey: '4인실', capacity: 4, note: '' },
  { id: '8병동_818', ward: '8병동', wardType: 'integrated', room: '818', roomType: '2인실', feeApplied: '2인실', baseRoomKey: '2인실', capacity: 2, note: '' },
  { id: '8병동_819', ward: '8병동', wardType: 'integrated', room: '819', roomType: '3인실', feeApplied: '4인실', baseRoomKey: '4인실', capacity: 3, note: '3인실이나 4인실 수가 적용' },
  { id: '8병동_820', ward: '8병동', wardType: 'integrated', room: '820', roomType: '4인실', feeApplied: '4인실', baseRoomKey: '4인실', capacity: 4, note: '' }
];
