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

// 2026 Inpatient Ceiling Thresholds (Annual)
const CEILING_THRESHOLDS_2026 = {
  decile_1: { name: '1분위', threshold: 900000 },
  decile_2_3: { name: '2~3분위', threshold: 1120000 },
  decile_4_5: { name: '4~5분위', threshold: 1730000 },
  decile_6_7: { name: '6~7분위', threshold: 3260000 },
  decile_8: { name: '8분위', threshold: 4460000 },
  decile_9: { name: '9분위', threshold: 5360000 },
  decile_10: { name: '10분위', threshold: 8430000 }
};

// Rehab treatment daily cost constants before insurance
const REHAB_COST_DAILY_BEFORE_INS = {
  intensive: 185000,
  standard: 95000,
  none: 0
};

const ROOM_COP_FIXED = { '2인실': 0.40, '3인실': 0.30 };
const MEAL_COST_PER_MEAL = 8100;
