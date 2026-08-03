// 2026 Haeundae Nanum & Haengbok Hospital Inpatient Fee Database
// Decay points: d15 (1-15 days), d16 (16-30 days), d31 (31+ days)
const INPATIENT_FEE_DB = {
  general: {
    '2인실': { d15: 162560, d16: 148280, d31: 141140 },
    '3인실': { d15: 142390, d16: 130150, d31: 124030 },
    '4인실': { d15: 121990, d16: 111790, d31: 106690 }
  },
  integrated: {
    '2인실': { d15: 243450, d16: 219090, d31: 206920 },
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


// Rehab treatment daily cost constants before insurance
const REHAB_COST_DAILY_BEFORE_INS = {
  intensive: 185000,
  standard: 95000,
  none: 0
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
