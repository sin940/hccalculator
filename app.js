// Current State Variables
let selectedWard = '5병동';
let selectedRoom = '8인실'; // Selected room key in WARD_ROOM_CONFIG
let selectedDisease = 'cns_stroke';
let selectedInsurance = 'nhi_general';
let selectedRehab = 'intensive';
let selectedDays = 30;
let selectedMealsPerDay = 3;
let selectedCeilingDecile = 'decile_1';
let selectedExamMode = 'initial'; // 'initial' (첫 달 입원 초기 정밀검사) | 'routine' (2개월차 이후 정기 추적검사)
let includeRobotRehab = true;    // 선별급여 MM304 로봇보행치료 (월 8회 처방)
let includeNonBenefit = true;    // 기본 치료재료대 및 비급여
let emrTableOpen = false;        // EMR 전산 세부표 열림/닫힘 상태

// DOM Elements
const wardSelector = document.getElementById('ward-selector');
const roomSelectorContainer = document.getElementById('room-selector-container');
const roomTipBox = document.getElementById('room-tip-box');
const diseaseSelect = document.getElementById('disease-select');
const onsetDateInput = document.getElementById('onset-date-input');
const admissionDateInput = document.getElementById('admission-date-input');
const goldentimeAlert = document.getElementById('goldentime-alert');
const insuranceSelect = document.getElementById('insurance-select');
const rehabSelector = document.getElementById('rehab-selector');
const daysRange = document.getElementById('days-range');
const daysDisplay = document.getElementById('days-display');
const daysLimitAlert = document.getElementById('days-limit-alert');
const mealsPerDaySelect = document.getElementById('meals-per-day');
const ceilingSelect = document.getElementById('ceiling-select');
const ceilingCard = document.getElementById('ceiling-card');
const ceilingAlert = document.getElementById('ceiling-alert');

// Receipt DOM elements (EMR Itemized Structure)
const recWardRoom = document.getElementById('rec-ward-room');
const recInsurance = document.getElementById('rec-insurance');
const recDays = document.getElementById('rec-days');
const recConsultTotal = document.getElementById('rec-consult-total');
const recBaseRoomTotal = document.getElementById('rec-base-room-total');
const recSurchargeRow = document.getElementById('rec-surcharge-row');
const recSurchargeTotal = document.getElementById('rec-surcharge-total');
const recMealsTotal = document.getElementById('rec-meals-total');
const recMedTotal = document.getElementById('rec-med-total');
const recProcTotal = document.getElementById('rec-proc-total');
const recExamTotal = document.getElementById('rec-exam-total');
const recRehabTotal = document.getElementById('rec-rehab-total');
const recRobotRow = document.getElementById('rec-robot-row');
const recRobotTotal = document.getElementById('rec-robot-total');
const recNonbenefitRow = document.getElementById('rec-nonbenefit-row');
const recNonbenefitTotal = document.getElementById('rec-nonbenefit-total');
const recBasicTotal = document.getElementById('rec-basic-total');
const recCopayBenefit = document.getElementById('rec-copay-benefit');
const recCopayNonBenefit = document.getElementById('rec-copay-non-benefit');
const recGrandTotal = document.getElementById('rec-grand-total');
const receiptFootnote = document.getElementById('receipt-footnote');
const mobilePrice = document.getElementById('mobile-price');
const compareGrid = document.getElementById('compare-grid');
const projectionGrid = document.getElementById('projection-grid');
const emrTableTbody = document.getElementById('emr-table-tbody');
const cmpGenPrice = document.getElementById('cmp-gen-price');
const cmpIntegPrice = document.getElementById('cmp-integ-price');

// Helper functions for Room Configurations mapping
function getRoomBaseKey(roomKey) {
  const config = WARD_ROOM_CONFIG[selectedWard];
  const roomObj = config.rooms[roomKey];
  return roomObj ? roomObj.baseRoomKey : roomKey;
}

function getRoomDisplayName(roomKey) {
  const config = WARD_ROOM_CONFIG[selectedWard];
  const roomObj = config.rooms[roomKey];
  return roomObj ? roomObj.name : roomKey;
}

function getBasicCareDaily(ward, roomKey) {
  const baseKey = getRoomBaseKey(roomKey);
  if (ward === '8병동' && baseKey === '2인실') {
    return 85000;
  }
  if (typeof BASIC_CARE_DAILY_BEFORE_INS !== 'undefined') {
    if (BASIC_CARE_DAILY_BEFORE_INS[ward]) return BASIC_CARE_DAILY_BEFORE_INS[ward];
    const config = WARD_ROOM_CONFIG[ward];
    const type = config ? config.type : 'general';
    if (BASIC_CARE_DAILY_BEFORE_INS[type]) return BASIC_CARE_DAILY_BEFORE_INS[type];
  }
  return (ward === '5병동' || ward === '8병동') ? 50000 : 38000;
}

// ========================================================
// 원무 관리자 실시간 병동/병실별 금액 및 호실 관리 시스템
// ========================================================
const STORAGE_KEY_WARD_FEES = 'HN_CUSTOM_WARD_FEES_V3';
const STORAGE_KEY_WARD_ROOMS = 'HN_CUSTOM_WARD_ROOMS_V3';
const STORAGE_KEY_ADMIN_PIN = 'HN_ADMIN_PIN_V2';
const DEFAULT_ADMIN_PIN = '1234';

let customWardFees = {};
let currentModalDraft = {};
let deletedDraftRooms = new Set();
let activeSettingsTab = 'all';

function loadCustomWardRooms() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_WARD_ROOMS);
    if (raw) {
      const data = JSON.parse(raw);
      if (data && data.rooms) {
        // Rebuild WARD_ROOM_CONFIG
        Object.keys(WARD_ROOM_CONFIG).forEach(w => {
          WARD_ROOM_CONFIG[w].rooms = {};
        });

        Object.keys(data.rooms).forEach(k => {
          const r = data.rooms[k];
          if (!r.deleted) {
            if (!WARD_ROOM_CONFIG[r.ward]) {
              WARD_ROOM_CONFIG[r.ward] = { type: r.type || 'general', rooms: {} };
            }
            WARD_ROOM_CONFIG[r.ward].rooms[r.roomKey] = {
              name: r.name,
              baseRoomKey: r.baseRoomKey
            };
            DEFAULT_WARD_ROOM_SETTINGS[k] = r;
          } else {
            delete DEFAULT_WARD_ROOM_SETTINGS[k];
          }
        });
      }
    }
  } catch (err) {
    console.warn('Failed to load custom ward rooms from LocalStorage:', err);
  }

  // 5병동 4인실 영구 삭제 보장
  if (WARD_ROOM_CONFIG['5병동'] && WARD_ROOM_CONFIG['5병동'].rooms['4인실']) {
    delete WARD_ROOM_CONFIG['5병동'].rooms['4인실'];
  }
  if (DEFAULT_WARD_ROOM_SETTINGS['5병동_4인실']) {
    delete DEFAULT_WARD_ROOM_SETTINGS['5병동_4인실'];
  }
}

function loadCustomWardFees() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_WARD_FEES);
    if (raw) {
      customWardFees = JSON.parse(raw);
    } else {
      customWardFees = {};
    }
  } catch (err) {
    console.warn('Failed to load custom ward fees from LocalStorage:', err);
    customWardFees = {};
  }
}

// 30일 목표 환자본인부담금으로부터 1일 입원료/기본진료비 역산 엔진
function calculateFeesFromTarget(itemDef, target30) {
  const validTarget = Math.max(500000, parseInt(target30, 10) || itemDef.target30);
  
  // 30일 기준 비-입원료 본인부담금 합계 (진찰 5.8만 + 식대 28.5만 + 약제 5.4만 + 처치 1.4만 + 정기검사 3.5만 + 집중재활 125만 + 로봇선별 12.8만 + 비급여 11.4만 = 약 194.2만원)
  const baseNonRoomCopay = 1942500;
  
  // 30일 목표 입원료 본인부담금
  const targetRoomCopay = Math.max(100000, validTarget - baseNonRoomCopay);
  
  // 기본 정의된 30일 입원료 본인부담금
  const default30RoomTotal = (15 * itemDef.d15 + 15 * itemDef.d16);
  const copayMultiplier = itemDef.fixedCopay ? itemDef.fixedCopay : (itemDef.copayRate || 0.20);
  const default30RoomCopay = Math.round(default30RoomTotal * copayMultiplier);
  
  const scale = default30RoomCopay > 0 ? (targetRoomCopay / default30RoomCopay) : 1;
  
  const computedD15 = Math.round(itemDef.d15 * scale);
  const computedD16 = Math.round(itemDef.d16 * scale);
  const computedD31 = Math.round(itemDef.d31 * scale);
  const computedBasic = Math.round((itemDef.basicCareDaily || 50000) * scale);
  
  return {
    d15: computedD15,
    d16: computedD16,
    d31: computedD31,
    basicCareDaily: computedBasic,
    scale: scale,
    target30: validTarget
  };
}

// 실시간 적용 입원료(d15, d16, d31) 조회
function getEffectiveRoomFees(ward, roomKey) {
  const settingKey = `${ward}_${roomKey}`;
  const custom = customWardFees[settingKey];
  const def = DEFAULT_WARD_ROOM_SETTINGS ? DEFAULT_WARD_ROOM_SETTINGS[settingKey] : null;
  
  if (custom && custom.customDailyRoom) {
    return custom.customDailyRoom;
  }
  
  if (custom && custom.target30 && def) {
    const computed = calculateFeesFromTarget(def, custom.target30);
    return { d15: computed.d15, d16: computed.d16, d31: computed.d31 };
  }
  
  if (def) {
    return { d15: def.d15, d16: def.d16, d31: def.d31 };
  }
  
  const config = WARD_ROOM_CONFIG[ward];
  const wardType = config ? config.type : 'general';
  const baseKey = getRoomBaseKey(roomKey);
  if (INPATIENT_FEE_DB[wardType] && INPATIENT_FEE_DB[wardType][baseKey]) {
    return INPATIENT_FEE_DB[wardType][baseKey];
  }
  return { d15: 121990, d16: 111790, d31: 106690 };
}

// 실시간 적용 기본진료·검사·약제비(1일) 조회
function getEffectiveBasicCareDaily(ward, roomKey) {
  const settingKey = `${ward}_${roomKey}`;
  const custom = customWardFees[settingKey];
  const def = DEFAULT_WARD_ROOM_SETTINGS ? DEFAULT_WARD_ROOM_SETTINGS[settingKey] : null;
  
  if (custom && custom.customDailyBasic) {
    return custom.customDailyBasic;
  }
  
  if (custom && custom.target30 && def) {
    const computed = calculateFeesFromTarget(def, custom.target30);
    return computed.basicCareDaily;
  }
  
  if (def) {
    return def.basicCareDaily;
  }
  
  return getBasicCareDaily(ward, roomKey);
}

// View 2 (병실별 시뮬레이터) 실시간 연동 30일 비용 조회
function getEffectiveSimulationRoomFees(ward, roomType, baseRoomKey) {
  let settingRoomKey = baseRoomKey;
  if (ward === '5병동') {
    settingRoomKey = (roomType.includes('8') || roomType.includes('7')) ? '8인실' : '4인실';
  } else if (roomType.includes('3인실') && baseRoomKey === '4인실') {
    settingRoomKey = (ward === '6병동') ? '3인실' : '3인실 [4인실 수가]';
  }
  
  const roomFees = getEffectiveRoomFees(ward, settingRoomKey);
  const basicDaily = getEffectiveBasicCareDaily(ward, settingRoomKey);
  
  let roomBefore = 0;
  for (let d = 1; d <= 30; d++) {
    if (d <= 15) roomBefore += roomFees.d15;
    else roomBefore += roomFees.d16;
  }
  const basicBefore = basicDaily * 30;
  
  const fixedCopay = ROOM_COP_FIXED[baseRoomKey];
  const roomCopay = fixedCopay ? Math.round(roomBefore * fixedCopay) : Math.round(roomBefore * 0.20);
  const basicCopay = Math.round(basicBefore * 0.20);
  
  return { roomBefore, roomCopay, basicBefore, basicCopay };
}

// Google Sheets Integration (Excel XLSX Direct sync)
const GOOGLE_SHEET_XLSX_URL = 'https://docs.google.com/spreadsheets/d/1b3C17xxGgPlXzgsVmKLOkYmnDbnrjficXu73Sr4HF-g/export?format=xlsx';

// Preprocess rows: if any row has only 1 element containing commas, split it
function normalizeExcelRows(rawRows) {
  return rawRows.map(rawRow => {
    if (!rawRow || rawRow.length === 0) return [];
    
    // If it has elements, but all elements after index 0 are empty, and index 0 contains commas
    const hasOnlyFirstCell = rawRow.length === 1 || rawRow.slice(1).every(cell => cell === null || cell === undefined || cell.toString().trim() === '');
    if (hasOnlyFirstCell && rawRow[0] !== undefined && rawRow[0] !== null) {
      const firstCellStr = rawRow[0].toString();
      if (firstCellStr.includes(',')) {
        // Parse CSV string into array
        return splitCSVLine(firstCellStr);
      }
    }
    return rawRow.map(cell => cell !== null && cell !== undefined ? cell.toString().trim() : '');
  });
}

// Simple CSV line splitter that handles quotes
function splitCSVLine(text) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      inQuotes = !inQuotes;
    } else if (c === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += c;
    }
  }
  result.push(current.trim());
  return result;
}

// Helper to look up values in 2D array by header name
function getValueByHeader(row, headers, headerName) {
  const idx = headers.indexOf(headerName);
  if (idx !== -1 && row[idx] !== undefined) {
    return row[idx].toString().trim();
  }
  return '';
}

function getNumberValueByHeader(row, headers, headerName) {
  const valStr = getValueByHeader(row, headers, headerName);
  return parseInt(valStr.replace(/[^0-9]/g, ''), 10);
}

// Find header row index containing specific keys
function findHeaderRowIndex(rows, targetHeaders) {
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (row && row.length > 0) {
      const matched = targetHeaders.every(header => 
        row.some(cell => cell !== null && cell !== undefined && cell.toString().trim() === header)
      );
      if (matched) return i;
    }
  }
  return -1;
}

// Parse Inpatient Rates sheet
function parseInpatientRates(rows) {
  const headerIdx = findHeaderRowIndex(rows, ["유형", "인실", "1-15일"]);
  if (headerIdx === -1) return;
  
  const headers = rows[headerIdx].map(h => h ? h.toString().trim() : '');
  const dataRows = rows.slice(headerIdx + 1);
  const tempInpatientRates = { general: {}, integrated: {} };
  
  dataRows.forEach(row => {
    if (!row || row.length === 0) return;
    const type = getValueByHeader(row, headers, "유형");
    const roomSize = getValueByHeader(row, headers, "인실");
    const d15Val = getNumberValueByHeader(row, headers, "1-15일");
    const d16Val = getNumberValueByHeader(row, headers, "16-30일");
    const d31Val = getNumberValueByHeader(row, headers, "31일이상");
    
    if ((type === 'general' || type === 'integrated') && roomSize && !isNaN(d15Val)) {
      if (!tempInpatientRates[type][roomSize]) {
        tempInpatientRates[type][roomSize] = {};
      }
      tempInpatientRates[type][roomSize].d15 = d15Val;
      tempInpatientRates[type][roomSize].d16 = isNaN(d16Val) ? d15Val : d16Val;
      tempInpatientRates[type][roomSize].d31 = isNaN(d31Val) ? d15Val : d31Val;
    }
  });
  
  if (Object.keys(tempInpatientRates.general).length > 0) {
    Object.assign(INPATIENT_FEE_DB.general, tempInpatientRates.general);
  }
  if (Object.keys(tempInpatientRates.integrated).length > 0) {
    Object.assign(INPATIENT_FEE_DB.integrated, tempInpatientRates.integrated);
  }
  // 일반병동 2인실(715호) 병원비 약 390만원 기준 고정 수가 (일 168,125원, 30일 입원료 본인부담 약 201.7만원)
  if (INPATIENT_FEE_DB.general && INPATIENT_FEE_DB.general['2인실']) {
    INPATIENT_FEE_DB.general['2인실'] = { d15: 168125, d16: 168125, d31: 168125 };
  }
  // 간호간병통합 2인실은 영수증 확인 수가(일 243,450원) 기준 체감 미적용 고정 수가 유지
  if (INPATIENT_FEE_DB.integrated && INPATIENT_FEE_DB.integrated['2인실']) {
    INPATIENT_FEE_DB.integrated['2인실'] = { d15: 243450, d16: 243450, d31: 243450 };
  }
}

// Parse Rehab Cost sheet
function parseRehabRates(rows) {
  const headerIdx = findHeaderRowIndex(rows, ["재활유형", "일일비용"]);
  if (headerIdx === -1) return;
  
  const headers = rows[headerIdx].map(h => h ? h.toString().trim() : '');
  const dataRows = rows.slice(headerIdx + 1);
  const tempRehabRates = {};
  
  dataRows.forEach(row => {
    if (!row || row.length === 0) return;
    const key = getValueByHeader(row, headers, "재활유형");
    const val = getNumberValueByHeader(row, headers, "일일비용");
    if (key && !isNaN(val)) {
      tempRehabRates[key] = val;
    }
  });
  
  if (tempRehabRates.intensive && tempRehabRates.intensive < 215000) {
    tempRehabRates.intensive = 215000;
  }

  if (Object.keys(tempRehabRates).length > 0) {
    Object.assign(REHAB_COST_DAILY_BEFORE_INS, tempRehabRates);
  }
}

// Parse Meal Cost sheet
function parseMealCost(rows) {
  const headerIdx = findHeaderRowIndex(rows, ["식사구분", "식사료단가"]);
  if (headerIdx === -1) return;
  
  const headers = rows[headerIdx].map(h => h ? h.toString().trim() : '');
  const dataRows = rows.slice(headerIdx + 1);
  
  dataRows.forEach(row => {
    if (!row || row.length === 0) return;
    const val = getNumberValueByHeader(row, headers, "식사료단가");
    if (!isNaN(val)) {
      MEAL_COST_PER_MEAL = val;
    }
  });
}

// Parse Ceiling Thresholds sheet
function parseCeilingThresholds(rows) {
  const headerIdx = findHeaderRowIndex(rows, ["분위", "소득구간", "상한액"]);
  if (headerIdx === -1) return;
  
  const headers = rows[headerIdx].map(h => h ? h.toString().trim() : '');
  const dataRows = rows.slice(headerIdx + 1);
  const tempCeilingThresholds = {};
  
  dataRows.forEach(row => {
    if (!row || row.length === 0) return;
    const decileKey = getValueByHeader(row, headers, "분위");
    const sectionName = getValueByHeader(row, headers, "소득구간");
    const thresholdVal = getNumberValueByHeader(row, headers, "상한액");
    const longStayThresholdVal = getNumberValueByHeader(row, headers, "요양병원120일초과상한액");
    
    let dbKey = null;
    if (decileKey.includes('1분위')) dbKey = 'decile_1';
    else if (decileKey.includes('2~3분위')) dbKey = 'decile_2_3';
    else if (decileKey.includes('4~5분위')) dbKey = 'decile_4_5';
    else if (decileKey.includes('6~7분위')) dbKey = 'decile_6_7';
    else if (decileKey.includes('8분위')) dbKey = 'decile_8';
    else if (decileKey.includes('9분위')) dbKey = 'decile_9';
    else if (decileKey.includes('10분위')) dbKey = 'decile_10';
    
    if (dbKey && !isNaN(thresholdVal)) {
      tempCeilingThresholds[dbKey] = {
        name: `${sectionName} (${decileKey})`,
        threshold: thresholdVal,
        longStayThreshold: isNaN(longStayThresholdVal) ? thresholdVal : longStayThresholdVal
      };
    }
  });
  
  if (Object.keys(tempCeilingThresholds).length > 0) {
    Object.assign(CEILING_THRESHOLDS_2026, tempCeilingThresholds);
    if (tempCeilingThresholds.decile_10) {
      MAX_PREPAY_CEILING_2026.standard = tempCeilingThresholds.decile_10.threshold;
      MAX_PREPAY_CEILING_2026.longStay = tempCeilingThresholds.decile_10.longStayThreshold;
    }
  }
}

// Parse Contacts sheet
function parseContactDirectory(rows) {
  const headerIdx = findHeaderRowIndex(rows, ["구분", "이름", "전화번호"]);
  if (headerIdx === -1) return;
  
  const headers = rows[headerIdx].map(h => h ? h.toString().trim() : '');
  const dataRows = rows.slice(headerIdx + 1);
  const tempContacts = [];
  
  dataRows.forEach(row => {
    if (!row || row.length === 0) return;
    const cat = getValueByHeader(row, headers, "구분");
    const name = getValueByHeader(row, headers, "이름");
    const tel = getValueByHeader(row, headers, "전화번호");
    const er = getValueByHeader(row, headers, "응급실번호");
    const fax = getValueByHeader(row, headers, "팩스번호");
    const query = getValueByHeader(row, headers, "검색어") || name;
    if (cat && name) {
      tempContacts.push({
        category: cat,
        name: name,
        tel: tel,
        er: er,
        fax: fax,
        query: query
      });
    }
  });
  
  if (tempContacts.length > 0) {
    CONTACT_DIRECTORY.length = 0;
    CONTACT_DIRECTORY.push(...tempContacts);
  }
}

// Parse Patient Types sheet
function parseCopayRates(rows) {
  const headerIdx = findHeaderRowIndex(rows, ["코드", "구분명", "본인부담률"]);
  if (headerIdx === -1) return;
  const headers = rows[headerIdx].map(h => h ? h.toString().trim() : '');
  const dataRows = rows.slice(headerIdx + 1);
  const tempCopay = {};
  dataRows.forEach(row => {
    if (!row || row.length === 0) return;
    const code = getValueByHeader(row, headers, "코드");
    const name = getValueByHeader(row, headers, "구분명");
    const rateStr = getValueByHeader(row, headers, "본인부담률");
    const type = getValueByHeader(row, headers, "유형");
    const label = getValueByHeader(row, headers, "상세설명");
    
    let rate = parseFloat(rateStr);
    if (isNaN(rate)) rate = null;
    
    if (code && name) {
      tempCopay[code] = { name, rate, type, label };
    }
  });
  if (Object.keys(tempCopay).length > 0) {
    for (const k in COPAY_RATES) delete COPAY_RATES[k];
    Object.assign(COPAY_RATES, tempCopay);
  }
}

// Parse Disease Guidelines sheet
function parseDiseaseGuidelines(rows) {
  const headerIdx = findHeaderRowIndex(rows, ["코드", "질환명", "발병후기한"]);
  if (headerIdx === -1) return;
  const headers = rows[headerIdx].map(h => h ? h.toString().trim() : '');
  const dataRows = rows.slice(headerIdx + 1);
  const tempDisease = {};
  dataRows.forEach(row => {
    if (!row || row.length === 0) return;
    const code = getValueByHeader(row, headers, "코드");
    const name = getValueByHeader(row, headers, "질환명");
    const onsetLimit = getNumberValueByHeader(row, headers, "발병후기한");
    const stayLimit = getNumberValueByHeader(row, headers, "입원한도");
    const category = getValueByHeader(row, headers, "분류");
    
    if (code && name) {
      tempDisease[code] = { name, onsetLimit, stayLimit, category };
    }
  });
  if (Object.keys(tempDisease).length > 0) {
    for (const k in DISEASE_GUIDELINES) delete DISEASE_GUIDELINES[k];
    Object.assign(DISEASE_GUIDELINES, tempDisease);
  }
}

// Parse Ward Room Config sheet
function parseWardRoomConfig(rows) {
  const headerIdx = findHeaderRowIndex(rows, ["병동", "입원유형", "인실키"]);
  if (headerIdx === -1) return;
  const headers = rows[headerIdx].map(h => h ? h.toString().trim() : '');
  const dataRows = rows.slice(headerIdx + 1);
  const tempConfig = {};
  dataRows.forEach(row => {
    if (!row || row.length === 0) return;
    const ward = getValueByHeader(row, headers, "병동");
    const type = getValueByHeader(row, headers, "입원유형");
    const roomKey = getValueByHeader(row, headers, "인실키");
    const displayName = getValueByHeader(row, headers, "출력용이름");
    const baseRoomKey = getValueByHeader(row, headers, "수가용인실");
    
    if (ward && type && roomKey) {
      if (!tempConfig[ward]) {
        tempConfig[ward] = { type: type, rooms: {} };
      }
      tempConfig[ward].rooms[roomKey] = {
        name: displayName,
        baseRoomKey: baseRoomKey
      };
    }
  });
  if (Object.keys(tempConfig).length > 0) {
    for (const k in WARD_ROOM_CONFIG) delete WARD_ROOM_CONFIG[k];
    Object.assign(WARD_ROOM_CONFIG, tempConfig);
  }
}

async function loadDataFromGoogleSheets() {
  try {
    const res = await fetch(`${GOOGLE_SHEET_XLSX_URL}&t=${Date.now()}`);
    if (!res.ok) throw new Error('Network response was not ok');
    const arrayBuffer = await res.arrayBuffer();
    
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });
    
    // 1. 입원료수가
    const inpatientSheet = workbook.Sheets['입원료수가'];
    if (inpatientSheet) {
      let rows = XLSX.utils.sheet_to_json(inpatientSheet, { header: 1, defval: '' });
      rows = normalizeExcelRows(rows);
      parseInpatientRates(rows);
    }
    
    // 2. 재활치료료
    const rehabSheet = workbook.Sheets['재활치료료'];
    if (rehabSheet) {
      let rows = XLSX.utils.sheet_to_json(rehabSheet, { header: 1, defval: '' });
      rows = normalizeExcelRows(rows);
      parseRehabRates(rows);
    }
    
    // 3. 식사료
    const mealSheet = workbook.Sheets['식사료'];
    if (mealSheet) {
      let rows = XLSX.utils.sheet_to_json(mealSheet, { header: 1, defval: '' });
      rows = normalizeExcelRows(rows);
      parseMealCost(rows);
    }
    
    // 4. 본인부담상한제
    const ceilingSheet = workbook.Sheets['본인부담상한제'];
    if (ceilingSheet) {
      let rows = XLSX.utils.sheet_to_json(ceilingSheet, { header: 1, defval: '' });
      rows = normalizeExcelRows(rows);
      parseCeilingThresholds(rows);
    }
    
    // 5. 연락처
    const contactSheet = workbook.Sheets['연락처'];
    if (contactSheet) {
      let rows = XLSX.utils.sheet_to_json(contactSheet, { header: 1, defval: '' });
      rows = normalizeExcelRows(rows);
      parseContactDirectory(rows);
    }

    // 6. 환자구분
    const copaySheet = workbook.Sheets['환자구분'];
    if (copaySheet) {
      let rows = XLSX.utils.sheet_to_json(copaySheet, { header: 1, defval: '' });
      rows = normalizeExcelRows(rows);
      parseCopayRates(rows);
    }

    // 7. 질환군
    const diseaseSheet = workbook.Sheets['질환군'];
    if (diseaseSheet) {
      let rows = XLSX.utils.sheet_to_json(diseaseSheet, { header: 1, defval: '' });
      rows = normalizeExcelRows(rows);
      parseDiseaseGuidelines(rows);
    }

    // 8. 병동설정
    const wardSheet = workbook.Sheets['병동설정'];
    if (wardSheet) {
      let rows = XLSX.utils.sheet_to_json(wardSheet, { header: 1, defval: '' });
      rows = normalizeExcelRows(rows);
      parseWardRoomConfig(rows);
    }
    
    console.log('Google Sheets Excel database successfully synced!');
  } catch (err) {
    console.warn('Failed to load Google Sheets Excel database. Fallback active.', err);
  }
}

// Initialization
async function init() {
  // Sync with Google Sheets first, fallback to data.js on error
  await loadDataFromGoogleSheets();

  // Load custom ward rooms and fees from LocalStorage
  loadCustomWardRooms();
  loadCustomWardFees();

  // Date setup (defaulting to current date and onset 1 month ago)
  const todayStr = new Date().toISOString().split('T')[0];
  const pastStr = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  document.getElementById('onset-date-input').value = pastStr;
  document.getElementById('admission-date-input').value = todayStr;

  setupEventListeners();
  renderRoomSelector();
  checkGoldenTime();
  calculateAll();
  initRoomSimulation();
}

function setupEventListeners() {
  // Ward selection
  wardSelector.querySelectorAll('.btn-opt').forEach(btn => {
    btn.addEventListener('click', () => {
      wardSelector.querySelectorAll('.btn-opt').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      selectedWard = btn.getAttribute('data-ward');
      renderRoomSelector();
      calculateAll();
    });
  });

  // Disease selection
  diseaseSelect.addEventListener('change', (e) => {
    selectedDisease = e.target.value;
    checkGoldenTime();
    checkDaysStayLimit();
    calculateAll();
  });

  // Date inputs
  onsetDateInput.addEventListener('change', () => {
    checkGoldenTime();
    calculateAll();
  });
  admissionDateInput.addEventListener('change', () => {
    checkGoldenTime();
    calculateAll();
  });

  // Insurance type selection
  insuranceSelect.addEventListener('change', (e) => {
    selectedInsurance = e.target.value;
    const insType = COPAY_RATES[selectedInsurance].type;
    if (insType === 'workers_comp' || insType === 'medical') {
      ceilingCard.style.display = 'none';
    } else if (insType === 'special_billing') {
      ceilingCard.style.display = 'none';
    } else {
      ceilingCard.style.display = 'block';
    }
    calculateAll();
  });

  // Rehab selection
  rehabSelector.querySelectorAll('.btn-opt').forEach(btn => {
    btn.addEventListener('click', () => {
      rehabSelector.querySelectorAll('.btn-opt').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      selectedRehab = btn.getAttribute('data-rehab');
      calculateAll();
    });
  });

  // Days Slider
  daysRange.addEventListener('input', (e) => {
    selectedDays = parseInt(e.target.value);
    daysDisplay.innerHTML = `${selectedDays}<span>일</span>`;
    updateDaysPresetButtons();
    checkDaysStayLimit();
    calculateAll();
  });

  // Presets days clicks
  document.querySelectorAll('.btn-preset').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.btn-preset').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      selectedDays = parseInt(btn.getAttribute('data-days'));
      daysRange.value = selectedDays;
      daysDisplay.innerHTML = `${selectedDays}<span>일</span>`;
      checkDaysStayLimit();
      calculateAll();
    });
  });

  // Meals count
  mealsPerDaySelect.addEventListener('change', (e) => {
    selectedMealsPerDay = parseInt(e.target.value);
    calculateAll();
  });

  // Ceiling Decile
  ceilingSelect.addEventListener('change', (e) => {
    selectedCeilingDecile = e.target.value;
    calculateAll();
  });

  const longStayCheckbox = document.getElementById('long-stay-checkbox');
  if (longStayCheckbox) {
    longStayCheckbox.addEventListener('change', () => {
      calculateAll();
    });
  }
}

function updateDaysPresetButtons() {
  document.querySelectorAll('.btn-preset').forEach(btn => {
    const val = parseInt(btn.getAttribute('data-days'));
    if (val === selectedDays) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });
}

function renderRoomSelector() {
  const config = WARD_ROOM_CONFIG[selectedWard];
  const rooms = Object.keys(config.rooms);
  
  // Auto-fallback if the current selected room is not in the new ward
  if (!rooms.includes(selectedRoom)) {
    selectedRoom = rooms[0];
  }

  roomSelectorContainer.innerHTML = '';
  const gridClass = rooms.length === 3 ? 'grid3' : rooms.length === 2 ? 'grid2' : 'grid4';
  const containerDiv = document.createElement('div');
  containerDiv.className = gridClass;

  rooms.forEach(r => {
    const roomObj = config.rooms[r];
    const baseKey = roomObj.baseRoomKey;
    const fixedCopay = ROOM_COP_FIXED[baseKey];
    const isCeilingApply = !fixedCopay;
    
    const optBtn = document.createElement('div');
    optBtn.className = `btn-opt${r === selectedRoom ? ' active' : ''}`;
    
    let subBadgeText = fixedCopay ? `${fixedCopay * 100}% 고정` : '질환별 차등';
    let badgeColorClass = fixedCopay ? 'badge-amber' : 'badge-teal';
    let ceilingText = isCeilingApply ? '상한제 ○' : '상한제 ✕';
    let ceilingBadgeClass = isCeilingApply ? 'badge-teal' : 'badge-rose';

    optBtn.innerHTML = `
      <span class="btn-opt-title" style="font-size:12px">${roomObj.name}</span>
      <div style="display:flex; gap:4px; margin-top:6px;">
        <span class="btn-opt-badge ${badgeColorClass}">${subBadgeText}</span>
        <span class="btn-opt-badge ${ceilingBadgeClass}">${ceilingText}</span>
      </div>
    `;

    optBtn.addEventListener('click', () => {
      containerDiv.querySelectorAll('.btn-opt').forEach(b => b.classList.remove('active'));
      optBtn.classList.add('active');
      selectedRoom = r;
      updateRoomTip();
      calculateAll();
    });

    containerDiv.appendChild(optBtn);
  });

  roomSelectorContainer.appendChild(containerDiv);
  updateRoomTip();
}

function updateRoomTip() {
  const baseKey = getRoomBaseKey(selectedRoom);
  const dispName = getRoomDisplayName(selectedRoom);
  const fixedCopay = ROOM_COP_FIXED[baseKey];
  if (fixedCopay) {
    roomTipBox.className = "notice-box box-warning";
    roomTipBox.innerHTML = `
      <span class="notice-box-icon">⚠️</span>
      <span>선택하신 <strong>${dispName}</strong>은 상급병실 정책에 의해 본인부담금 <strong>${fixedCopay * 100}%가 고정 부과</strong>되며, 연간 본인부담상한제 합산 및 환급액 산정 대상에서 제외됩니다.</span>
    `;
  } else {
    roomTipBox.className = "notice-box box-success";
    roomTipBox.innerHTML = `
      <span class="notice-box-icon">✅</span>
      <span>선택하신 <strong>${dispName}</strong>은 기준병실(또는 4인실 수가 적용 병실)로 인정되어 <strong>환자의 보험 유형별 본인부담률이 적용</strong>되며, 연간 본인부담상한제 혜택(환급 등) 대상에 포함됩니다.</span>
    `;
  }
}

// Check Rehabilitation Golden Time (onset vs. admission date)
function checkGoldenTime() {
  const onsetVal = document.getElementById('onset-date-input').value;
  const admissionVal = document.getElementById('admission-date-input').value;
  
  if (!onsetVal || !admissionVal) return;

  const onsetDate = new Date(onsetVal);
  const admissionDate = new Date(admissionVal);
  
  const timeDiff = admissionDate.getTime() - onsetDate.getTime();
  const daysDiff = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
  
  const rule = DISEASE_GUIDELINES[selectedDisease];
  
  let html = '';
  if (daysDiff < 0) {
    goldentimeAlert.className = "notice-box box-danger";
    goldentimeAlert.innerHTML = `
      <span class="notice-box-icon">❌</span>
      <span>날짜 설정 오류: 입원일이 발병일(수술일)보다 빠릅니다. 올바른 날짜를 입력해 주세요.</span>
    `;
    return;
  }

  const isWithinLimit = daysDiff <= rule.onsetLimit;
  
  if (isWithinLimit) {
    goldentimeAlert.className = "notice-box box-success";
    html = `
      <span class="notice-box-icon">✅</span>
      <div>
        <strong>재활 골든타임 준수 (발병 후 ${daysDiff}일 경과)</strong><br>
        <span>심평원 고시 기준 ${rule.category} 질환 입원 적격 시기(발병 후 ${rule.onsetLimit}일 이내)에 부합합니다. 집중 재활 급여 요율을 100% 보장받으실 수 있습니다. (최대 ${rule.stayLimit}일 집중치료 가능)</span>
      </div>
    `;
  } else {
    goldentimeAlert.className = "notice-box box-warning";
    html = `
      <span class="notice-box-icon">⚠️</span>
      <div>
        <strong>심평원 고시 기준 입원 적격 시기 초과 (발병 후 ${daysDiff}일 경과)</strong><br>
        <span>선택하신 질환은 발병일로부터 <strong>${rule.onsetLimit}일 이내</strong> 입원해야 집중 재활 의료기관 수가 적용이 가능합니다. 현재 기준을 초과하여 삭감이나 일반 입원료 청구 대상이 될 수 있으니 원무팀에 예외 소견 여부를 즉시 상담하세요.</span>
      </div>
    `;
  }
  
  goldentimeAlert.innerHTML = html;
}

// Check Inpatient Days Stay Limit
function checkDaysStayLimit() {
  const rule = DISEASE_GUIDELINES[selectedDisease];
  if (selectedDays > rule.stayLimit) {
    daysLimitAlert.className = "notice-box box-warning";
    daysLimitAlert.style.display = "flex";
    daysLimitAlert.innerHTML = `
      <span class="notice-box-icon">⚠️</span>
      <span>심평원 고시 기준 <strong>${rule.name}</strong>의 최대 회복기 집중재활 입원기간은 <strong>${rule.stayLimit}일</strong>입니다. 설정하신 입원 일수(${selectedDays}일) 중 ${rule.stayLimit}일을 초과한 기간은 재활 수가가 제한되거나 일반 수가가 부과될 수 있습니다.</span>
    `;
  } else {
    daysLimitAlert.style.display = "none";
  }
}

// Step 5 Interactive Handlers
function setExamMode(mode) {
  selectedExamMode = mode;
  const btnInit = document.getElementById('btn-exam-initial');
  const btnRoutine = document.getElementById('btn-exam-routine');
  if (btnInit && btnRoutine) {
    if (mode === 'initial') {
      btnInit.classList.add('active');
      btnRoutine.classList.remove('active');
    } else {
      btnRoutine.classList.add('active');
      btnInit.classList.remove('active');
    }
  }
  calculateAll();
}

function toggleRobotRehab(checked) {
  includeRobotRehab = !!checked;
  calculateAll();
}

function toggleNonBenefit(checked) {
  includeNonBenefit = !!checked;
  calculateAll();
}

function toggleEmrTable() {
  emrTableOpen = !emrTableOpen;
  const drawer = document.getElementById('emr-table-drawer');
  const arrow = document.getElementById('emr-toggle-arrow');
  if (drawer) {
    if (emrTableOpen) {
      drawer.classList.add('open');
      if (arrow) arrow.textContent = '▲';
    } else {
      drawer.classList.remove('open');
      if (arrow) arrow.textContent = '▼';
    }
  }
}

// Helper: Custom Room Total Calculation (EMR Itemized Standard)
function calcCustomRoomTotal(ward, roomKey, days, insObj, generalCopayRate, examMode = selectedExamMode) {
  const roomFees = getEffectiveRoomFees(ward, roomKey);
  const baseKey = (WARD_ROOM_CONFIG[ward] && WARD_ROOM_CONFIG[ward].rooms[roomKey]) 
    ? WARD_ROOM_CONFIG[ward].rooms[roomKey].baseRoomKey 
    : roomKey;
  const fixedCopay = ROOM_COP_FIXED[baseKey];
  
  let roomTotal = 0;
  for (let d = 1; d <= days; d++) {
    if (d <= 15) roomTotal += roomFees.d15;
    else if (d <= 30) roomTotal += roomFees.d16;
    else roomTotal += roomFees.d31;
  }
  
  let roomCopay = 0;
  if (insObj.type === 'workers_comp') {
    if (fixedCopay) {
      const base4RoomFees = getEffectiveRoomFees(ward, '4인실');
      let total4RoomFee = 0;
      for (let d = 1; d <= days; d++) {
        if (d <= 15) total4RoomFee += base4RoomFees.d15;
        else if (d <= 30) total4RoomFee += base4RoomFees.d16;
        else total4RoomFee += base4RoomFees.d31;
      }
      roomCopay = Math.max(0, roomTotal - total4RoomFee);
    } else {
      roomCopay = 0;
    }
  } else {
    roomCopay = fixedCopay ? Math.round(roomTotal * fixedCopay) : Math.round(roomTotal * generalCopayRate);
  }
  
  const consultCopay = (insObj.type === 'workers_comp') ? 0 : Math.round((EMR_FEES_BASELINE.consult.total / 30) * days * generalCopayRate);
  
  let mealCopayRate = 0.50;
  if (insObj.type === 'workers_comp') mealCopayRate = 0.00;
  else if (insObj.type === 'medical') mealCopayRate = 0.20;
  const mealsCopay = Math.round(selectedMealsPerDay * days * MEAL_COST_PER_MEAL * mealCopayRate);
  
  const medCopay = (insObj.type === 'workers_comp') ? 0 : Math.round(((EMR_FEES_BASELINE.medAction.total + EMR_FEES_BASELINE.medMaterial.total) / 30) * days * generalCopayRate);
  const procCopay = (insObj.type === 'workers_comp') ? 0 : Math.round((EMR_FEES_BASELINE.procSurg.total / 30) * days * generalCopayRate);
  
  const examData = (examMode === 'initial') ? EMR_FEES_BASELINE.initialMonthExam : EMR_FEES_BASELINE.routineMonthExam;
  const examTotal = (examMode === 'initial') ? (days >= 15 ? examData.total : Math.round((examData.total / 15) * days)) : Math.round((examData.total / 30) * days);
  const examCopay = (insObj.type === 'workers_comp') ? 0 : Math.round(examTotal * generalCopayRate);
  
  let totalRehabBeforeIns = 0;
  if (selectedRehab === 'intensive') {
    totalRehabBeforeIns = Math.round((EMR_FEES_BASELINE.rehab.total / 30) * days);
  } else if (selectedRehab === 'standard') {
    totalRehabBeforeIns = Math.round(((EMR_FEES_BASELINE.rehab.total * 0.52) / 30) * days);
  }
  const rehabCopay = (insObj.type === 'workers_comp') ? 0 : Math.round(totalRehabBeforeIns * generalCopayRate);
  
  const robotCopay = includeRobotRehab ? ((insObj.type === 'workers_comp') ? 0 : Math.round((EMR_FEES_BASELINE.robotRehab.total / 30) * days * 0.50)) : 0;
  const nonBenefitCopay = includeNonBenefit ? Math.round((EMR_FEES_BASELINE.nonBenefit.total / 30) * days) : 0;
  
  return roomCopay + consultCopay + mealsCopay + medCopay + procCopay + examCopay + rehabCopay + robotCopay + nonBenefitCopay;
}

// EMR 전산 세부표 동적 렌더링
function renderEmrTable(items) {
  if (!emrTableTbody) return;
  
  const rowsData = [
    { name: '1. 진찰료', total: items.consultTotalBefore, copay: items.consultCopay },
    { name: '2. 입원료 (간호간병/일반)', total: items.baseRoomTotal, copay: items.roomCopayPatient },
    { name: '3. 식사료 (급여 식대)', total: items.totalMealCostBeforeIns, copay: items.mealCopayPatient },
    { name: '4. 투약료 (행위+재료)', total: items.medTotalBefore, copay: items.medCopayPatient },
    { name: '5. 처치 및 수술료', total: items.procSurgBefore, copay: items.procSurgCopay },
    { name: '6. 검사 및 영상료', total: items.examTotalBefore, copay: items.examCopayPatient },
    { name: '7. 전문 재활치료료', total: items.totalRehabBeforeIns, copay: items.rehabCopayPatient },
    { name: '8. 선별급여 (로봇보행)', total: items.robotTotalBefore, copay: items.robotCopayPatient },
    { name: '9. 치료재료/비급여', total: items.nonBenefitTotalBefore, copay: items.nonBenefitCopayPatient }
  ];

  let sumTotal = 0;
  let sumCorp = 0;
  let sumCopay = 0;

  let html = '';
  rowsData.forEach(r => {
    if (r.total === 0 && r.copay === 0) return;
    const corp = Math.max(0, r.total - r.copay);
    sumTotal += r.total;
    sumCorp += corp;
    sumCopay += r.copay;
    html += `
      <tr>
        <td>${r.name}</td>
        <td>${fmt(r.total)}</td>
        <td>${fmt(corp)}</td>
        <td style="font-weight:700; color:var(--teal-700);">${fmt(r.copay)}</td>
      </tr>
    `;
  });

  html += `
    <tr class="emr-total-row">
      <td><strong>합계</strong></td>
      <td><strong>${fmt(sumTotal)}</strong></td>
      <td><strong>${fmt(sumCorp)}</strong></td>
      <td style="color:var(--teal-700); font-weight:800;"><strong>${fmt(sumCopay)}</strong></td>
    </tr>
  `;

  emrTableTbody.innerHTML = html;
}

// 간호간병통합 vs 일반병동 한 달 실부담금 비교 카드 갱신
function updateWardComparePrices(insObj, generalCopayRate) {
  if (!cmpGenPrice || !cmpIntegPrice) return;
  
  if (insObj.type === 'special_billing') {
    cmpGenPrice.textContent = '병원비: 별도 산정';
    cmpIntegPrice.textContent = '병원비: 별도 산정';
    return;
  }
  
  const genTotal = calcCustomRoomTotal('6병동', '4인실', 30, insObj, generalCopayRate);
  const integ5Total = calcCustomRoomTotal('5병동', '8인실', 30, insObj, generalCopayRate);
  const integ8Total = calcCustomRoomTotal('8병동', '4인실', 30, insObj, generalCopayRate);
  
  cmpGenPrice.textContent = `병원비: 약 ${fmt(genTotal)}`;
  cmpIntegPrice.textContent = `병원비: 약 ${fmt(integ5Total)} ~ ${fmt(integ8Total)}`;
}

// Calculation Engine
function calculateAll() {
  const config = WARD_ROOM_CONFIG[selectedWard];
  const wardType = config ? config.type : 'integrated';
  const baseRoomKey = getRoomBaseKey(selectedRoom);
  const roomDisplayName = getRoomDisplayName(selectedRoom);
  const roomFees = getEffectiveRoomFees(selectedWard, selectedRoom);
  
  const insObj = COPAY_RATES[selectedInsurance];
  const generalCopayRate = (insObj.rate !== null && insObj.rate !== undefined) ? insObj.rate : 0.20;
  const fixedCopayRate = ROOM_COP_FIXED[baseRoomKey];
  const isUpperRoom = !!fixedCopayRate;

  // 1. 진찰료 (Consultation)
  const consultTotalBefore = Math.round((EMR_FEES_BASELINE.consult.total / 30) * selectedDays);
  const consultCopay = (insObj.type === 'workers_comp') ? 0 : Math.round(consultTotalBefore * generalCopayRate);

  // 2. 입원료 (Inpatient Room)
  let baseRoomTotal = 0;
  for (let d = 1; d <= selectedDays; d++) {
    if (d <= 15) baseRoomTotal += roomFees.d15;
    else if (d <= 30) baseRoomTotal += roomFees.d16;
    else baseRoomTotal += roomFees.d31;
  }

  let surchargeTotal = 0;
  let roomCopayPatient = 0;

  if (insObj.type === 'workers_comp') {
    if (isUpperRoom) {
      const base4RoomFees = getEffectiveRoomFees(selectedWard, '4인실');
      let total4RoomFee = 0;
      for (let d = 1; d <= selectedDays; d++) {
        if (d <= 15) total4RoomFee += base4RoomFees.d15;
        else if (d <= 30) total4RoomFee += base4RoomFees.d16;
        else total4RoomFee += base4RoomFees.d31;
      }
      surchargeTotal = Math.max(0, baseRoomTotal - total4RoomFee);
      roomCopayPatient = surchargeTotal;
    } else {
      surchargeTotal = 0;
      roomCopayPatient = 0;
    }
  } else {
    if (isUpperRoom) {
      roomCopayPatient = Math.round(baseRoomTotal * fixedCopayRate);
    } else {
      roomCopayPatient = Math.round(baseRoomTotal * generalCopayRate);
    }
  }

  // 3. 식사료 (Meals)
  const totalMealsCount = selectedMealsPerDay * selectedDays;
  const totalMealCostBeforeIns = totalMealsCount * MEAL_COST_PER_MEAL;
  let mealCopayRate = 0.50;
  if (insObj.type === 'workers_comp') {
    mealCopayRate = 0.00;
  } else if (insObj.type === 'medical') {
    mealCopayRate = 0.20;
  }
  const mealCopayPatient = Math.round(totalMealCostBeforeIns * mealCopayRate);

  // Meal cost display update based on selected insurance
  const mealCostInfo = document.getElementById('meal-cost-info');
  if (mealCostInfo) {
    if (insObj.type === 'workers_comp') {
      mealCostInfo.value = `1끼 8,100원 · ${selectedDays}일 ${fmt(totalMealCostBeforeIns)} (산재 100% 지원: 환자부담 0원)`;
    } else if (insObj.type === 'medical') {
      mealCostInfo.value = `1끼 8,100원 · ${selectedDays}일 ${fmt(totalMealCostBeforeIns)} (의료급여 80% 지원: 환자부담 ${fmt(mealCopayPatient)})`;
    } else if (insObj.type === 'special_billing') {
      mealCostInfo.value = `1끼 8,100원 · ${selectedDays}일 ${fmt(totalMealCostBeforeIns)} (별도 산정)`;
    } else {
      mealCostInfo.value = `1끼 8,100원 · ${selectedDays}일 ${fmt(totalMealCostBeforeIns)} (건보 50% 지원: 환자부담 ${fmt(mealCopayPatient)})`;
    }
  }

  // Handle special billing category (의료급여 1종, 2종장애인, 차상위 1종)
  if (insObj.type === 'special_billing') {
    recWardRoom.textContent = `${selectedWard} ${roomDisplayName}`;
    recInsurance.textContent = `${insObj.name} (식대+전액+비급여)`;
    recDays.textContent = `${selectedDays}일`;
    if (recConsultTotal) recConsultTotal.textContent = '별도 산정';
    recBaseRoomTotal.textContent = '별도 산정';
    recSurchargeRow.style.display = 'none';
    recMealsTotal.textContent = '별도 산정';
    if (recMedTotal) recMedTotal.textContent = '별도 산정';
    if (recProcTotal) recProcTotal.textContent = '별도 산정';
    if (recExamTotal) recExamTotal.textContent = '별도 산정';
    recRehabTotal.textContent = '별도 산정';
    if (recRobotRow) recRobotRow.style.display = 'none';
    if (recNonbenefitRow) recNonbenefitRow.style.display = 'none';
    if (recBasicTotal) recBasicTotal.textContent = '별도 산정';
    recCopayBenefit.textContent = '별도 산정';
    recCopayNonBenefit.textContent = '별도 산정';
    recGrandTotal.textContent = '원무팀 문의';
    mobilePrice.textContent = '원무팀 문의';
    receiptFootnote.innerHTML = `⚠️ <strong>${insObj.label}</strong> 환자군은 식사료, 전액본인부담금 및 상급병실 차액 등이 특수 산정되어 심사평가원 및 보건복지부 고시에 근거해 원무팀에서 상세히 별도 정산해 드립니다.`;
    
    ceilingAlert.className = "notice-box box-warning";
    ceilingAlert.innerHTML = `
      <span class="notice-box-icon">⚠️</span>
      <span>의료급여 1종 / 2종 장애인 / 차상위 1종 환자군은 기본 입원료 급여 비용이 거의 면제되나 식사료, 전액본인부담, 상급병실 이용 여부에 따라 달라지므로 연간 본인부담상한제 환급 예상은 원무팀 정밀 정산 후에 조회 가능합니다.</span>
    `;
    
    renderRoomComparison(insObj, 0);
    renderMediumTermProjections(insObj, 0);
    return;
  }

  // 4. 투약료 (행위 + 재료)
  const medActionBefore = Math.round((EMR_FEES_BASELINE.medAction.total / 30) * selectedDays);
  const medMaterialBefore = Math.round((EMR_FEES_BASELINE.medMaterial.total / 30) * selectedDays);
  const medTotalBefore = medActionBefore + medMaterialBefore;
  let medCopayPatient = 0;
  if (insObj.type === 'workers_comp') {
    medCopayPatient = 0;
  } else {
    const actionCopay = Math.round(medActionBefore * generalCopayRate);
    const materialCopay = Math.round(medMaterialBefore * generalCopayRate) + (selectedInsurance === 'nhi_general' ? Math.round((EMR_FEES_BASELINE.medMaterial.fullCopay / 30) * selectedDays) : 0);
    medCopayPatient = actionCopay + materialCopay;
  }

  // 5. 처치 및 수술료
  const procSurgBefore = Math.round((EMR_FEES_BASELINE.procSurg.total / 30) * selectedDays);
  const procSurgCopay = (insObj.type === 'workers_comp') ? 0 : Math.round(procSurgBefore * generalCopayRate);

  // 6. 검사 및 영상진단료 (첫 달 초기 정밀검사 vs 2개월차 정기 추적검사)
  let examData = (selectedExamMode === 'initial') ? EMR_FEES_BASELINE.initialMonthExam : EMR_FEES_BASELINE.routineMonthExam;
  let examTotalBefore = 0;
  if (selectedExamMode === 'initial') {
    examTotalBefore = selectedDays >= 15 ? examData.total : Math.round((examData.total / 15) * selectedDays);
  } else {
    examTotalBefore = Math.round((examData.total / 30) * selectedDays);
  }
  const examCopayPatient = (insObj.type === 'workers_comp') ? 0 : Math.round(examTotalBefore * generalCopayRate);

  // 7. 전문 재활치료료
  let totalRehabBeforeIns = 0;
  if (selectedRehab === 'intensive') {
    totalRehabBeforeIns = Math.round((EMR_FEES_BASELINE.rehab.total / 30) * selectedDays);
  } else if (selectedRehab === 'standard') {
    totalRehabBeforeIns = Math.round(((EMR_FEES_BASELINE.rehab.total * 0.52) / 30) * selectedDays);
  } else {
    totalRehabBeforeIns = 0;
  }
  const rehabCopayPatient = (insObj.type === 'workers_comp') ? 0 : Math.round(totalRehabBeforeIns * generalCopayRate);

  // 8. 선별급여 (로봇 보행치료 MM304)
  let robotTotalBefore = 0;
  let robotCopayPatient = 0;
  if (includeRobotRehab) {
    robotTotalBefore = Math.round((EMR_FEES_BASELINE.robotRehab.total / 30) * selectedDays);
    robotCopayPatient = (insObj.type === 'workers_comp') ? 0 : Math.round(robotTotalBefore * 0.50);
  }

  // 9. 치료재료대 및 비급여
  let nonBenefitTotalBefore = 0;
  let nonBenefitCopayPatient = 0;
  if (includeNonBenefit) {
    nonBenefitTotalBefore = Math.round((EMR_FEES_BASELINE.nonBenefit.total / 30) * selectedDays);
    nonBenefitCopayPatient = nonBenefitTotalBefore;
  }

  // 10. 대상 본인부담금 (급여) vs 비급여/차액
  let benefitCopayTotal = 0;
  let nonBenefitTotal = 0;

  if (insObj.type === 'workers_comp') {
    benefitCopayTotal = 0;
    nonBenefitTotal = surchargeTotal + nonBenefitCopayPatient;
  } else {
    if (isUpperRoom) {
      benefitCopayTotal = consultCopay + medCopayPatient + procSurgCopay + examCopayPatient + rehabCopayPatient;
      nonBenefitTotal = roomCopayPatient + robotCopayPatient + nonBenefitCopayPatient;
    } else {
      benefitCopayTotal = consultCopay + roomCopayPatient + medCopayPatient + procSurgCopay + examCopayPatient + rehabCopayPatient;
      nonBenefitTotal = robotCopayPatient + nonBenefitCopayPatient;
    }
  }

  // 11. Grand Total
  const grandTotal = benefitCopayTotal + mealCopayPatient + nonBenefitTotal;

  // 12. Update Receipt Panel DOM
  recWardRoom.textContent = `${selectedWard} ${roomDisplayName}`;
  recInsurance.textContent = `${insObj.label} (${insObj.type === 'workers_comp' ? '산재' : insObj.rate * 100 + '%'})`;
  recDays.textContent = `${selectedDays}일`;
  
  if (recConsultTotal) recConsultTotal.textContent = fmt(consultTotalBefore);
  recBaseRoomTotal.textContent = fmt(baseRoomTotal);
  
  if (insObj.type === 'workers_comp' && isUpperRoom) {
    recSurchargeRow.style.display = 'flex';
    recSurchargeTotal.textContent = fmt(surchargeTotal);
  } else if (isUpperRoom) {
    recSurchargeRow.style.display = 'flex';
    recSurchargeTotal.textContent = fmt(roomCopayPatient);
  } else {
    recSurchargeRow.style.display = 'none';
  }

  recMealsTotal.textContent = fmt(totalMealCostBeforeIns);
  if (recMedTotal) recMedTotal.textContent = fmt(medTotalBefore);
  if (recProcTotal) recProcTotal.textContent = fmt(procSurgBefore);
  if (recExamTotal) recExamTotal.textContent = fmt(examTotalBefore);
  recRehabTotal.textContent = fmt(totalRehabBeforeIns);

  if (recRobotRow) {
    if (includeRobotRehab) {
      recRobotRow.style.display = 'flex';
      if (recRobotTotal) recRobotTotal.textContent = fmt(robotTotalBefore);
    } else {
      recRobotRow.style.display = 'none';
    }
  }

  if (recNonbenefitRow) {
    if (includeNonBenefit) {
      recNonbenefitRow.style.display = 'flex';
      if (recNonbenefitTotal) recNonbenefitTotal.textContent = fmt(nonBenefitTotalBefore);
    } else {
      recNonbenefitRow.style.display = 'none';
    }
  }
  
  recCopayBenefit.textContent = fmt(benefitCopayTotal + mealCopayPatient);
  recCopayNonBenefit.textContent = fmt(nonBenefitTotal);
  
  recGrandTotal.textContent = fmt(grandTotal);
  mobilePrice.textContent = fmt(grandTotal);
  receiptFootnote.textContent = "※ 실제 병원 전산 영수증 기준 진찰·입원·식대·약제·검사·집중재활·선별급여를 100% 충실히 반영한 모의 명세서입니다.";

  // 13. Populate EMR Table Drawer
  renderEmrTable({
    consultTotalBefore, consultCopay,
    baseRoomTotal, roomCopayPatient,
    totalMealCostBeforeIns, mealCopayPatient,
    medTotalBefore, medCopayPatient,
    procSurgBefore, procSurgCopay,
    examTotalBefore, examCopayPatient,
    totalRehabBeforeIns, rehabCopayPatient,
    robotTotalBefore, robotCopayPatient,
    nonBenefitTotalBefore, nonBenefitCopayPatient,
    grandTotal
  });

  // 14. Update Ward Compare Analysis Card
  updateWardComparePrices(insObj, generalCopayRate);

  // 15. Copay Ceiling Simulator
  let ceilingTextHtml = '';
  if (insObj.type === 'nhi') {
    const decileObj = CEILING_THRESHOLDS_2026[selectedCeilingDecile];
    const longStayCheckbox = document.getElementById('long-stay-checkbox');
    const isLongStay = longStayCheckbox && longStayCheckbox.checked;
    
    const currentYearCeiling = isLongStay ? decileObj.longStayThreshold : decileObj.threshold;
    const maxPrepay = isLongStay ? MAX_PREPAY_CEILING_2026.longStay : MAX_PREPAY_CEILING_2026.standard;
    
    const subjectToCeiling = benefitCopayTotal;
    const isExceedCeiling = subjectToCeiling > currentYearCeiling;
    const isExceedPrepay = subjectToCeiling >= maxPrepay;
    
    let prepayNotice = ``;
    if (isExceedPrepay) {
      prepayNotice = `<br><span style="color:#d97706; font-weight:700; font-size:12px;">★ 사전급여 최고상한액(${fmt(maxPrepay)}) 초과: 초과 금액은 병원에서 즉시 공단 부담으로 처리되어 환자는 최고상한액까지만 납부합니다.</span>`;
    } else {
      prepayNotice = `<br><span style="color:var(--slate-500); font-size:11px;">※ 2026년 사전급여 최고상한액: ${fmt(maxPrepay)} (초과 시 병원 사전 공단청구 적용)</span>`;
    }
    
    if (isExceedCeiling) {
      const refundEst = subjectToCeiling - currentYearCeiling;
      ceilingAlert.className = "notice-box box-success";
      ceilingTextHtml = `
        <span class="notice-box-icon">💡</span>
        <div>
          <strong>본인부담상한제 환급 가능 대상 (예상)</strong><br>
          <span>급여 본인부담금(${fmt(subjectToCeiling)})이 선택하신 ${decileObj.name} ${isLongStay ? '요양병원 120일 초과 ' : ''}연간 상한액(${fmt(currentYearCeiling)})을 초과합니다.<br>
          연간 누적 청구 시 약 <strong>${fmt(refundEst)}</strong>을 건강보험공단에서 환급받으실 수 있습니다. (상급병실 차액, 식대 제외)</span>
          ${prepayNotice}
        </div>
      `;
    } else {
      const remaining = currentYearCeiling - subjectToCeiling;
      ceilingAlert.className = "notice-box";
      ceilingTextHtml = `
        <span class="notice-box-icon">ℹ️</span>
        <div>
          <strong>본인부담상한액 한도 이내 (환급 대상 아님)</strong><br>
          <span>급여 본인부담금(${fmt(subjectToCeiling)})이 ${decileObj.name} ${isLongStay ? '요양병원 120일 초과 ' : ''}연간 상한액(${fmt(currentYearCeiling)}) 이하입니다. 상한액까지 약 <strong>${fmt(remaining)}</strong>의 누적 한도가 남아있습니다.</span>
          ${prepayNotice}
        </div>
      `;
    }
  } else {
    ceilingAlert.className = "notice-box";
    ceilingTextHtml = `
      <span class="notice-box-icon">ℹ️</span>
      <span>의료급여 또는 산재보험 수급자는 본인부담상한제 환급 대상이 아니며, 이미 법정 최고 수준의 감면(본인부담 0%~10% 및 장애인 지원)이 계산서에 적용되어 있습니다.</span>
    `;
  }
  ceilingAlert.innerHTML = ceilingTextHtml;

  // 16. Render room comparisons and projections
  renderRoomComparison(insObj, generalCopayRate);
  renderMediumTermProjections(insObj, generalCopayRate);
}

function renderRoomComparison(insObj, generalCopayRate) {
  const config = WARD_ROOM_CONFIG[selectedWard];
  const rooms = Object.keys(config.rooms);
  compareGrid.innerHTML = '';
  
  if (insObj.type === 'special_billing') {
    const card = document.createElement('div');
    card.className = 'compare-card active';
    card.style.gridColumn = '1 / -1';
    card.innerHTML = `<div class="compare-card-title">의료급여1종/2종장애인/차상위1종</div><div class="compare-card-price" style="font-size:14px">상세 심사 기준 확인 필요 (원무과)</div>`;
    compareGrid.appendChild(card);
    return;
  }

  rooms.forEach(r => {
    const roomObj = config.rooms[r];
    const totalCopay = calcCustomRoomTotal(selectedWard, r, selectedDays, insObj, generalCopayRate);

    const compareCard = document.createElement('div');
    compareCard.className = `compare-card${r === selectedRoom ? ' active' : ''}`;
    compareCard.innerHTML = `
      <div class="compare-card-title" style="font-size:11px">${roomObj.name}</div>
      <div class="compare-card-price">${fmt(totalCopay)}</div>
      ${r === selectedRoom ? '<span class="compare-card-badge">선택 중</span>' : ''}
    `;
    
    compareCard.addEventListener('click', () => {
      selectedRoom = r;
      renderRoomSelector();
      calculateAll();
    });

    compareGrid.appendChild(compareCard);
  });
}

function renderMediumTermProjections(insObj, generalCopayRate) {
  projectionGrid.innerHTML = '';
  
  if (insObj.type === 'special_billing') {
    for (let m = 1; m <= 3; m++) {
      const card = document.createElement('div');
      card.className = 'projection-card';
      card.innerHTML = `<div class="projection-month">${m}달 (${m * 30}일 기준)</div><div class="projection-price" style="font-size:16px">원무과 문의</div><div style="border-top:1px dashed var(--slate-200); margin-top:8px; padding-top:8px; font-size:11px; color:var(--slate-600)">식대/전액/비급여 별도 정산 환자군</div>`;
      projectionGrid.appendChild(card);
    }
    return;
  }

  const periods = [30, 60, 90];
  const baseRoomKey = getRoomBaseKey(selectedRoom);
  const fixedCopay = ROOM_COP_FIXED[baseRoomKey];
  const isUpper = !!fixedCopay;
  
  periods.forEach((stayDays, index) => {
    const roomFees = getEffectiveRoomFees(selectedWard, selectedRoom);
    
    let baseRoomTotal = 0;
    for (let d = 1; d <= stayDays; d++) {
      if (d <= 15) baseRoomTotal += roomFees.d15;
      else if (d <= 30) baseRoomTotal += roomFees.d16;
      else baseRoomTotal += roomFees.d31;
    }

    let roomCopayPatient = 0;
    if (insObj.type === 'workers_comp') {
      if (isUpper) {
        const base4RoomFees = getEffectiveRoomFees(selectedWard, '4인실');
        let total4RoomFee = 0;
        for (let d = 1; d <= stayDays; d++) {
          if (d <= 15) total4RoomFee += base4RoomFees.d15;
          else if (d <= 30) total4RoomFee += base4RoomFees.d16;
          else total4RoomFee += base4RoomFees.d31;
        }
        roomCopayPatient = Math.max(0, baseRoomTotal - total4RoomFee);
      } else {
        roomCopayPatient = 0;
      }
    } else {
      roomCopayPatient = isUpper ? Math.round(baseRoomTotal * fixedCopay) : Math.round(baseRoomTotal * generalCopayRate);
    }

    // Rehab Therapy Copay
    let totalRehabBeforeIns = 0;
    if (selectedRehab === 'intensive') {
      totalRehabBeforeIns = Math.round((EMR_FEES_BASELINE.rehab.total / 30) * stayDays);
    } else if (selectedRehab === 'standard') {
      totalRehabBeforeIns = Math.round(((EMR_FEES_BASELINE.rehab.total * 0.52) / 30) * stayDays);
    }
    let rehabCopayPatient = insObj.type === 'workers_comp' ? 0 : Math.round(totalRehabBeforeIns * generalCopayRate);

    // Meals Copay
    const totalMealsCount = selectedMealsPerDay * stayDays;
    const totalMealCostBeforeIns = totalMealsCount * MEAL_COST_PER_MEAL;
    let mealCopayRate = 0.50;
    if (insObj.type === 'workers_comp') mealCopayRate = 0.00;
    else if (insObj.type === 'medical') mealCopayRate = 0.20;
    const mealCopayPatient = Math.round(totalMealCostBeforeIns * mealCopayRate);

    // Consult, Meds, Procedure Copays
    const consultCopay = (insObj.type === 'workers_comp') ? 0 : Math.round((EMR_FEES_BASELINE.consult.total / 30) * stayDays * generalCopayRate);
    const medCopay = (insObj.type === 'workers_comp') ? 0 : Math.round(((EMR_FEES_BASELINE.medAction.total + EMR_FEES_BASELINE.medMaterial.total) / 30) * stayDays * generalCopayRate);
    const procCopay = (insObj.type === 'workers_comp') ? 0 : Math.round((EMR_FEES_BASELINE.procSurg.total / 30) * stayDays * generalCopayRate);

    // Exam Copay (Month 1: selectedExamMode; Month 2 & 3: routine follow-up)
    let examCopay = 0;
    if (stayDays === 30) {
      const examData = (selectedExamMode === 'initial') ? EMR_FEES_BASELINE.initialMonthExam : EMR_FEES_BASELINE.routineMonthExam;
      examCopay = (insObj.type === 'workers_comp') ? 0 : Math.round(examData.total * generalCopayRate);
    } else if (stayDays === 60) {
      const m1Exam = (selectedExamMode === 'initial') ? EMR_FEES_BASELINE.initialMonthExam.total : EMR_FEES_BASELINE.routineMonthExam.total;
      const m2Exam = EMR_FEES_BASELINE.routineMonthExam.total;
      examCopay = (insObj.type === 'workers_comp') ? 0 : Math.round((m1Exam + m2Exam) * generalCopayRate);
    } else {
      const m1Exam = (selectedExamMode === 'initial') ? EMR_FEES_BASELINE.initialMonthExam.total : EMR_FEES_BASELINE.routineMonthExam.total;
      const m23Exam = EMR_FEES_BASELINE.routineMonthExam.total * 2;
      examCopay = (insObj.type === 'workers_comp') ? 0 : Math.round((m1Exam + m23Exam) * generalCopayRate);
    }

    // Robot & NonBenefit
    const robotCopay = includeRobotRehab ? ((insObj.type === 'workers_comp') ? 0 : Math.round((EMR_FEES_BASELINE.robotRehab.total / 30) * stayDays * 0.50)) : 0;
    const nonBenefitCopay = includeNonBenefit ? Math.round((EMR_FEES_BASELINE.nonBenefit.total / 30) * stayDays) : 0;

    const totalCopay = roomCopayPatient + rehabCopayPatient + mealCopayPatient + consultCopay + medCopay + procCopay + examCopay + robotCopay + nonBenefitCopay;

    const card = document.createElement('div');
    card.className = 'projection-card';
    card.innerHTML = `
      <div class="projection-month">${index + 1}달 (${stayDays}일 기준)</div>
      <div class="projection-price">${fmt(totalCopay)}</div>
      <div style="border-top:1px dashed var(--slate-200); margin-top:8px; padding-top:8px;">
        <div class="projection-detail-row">
          <span>병실료(본인부담):</span>
          <strong>${fmt(roomCopayPatient)}</strong>
        </div>
        <div class="projection-detail-row">
          <span>재활치료(본인부담):</span>
          <strong>${fmt(rehabCopayPatient)}</strong>
        </div>
        <div class="projection-detail-row">
          <span>검사·진찰·약제(본인부담):</span>
          <strong>${fmt(consultCopay + medCopay + procCopay + examCopay)}</strong>
        </div>
        <div class="projection-detail-row">
          <span>식대료(본인부담):</span>
          <strong>${fmt(mealCopayPatient)}</strong>
        </div>
      </div>
    `;
    projectionGrid.appendChild(card);
  });
}

function fmt(n) {
  return n.toLocaleString('ko-KR') + '원';
}

// Ambulance modal controls
function openAmbulanceModal() {
  const modal = document.getElementById('ambulance-modal');
  if (modal) {
    modal.classList.add('show');
  }
}

function closeAmbulanceModal() {
  const modal = document.getElementById('ambulance-modal');
  if (modal) {
    modal.classList.remove('show');
  }
}

// Close modal if clicked outside content
window.addEventListener('click', (e) => {
  const ambModal = document.getElementById('ambulance-modal');
  if (e.target === ambModal) {
    closeAmbulanceModal();
  }
  const dirModal = document.getElementById('directory-modal');
  if (e.target === dirModal) {
    closeDirectoryModal();
  }
});

// Directory modal controls & dynamic rendering
let activeDirectoryTab = 'all';

function openDirectoryModal() {
  const modal = document.getElementById('directory-modal');
  if (modal) {
    modal.classList.add('show');
    renderDirectoryTable();
  }
}

function closeDirectoryModal() {
  const modal = document.getElementById('directory-modal');
  if (modal) {
    modal.classList.remove('show');
  }
}

function renderDirectoryTable(filterText = '') {
  const tbody = document.getElementById('directory-tbody');
  if (!tbody) return;
  
  tbody.innerHTML = '';
  const query = filterText.toLowerCase().trim();
  
  CONTACT_DIRECTORY.forEach(item => {
    // Filter by tab
    if (activeDirectoryTab !== 'all' && item.category !== activeDirectoryTab) {
      return;
    }
    
    // Filter by query
    if (query && !item.name.toLowerCase().includes(query) && !item.tel.includes(query) && !item.fax.includes(query)) {
      return;
    }
    
    const tr = document.createElement('tr');
    
    const catBadge = item.category === 'org' ? '<span class="directory-badge badge-org">기관</span>' : '<span class="directory-badge badge-hosp">병원</span>';
    
    const telLink = item.tel !== '-' ? `<a href="tel:${item.tel}" class="directory-table-tel">${item.tel}</a>` : '-';
    const erLink = item.er !== '-' ? `<a href="tel:${item.er}" class="directory-table-er">🚨 ${item.er}</a>` : '-';
    
    const searchQuery = item.query || item.name;
    const naverLink = `<a href="https://search.naver.com/search.naver?query=${encodeURIComponent(searchQuery)}" target="_blank" rel="noopener noreferrer" style="color: #03c75a; font-weight: 700; text-decoration: none; display: inline-flex; align-items: center; gap: 4px; font-size: 11px;"><span style="background: #03c75a; color: white; border-radius: 3px; padding: 1px 3px; font-size: 9px; font-weight: 800; font-family: sans-serif; line-height: 1;">N</span> 검색</a>`;

    tr.innerHTML = `
      <td>${catBadge}</td>
      <td style="font-weight: 600; color: var(--slate-900);">${item.name}</td>
      <td>${telLink}</td>
      <td>${erLink}</td>
      <td style="font-family: var(--font-en); color: var(--slate-600);">${item.fax}</td>
      <td style="text-align: center;">${naverLink}</td>
    `;
    tbody.appendChild(tr);
  });
}

// Hook search input events
document.getElementById('directory-search')?.addEventListener('input', (e) => {
  renderDirectoryTable(e.target.value);
});

function switchDirectoryTab(tab) {
  activeDirectoryTab = tab;
  document.querySelectorAll('.directory-tab').forEach(btn => {
    if (btn.getAttribute('data-tab') === tab) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });
  const searchInput = document.getElementById('directory-search');
  renderDirectoryTable(searchInput ? searchInput.value : '');
}

// ========================================================
// Room Simulation Module (병실별_수가적용_정리표 54개 병실 시뮬레이터)
// ========================================================
const simState = {
  activeView: 'calc', // 'calc' | 'room-sim'
  capacityMode: 'actual', // 'actual' (현재 입실 인원수 실시간 계산 - 기본값) | 'single' (1인 단가) | 'room' (만실 정원)
  activeFilter: 'all', // 'all' | '5병동' | '6병동' | '7병동' | '8병동'
  occupancy: {}, // { roomId: boolean }
  roomOccupiedBeds: {} // { roomId: number (0 ~ capacity) }
};

function initRoomSimulation() {
  if (typeof ROOM_DIRECTORY_DATA === 'undefined') return;
  ROOM_DIRECTORY_DATA.forEach(r => {
    if (simState.occupancy[r.id] === undefined) {
      simState.occupancy[r.id] = true; // 기본값: 전체 입실
    }
    if (simState.roomOccupiedBeds[r.id] === undefined) {
      simState.roomOccupiedBeds[r.id] = r.capacity; // 기본값: 만실 베드
    }
  });
  renderRoomSimulation();
}

function switchView(viewName) {
  simState.activeView = viewName;
  const calcView = document.getElementById('view-calculator');
  const simView = document.getElementById('view-room-simulation');
  const navBtnCalc = document.getElementById('nav-btn-calc');
  const navBtnSim = document.getElementById('nav-btn-room-sim');
  const mobileCta = document.querySelector('.mobile-cta');

  if (viewName === 'room-sim') {
    if (calcView) calcView.style.display = 'none';
    if (simView) simView.style.display = 'block';
    if (navBtnCalc) navBtnCalc.classList.remove('active');
    if (navBtnSim) navBtnSim.classList.add('active');
    if (mobileCta) mobileCta.style.display = 'none';
    window.scrollTo({ top: 0, behavior: 'smooth' });
    renderRoomSimulation();
  } else {
    if (simView) simView.style.display = 'none';
    if (calcView) calcView.style.display = 'block';
    if (navBtnSim) navBtnSim.classList.remove('active');
    if (navBtnCalc) navBtnCalc.classList.add('active');
    if (mobileCta) mobileCta.style.display = 'flex';
    window.scrollTo({ top: 0, behavior: 'smooth' });
    calculateAll();
  }
}

function getRoomCalculation(item, isOccupied, mode) {
  const occupiedBeds = (simState.roomOccupiedBeds && simState.roomOccupiedBeds[item.id] !== undefined)
    ? simState.roomOccupiedBeds[item.id]
    : (isOccupied ? item.capacity : 0);

  // 집중재활치료료 (30일): 총액 6,450,000원, 본인부담 20% = 1,290,000원
  const rehabBefore = 6450000;
  const rehabCopay = 1290000;

  // 식대료 (30일, 1일 3끼, 8,100원): 총액 729,000원, 본인부담 50% = 364,500원
  const mealsBefore = 729000;
  const mealCopay = 364500;

  // 기본 입원료 및 기본 진료·검사·약제비 (30일 기준 - 실시간 설정 연동)
  const effectiveSim = getEffectiveSimulationRoomFees(item.ward, item.roomType, item.baseRoomKey);
  const roomBefore = effectiveSim.roomBefore;
  const roomCopay = effectiveSim.roomCopay;
  const basicBefore = effectiveSim.basicBefore;
  const basicCopay = effectiveSim.basicCopay;

  const singlePatientCopay = roomCopay + rehabCopay + mealCopay + basicCopay;
  const singleMedicalTotal = roomBefore + rehabBefore + mealsBefore + basicBefore;

  // 배율 계산 (mode: 'actual' (현재 입실석수), 'single' (1인 단가), 'room' (만실 정원))
  let multiplier = 0;
  if (!isOccupied || occupiedBeds === 0) {
    multiplier = 0;
  } else if (mode === 'single' || mode === 'bed') {
    multiplier = 1;
  } else if (mode === 'room') {
    multiplier = item.capacity;
  } else {
    // 'actual' (실시간 입실 인원수 기본 적용)
    multiplier = occupiedBeds;
  }

  return {
    isOccupied: (isOccupied && occupiedBeds > 0),
    occupiedBeds: occupiedBeds,
    capacity: item.capacity,
    emptyBeds: item.capacity - occupiedBeds,
    patientCopay: singlePatientCopay * multiplier,
    medicalTotal: singleMedicalTotal * multiplier,
    singlePatientCopay: singlePatientCopay,
    singleMedicalTotal: singleMedicalTotal,
    multiplier: multiplier
  };
}

function renderRoomSimulation() {
  if (typeof ROOM_DIRECTORY_DATA === 'undefined') return;

  const mode = simState.capacityMode || 'actual';
  const filter = simState.activeFilter;

  // 1. Calculate per-room & aggregates
  let grandPatient = 0;
  let grandMedical = 0;
  let occupiedRoomsCount = 0;
  let emptyRoomsCount = 0;
  let totalBedsCount = 0;
  let occupiedBedsCount = 0;

  const wardStats = {
    '5병동': { name: '5병동 (통합 다인실)', totalRooms: 0, occupied: 0, empty: 0, totalBeds: 0, occupiedBeds: 0, patientCopay: 0, medicalTotal: 0, type: 'integrated' },
    '6병동': { name: '6병동 (일반병동)', totalRooms: 0, occupied: 0, empty: 0, totalBeds: 0, occupiedBeds: 0, patientCopay: 0, medicalTotal: 0, type: 'general' },
    '7병동': { name: '7병동 (일반병동)', totalRooms: 0, occupied: 0, empty: 0, totalBeds: 0, occupiedBeds: 0, patientCopay: 0, medicalTotal: 0, type: 'general' },
    '8병동': { name: '8병동 (간호간병통합)', totalRooms: 0, occupied: 0, empty: 0, totalBeds: 0, occupiedBeds: 0, patientCopay: 0, medicalTotal: 0, type: 'integrated' }
  };

  const roomTypesOrder = ['2인실', '3인실', '4인실', '7인실', '8인실'];
  const typeStats = {};
  roomTypesOrder.forEach(t => {
    typeStats[t] = {
      type: t,
      totalRooms: 0,
      occupiedRooms: 0,
      emptyRooms: 0,
      totalBeds: 0,
      occupiedBeds: 0,
      patientCopay: 0,
      medicalTotal: 0
    };
  });

  ROOM_DIRECTORY_DATA.forEach(item => {
    const isOcc = !!simState.occupancy[item.id];
    const calc = getRoomCalculation(item, isOcc, mode);
    item._calc = calc;

    totalBedsCount += item.capacity;
    occupiedBedsCount += calc.occupiedBeds;

    // Ward Stats
    const ws = wardStats[item.ward];
    if (ws) {
      ws.totalRooms++;
      ws.totalBeds += item.capacity;
      ws.occupiedBeds += calc.occupiedBeds;
      if (isOcc && calc.occupiedBeds > 0) {
        ws.occupied++;
        ws.patientCopay += calc.patientCopay;
        ws.medicalTotal += calc.medicalTotal;
        occupiedRoomsCount++;
        grandPatient += calc.patientCopay;
        grandMedical += calc.medicalTotal;
      } else {
        ws.empty++;
        emptyRoomsCount++;
      }
    }

    // Type Stats
    const ts = typeStats[item.roomType];
    if (ts) {
      ts.totalRooms++;
      ts.totalBeds += item.capacity;
      ts.occupiedBeds += calc.occupiedBeds;
      if (isOcc && calc.occupiedBeds > 0) {
        ts.occupiedRooms++;
        ts.patientCopay += calc.patientCopay;
        ts.medicalTotal += calc.medicalTotal;
      } else {
        ts.emptyRooms++;
      }
    }
  });

  // 2. Update KPI Cards
  const kpiOccupied = document.getElementById('sim-kpi-occupied');
  const kpiEmpty = document.getElementById('sim-kpi-empty');
  const kpiText = document.getElementById('sim-kpi-occupancy-text');
  const kpiRate = document.getElementById('sim-kpi-rate');
  const kpiBedsText = document.getElementById('sim-kpi-beds-text');
  const kpiPatient = document.getElementById('sim-kpi-grand-patient');
  const kpiMedical = document.getElementById('sim-kpi-grand-medical');

  if (kpiOccupied) kpiOccupied.textContent = occupiedRoomsCount;
  if (kpiEmpty) kpiEmpty.textContent = emptyRoomsCount;
  if (kpiText) kpiText.textContent = `${occupiedRoomsCount} / 54실`;
  const ratePct = totalBedsCount > 0 ? Math.round((occupiedBedsCount / totalBedsCount) * 100) : 0;
  if (kpiRate) kpiRate.textContent = `${ratePct}%`;
  if (kpiBedsText) kpiBedsText.textContent = `${occupiedBedsCount} / ${totalBedsCount}석`;
  if (kpiPatient) kpiPatient.textContent = fmt(grandPatient);
  if (kpiMedical) kpiMedical.textContent = fmt(grandMedical);

  // 3. Render Room Type (인실별) Summary Grid
  const typeGrid = document.getElementById('sim-type-grid');
  if (typeGrid) {
    typeGrid.innerHTML = '';
    roomTypesOrder.forEach(typeKey => {
      const ts = typeStats[typeKey];
      if (!ts || ts.totalRooms === 0) return;

      const card = document.createElement('div');
      card.className = 'type-kpi-card';
      card.innerHTML = `
        <div>
          <div class="type-kpi-header">
            <span class="type-kpi-title">🛏️ ${typeKey}</span>
            <span class="type-kpi-badge">총 ${ts.totalRooms}실 (${ts.totalBeds}석)</span>
          </div>

          <!-- Stepper for Room Type Occupancy -->
          <div class="type-stepper-wrap">
            <span class="type-stepper-label">입실 설정:</span>
            <div class="type-stepper-ctrl">
              <button type="button" class="btn-stepper" onclick="adjustTypeOccupancy('${typeKey}', -1)" title="1실 감소">−</button>
              <input type="number" class="type-stepper-input" min="0" max="${ts.totalRooms}" value="${ts.occupiedRooms}" onchange="setTypeOccupancyCount('${typeKey}', this.value)">
              <button type="button" class="btn-stepper" onclick="adjustTypeOccupancy('${typeKey}', 1)" title="1실 증가">+</button>
            </div>
          </div>

          <div class="type-kpi-status">
            <span class="badge-occ-pill">입실 ${ts.occupiedRooms}실 (${ts.occupiedBeds}석)</span>
            <span class="badge-emp-pill">공석 ${ts.emptyRooms}실 (${ts.totalBeds - ts.occupiedBeds}석)</span>
          </div>

          <div class="type-kpi-prices">
            <div class="type-price-row">
              <span>환자부담:</span>
              <strong class="val-patient">${fmt(ts.patientCopay)}</strong>
            </div>
            <div class="type-price-row">
              <span>총진료비:</span>
              <strong class="val-medical">${fmt(ts.medicalTotal)}</strong>
            </div>
          </div>
        </div>

        <div class="type-kpi-quick-bar">
          <button type="button" class="btn-type-quick" onclick="setTypeOccupancyCount('${typeKey}', ${ts.totalRooms})">전체입실</button>
          <button type="button" class="btn-type-quick" onclick="setTypeOccupancyCount('${typeKey}', 0)">전체공실</button>
        </div>
      `;
      typeGrid.appendChild(card);
    });
  }

  // 4. Render Ward Summary Grid
  const wardGrid = document.getElementById('ward-summary-grid');
  if (wardGrid) {
    wardGrid.innerHTML = '';
    ['5병동', '6병동', '7병동', '8병동'].forEach(wardKey => {
      const ws = wardStats[wardKey];
      const card = document.createElement('div');
      card.className = 'ward-kpi-card';
      const badgeClass = ws.type === 'integrated' ? 'badge-int-ward' : 'badge-gen-ward';
      const badgeLabel = ws.type === 'integrated' ? '간호간병통합' : '일반병동';
      const wardBedRate = ws.totalBeds > 0 ? Math.round((ws.occupiedBeds / ws.totalBeds) * 100) : 0;

      card.innerHTML = `
        <div>
          <div class="ward-kpi-header">
            <span class="ward-kpi-title">${wardKey}</span>
            <span class="ward-kpi-badge ${badgeClass}">${badgeLabel}</span>
          </div>
          <div class="ward-kpi-stats">
            총 ${ws.totalRooms}실 (${ws.totalBeds}석) 중 <strong>입실 ${ws.occupied}실 (${ws.occupiedBeds}석)</strong> · <span style="color:#ef4444">공실 ${ws.empty}실 (${ws.totalBeds - ws.occupiedBeds}석)</span>
            (${wardBedRate}% 가동)
          </div>
          <div class="ward-kpi-price-row">
            <span class="ward-kpi-price-label">예상 환자부담금:</span>
            <span class="ward-kpi-price-val val-patient">${fmt(ws.patientCopay)}</span>
          </div>
          <div class="ward-kpi-price-row">
            <span class="ward-kpi-price-label">총 진료비 (총매출):</span>
            <span class="ward-kpi-price-val val-medical">${fmt(ws.medicalTotal)}</span>
          </div>
        </div>
        <div class="ward-kpi-actions">
          <button type="button" class="btn-mini-batch" style="color:#059669;" onclick="batchSetOccupancy('${wardKey}', true)">✓ 전체입실</button>
          <button type="button" class="btn-mini-batch" style="color:#dc2626;" onclick="batchSetOccupancy('${wardKey}', false)">✕ 전체공실</button>
        </div>
      `;
      wardGrid.appendChild(card);
    });
  }

  // 5. Update Ward Batch Actions text
  const batchSubBar = document.getElementById('sim-ward-batch-actions');
  if (batchSubBar) {
    const wardName = filter === 'all' ? '전체 54개 병실' : `${filter} 전체`;
    batchSubBar.innerHTML = `
      <span>현재 필터: <strong>${wardName}</strong></span>
      <div style="display:flex; gap:6px;">
        <button type="button" class="btn-batch btn-batch-occupy" style="padding:4px 10px; font-size:11px;" onclick="batchSetOccupancy('${filter}', true)">✓ ${filter === 'all' ? '전체' : filter} 입실 처리</button>
        <button type="button" class="btn-batch btn-batch-empty" style="padding:4px 10px; font-size:11px;" onclick="batchSetOccupancy('${filter}', false)">✕ ${filter === 'all' ? '전체' : filter} 공실 처리</button>
      </div>
    `;
  }

  // 6. Render Room Cards Grid
  const roomsGrid = document.getElementById('sim-rooms-grid');
  if (roomsGrid) {
    roomsGrid.innerHTML = '';
    const filteredRooms = filter === 'all' 
      ? ROOM_DIRECTORY_DATA 
      : ROOM_DIRECTORY_DATA.filter(r => r.ward === filter);

    filteredRooms.forEach(item => {
      const isOcc = !!simState.occupancy[item.id];
      const calc = item._calc;
      const occupiedBeds = calc.occupiedBeds;
      const emptyBeds = calc.emptyBeds;
      const isCardOccupied = isOcc && occupiedBeds > 0;

      const card = document.createElement('div');
      card.className = `sim-room-card ${isCardOccupied ? 'occupied' : 'empty'}`;

      let noteHtml = item.note ? `<div style="color:#d97706; font-size:10.5px; margin-top:2px;">⚠️ ${item.note}</div>` : '';

      card.innerHTML = `
        <div>
          <div class="room-header">
            <div class="room-number">${item.room}호</div>
            <div class="room-badges">
              <span class="room-type-tag" style="background:#e0f2fe; color:#0369a1; font-weight:800;">${item.ward}</span>
              <span class="room-type-tag">${item.roomType}</span>
            </div>
          </div>
          <div class="room-info-meta">
            <div>수가 적용: <strong>${item.feeApplied} 수가</strong> · 정원 ${item.capacity}베드</div>
            ${noteHtml}
          </div>
        </div>

        <div>
          <!-- Bed Occupancy Stepper -->
          <div class="room-bed-stepper-wrap">
            <span style="font-size:11.5px; font-weight:700; color:var(--slate-700);">입실 인원:</span>
            <div class="room-bed-stepper">
              <button type="button" class="btn-bed-step" onclick="adjustRoomBeds('${item.id}', -1)" title="1석 감소">−</button>
              <span class="room-bed-count" style="color: ${occupiedBeds > 0 ? 'var(--accent)' : 'var(--slate-400)'};">${occupiedBeds} / ${item.capacity}석</span>
              <button type="button" class="btn-bed-step" onclick="adjustRoomBeds('${item.id}', 1)" title="1석 증가">+</button>
            </div>
          </div>

          <!-- Quick Occupancy Toggle Buttons -->
          <div class="room-status-bar">
            <button type="button" class="btn-status-toggle btn-status-occupy ${isOcc && occupiedBeds === item.capacity ? 'active' : ''}" onclick="setRoomOccupancy('${item.id}', true)">
              ✓ 만실 (${item.capacity}석)
            </button>
            <button type="button" class="btn-status-toggle btn-status-empty ${!isOcc || occupiedBeds === 0 ? 'active' : ''}" onclick="setRoomOccupancy('${item.id}', false)">
              ✕ 전체 공실 (0원)
            </button>
          </div>

          <!-- Price Display -->
          <div class="room-price-container">
            ${isCardOccupied ? `
              <div class="room-price-line">
                <span style="color:var(--slate-600); font-weight:600;">현재 입실(<strong>${occupiedBeds}석</strong>) 환자부담:</span>
                <strong style="color:#d97706; font-size:15px;">${fmt(calc.patientCopay)}</strong>
              </div>
              <div class="room-price-line">
                <span style="color:var(--slate-500);">현재 입실(<strong>${occupiedBeds}석</strong>) 총진료비:</span>
                <strong style="color:var(--accent); font-size:13.5px;">${fmt(calc.medicalTotal)}</strong>
              </div>
            ` : `
              <div class="empty-price-text">0원 (전체 공석 / 미청구)</div>
              <div style="font-size:10.5px; color:var(--slate-400); margin:2px 0 4px 0;">전체 ${item.capacity}석 비어있음 · 실시간 합산 제외</div>
            `}

            <!-- 인원당(1인) 예상 환자부담금 표기 (전체 공통 적용) -->
            <div class="room-per-person-box">
              <div class="per-person-header-line">
                <span class="per-person-title">👤 <strong>인원당(1인) 예상 환자부담금</strong>:</span>
                <strong class="per-person-val">${fmt(calc.singlePatientCopay)}</strong>
              </div>
              <div class="per-person-sub-line">
                <span class="per-person-sub-medical">(1인 총진료비: ${fmt(calc.singleMedicalTotal)})</span>
                <span class="per-person-tag ${isCardOccupied ? 'tag-occ' : 'tag-emp'}">
                  ${isCardOccupied ? `※ 현재 ${occupiedBeds}석 입실 반영 (${emptyBeds}석 공석)` : `※ 1인 단가 기준 (현재 공석)`}
                </span>
              </div>
            </div>
          </div>
        </div>
      `;

      roomsGrid.appendChild(card);
    });
  }
}

function setRoomOccupancy(roomId, isOccupied) {
  const room = ROOM_DIRECTORY_DATA.find(r => r.id === roomId);
  simState.occupancy[roomId] = isOccupied;
  if (room && simState.roomOccupiedBeds) {
    simState.roomOccupiedBeds[roomId] = isOccupied ? room.capacity : 0;
  }
  renderRoomSimulation();
}

function adjustRoomBeds(roomId, delta) {
  const room = ROOM_DIRECTORY_DATA.find(r => r.id === roomId);
  if (!room) return;
  const currentBeds = (simState.roomOccupiedBeds && simState.roomOccupiedBeds[roomId] !== undefined)
    ? simState.roomOccupiedBeds[roomId]
    : (simState.occupancy[roomId] ? room.capacity : 0);

  const newBeds = Math.max(0, Math.min(room.capacity, currentBeds + delta));
  simState.roomOccupiedBeds[roomId] = newBeds;
  simState.occupancy[roomId] = (newBeds > 0);
  renderRoomSimulation();
}

function setTypeOccupancyCount(roomType, targetOccupiedCount) {
  const roomsOfType = ROOM_DIRECTORY_DATA.filter(r => r.roomType === roomType);
  const total = roomsOfType.length;
  const count = Math.max(0, Math.min(total, parseInt(targetOccupiedCount, 10) || 0));

  roomsOfType.forEach((r, idx) => {
    const isOcc = (idx < count);
    simState.occupancy[r.id] = isOcc;
    if (simState.roomOccupiedBeds) {
      simState.roomOccupiedBeds[r.id] = isOcc ? r.capacity : 0;
    }
  });

  renderRoomSimulation();
}

function adjustTypeOccupancy(roomType, delta) {
  const roomsOfType = ROOM_DIRECTORY_DATA.filter(r => r.roomType === roomType);
  const currentOccupied = roomsOfType.filter(r => simState.occupancy[r.id] && simState.roomOccupiedBeds[r.id] > 0).length;
  setTypeOccupancyCount(roomType, currentOccupied + delta);
}

function batchSetOccupancy(target, isOccupied) {
  ROOM_DIRECTORY_DATA.forEach(r => {
    if (target === 'all' || r.ward === target) {
      simState.occupancy[r.id] = isOccupied;
      if (simState.roomOccupiedBeds) {
        simState.roomOccupiedBeds[r.id] = isOccupied ? r.capacity : 0;
      }
    }
  });
  renderRoomSimulation();
}

function setSimCapacityMode(mode) {
  simState.capacityMode = mode;
  ['actual', 'single', 'room'].forEach(m => {
    const btn = document.getElementById(`btn-mode-${m}`);
    if (btn) {
      if (m === mode || (mode === 'bed' && m === 'single')) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    }
  });
  const btnBed = document.getElementById('btn-mode-bed');
  if (btnBed) {
    if (mode === 'bed' || mode === 'single') {
      btnBed.classList.add('active');
    } else {
      btnBed.classList.remove('active');
    }
  }
  const btnRoom = document.getElementById('btn-mode-room');
  if (btnRoom) {
    if (mode === 'room') {
      btnRoom.classList.add('active');
    } else {
      btnRoom.classList.remove('active');
    }
  }
  renderRoomSimulation();
}

function filterSimWard(ward) {
  simState.activeFilter = ward;
  document.querySelectorAll('.sim-filter-btn').forEach(btn => {
    if (btn.getAttribute('data-filter') === ward) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });
  renderRoomSimulation();
}

// ========================================================
// 원무 관리자 설정 모달 컨트롤러 및 실시간 UI 렌더링
// ========================================================

function openWardFeeSettingsModal() {
  const isAuth = sessionStorage.getItem('hn_admin_authenticated') === 'true';
  if (isAuth) {
    showWardFeeModal();
  } else {
    const pinModal = document.getElementById('admin-pin-modal');
    if (pinModal) {
      pinModal.classList.add('show');
      const input = document.getElementById('admin-pin-input');
      const errBox = document.getElementById('pin-error-text');
      if (errBox) errBox.textContent = '';
      if (input) {
        input.value = '';
        setTimeout(() => input.focus(), 120);
      }
    }
  }
}

function closeAdminPinModal() {
  const modal = document.getElementById('admin-pin-modal');
  if (modal) modal.classList.remove('show');
}

function submitAdminPin(e) {
  if (e) e.preventDefault();
  const input = document.getElementById('admin-pin-input');
  const errBox = document.getElementById('pin-error-text');
  const enteredPin = input ? input.value.trim() : '';
  const storedPin = localStorage.getItem(STORAGE_KEY_ADMIN_PIN) || DEFAULT_ADMIN_PIN;

  if (enteredPin === storedPin) {
    sessionStorage.setItem('hn_admin_authenticated', 'true');
    closeAdminPinModal();
    showWardFeeModal();
  } else {
    if (errBox) errBox.textContent = `비밀번호가 일치하지 않습니다. (초기 비밀번호: ${storedPin})`;
    if (input) {
      input.value = '';
      input.focus();
    }
  }
}

function promptChangeAdminPin() {
  const storedPin = localStorage.getItem(STORAGE_KEY_ADMIN_PIN) || DEFAULT_ADMIN_PIN;
  const currentInput = prompt('현재 비밀번호 4자리를 입력해주세요:', '');
  if (currentInput === null) return;
  if (currentInput.trim() !== storedPin) {
    alert('현재 비밀번호가 일치하지 않습니다.');
    return;
  }
  const newPin = prompt('새로운 관리자 4자리 비밀번호를 입력해주세요:', '');
  if (!newPin || newPin.trim().length < 4) {
    alert('비밀번호는 최소 4자리 이상이어야 합니다.');
    return;
  }
  localStorage.setItem(STORAGE_KEY_ADMIN_PIN, newPin.trim());
  showAdminToast('관리자 비밀번호가 성공적으로 변경되었습니다.');
}

function showWardFeeModal() {
  const modal = document.getElementById('ward-fee-modal');
  if (!modal) return;

  deletedDraftRooms.clear();
  currentModalDraft = {};

  if (typeof DEFAULT_WARD_ROOM_SETTINGS !== 'undefined') {
    Object.keys(DEFAULT_WARD_ROOM_SETTINGS).forEach(k => {
      const def = DEFAULT_WARD_ROOM_SETTINGS[k];
      const customFee = customWardFees[k];
      currentModalDraft[k] = {
        ...def,
        target30: (customFee && customFee.target30) ? customFee.target30 : def.target30,
        customDailyRoom: (customFee && customFee.customDailyRoom) ? customFee.customDailyRoom : undefined,
        customDailyBasic: (customFee && customFee.customDailyBasic) ? customFee.customDailyBasic : undefined
      };
    });
  }

  // Ensure 5병동 4인실 is never in draft
  delete currentModalDraft['5병동_4인실'];

  modal.classList.add('show');
  renderWardFeeModal();
}

function closeWardFeeSettingsModal() {
  const modal = document.getElementById('ward-fee-modal');
  if (modal) modal.classList.remove('show');
}

function switchSettingsWardTab(tab) {
  activeSettingsTab = tab;
  document.querySelectorAll('#ward-fee-tabs-container .ward-fee-tab').forEach(btn => {
    if (btn.getAttribute('data-tab') === tab) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });
  renderWardFeeModal();
}

function toggleAddRoomDrawer() {
  const drawer = document.getElementById('add-room-drawer');
  const arrow = document.getElementById('add-room-arrow');
  if (drawer) {
    const isHidden = drawer.style.display === 'none' || !drawer.style.display;
    drawer.style.display = isHidden ? 'block' : 'none';
    if (arrow) arrow.textContent = isHidden ? '▲' : '▼';
    if (isHidden) {
      const wardSelect = document.getElementById('new-room-ward');
      if (wardSelect) {
        if (activeSettingsTab !== 'all') {
          wardSelect.value = activeSettingsTab;
        }
      }
      suggestNewRoomDefaults(wardSelect ? wardSelect.value : '7병동', document.getElementById('new-room-base-key')?.value || '4인실');
      document.getElementById('new-room-name')?.focus();
    }
  }
}

function onNewRoomWardChange(ward) {
  const baseKey = document.getElementById('new-room-base-key')?.value || '4인실';
  suggestNewRoomDefaults(ward, baseKey);
}

function onNewRoomBaseKeyChange(baseKey) {
  const ward = document.getElementById('new-room-ward')?.value || '7병동';
  suggestNewRoomDefaults(ward, baseKey);
}

function suggestNewRoomDefaults(ward, baseKey) {
  const nameInput = document.getElementById('new-room-name');
  const targetInput = document.getElementById('new-room-target30');
  const wardNum = ward.replace(/[^0-9]/g, '');
  
  if (baseKey === '1인실') {
    if (nameInput && (!nameInput.value || nameInput.value.includes('인실'))) {
      nameInput.value = `1인실 (${wardNum}20호 VIP)`;
    }
    if (targetInput) targetInput.value = (ward === '5병동' || ward === '8병동') ? 7500000 : 6500000;
  } else if (baseKey === '2인실') {
    if (nameInput && (!nameInput.value || nameInput.value.includes('인실'))) {
      nameInput.value = `2인실 (${wardNum}15호)`;
    }
    if (targetInput) targetInput.value = (ward === '5병동' || ward === '8병동') ? 5100000 : 3900000;
  } else if (baseKey === '3인실') {
    if (nameInput && (!nameInput.value || nameInput.value.includes('인실'))) {
      nameInput.value = `3인실 (${wardNum}17호)`;
    }
    if (targetInput) targetInput.value = 3100000;
  } else if (baseKey === '4인실') {
    if (nameInput && (!nameInput.value || nameInput.value.includes('인실'))) {
      nameInput.value = `4인실 (${wardNum}01호~${wardNum}14호)`;
    }
    if (targetInput) targetInput.value = (ward === '5병동' || ward === '8병동') ? 3100000 : 2600000;
  } else {
    if (nameInput && (!nameInput.value || nameInput.value.includes('인실'))) {
      nameInput.value = `8인실 (다인실)`;
    }
    if (targetInput) targetInput.value = 3000000;
  }
}

function submitAddNewRoom() {
  const ward = document.getElementById('new-room-ward')?.value || '7병동';
  const baseRoomKey = document.getElementById('new-room-base-key')?.value || '4인실';
  const name = document.getElementById('new-room-name')?.value.trim();
  const target30 = parseInt(document.getElementById('new-room-target30')?.value, 10) || 3000000;

  if (!name) {
    alert('병실 명칭 및 호실 번호를 입력해주세요. (예: 1인실 (720호 VIP))');
    document.getElementById('new-room-name')?.focus();
    return;
  }

  if (ward === '5병동' && baseRoomKey === '4인실') {
    alert('5병동은 4인실이 없는 다인실(8인실) 전용 병동입니다.');
    return;
  }

  const wardType = (ward === '5병동' || ward === '8병동') ? 'integrated' : 'general';
  const sanitizedRoomKey = name.replace(/[^\w\uAC00-\uD7A30-9]/g, '_');
  const roomId = `${ward}_${sanitizedRoomKey}`;

  let fixedCopay = ROOM_COP_FIXED[baseRoomKey] || null;
  let copayRate = fixedCopay || 0.20;

  const feeDb = (INPATIENT_FEE_DB[wardType] && INPATIENT_FEE_DB[wardType][baseRoomKey]) 
    ? INPATIENT_FEE_DB[wardType][baseRoomKey]
    : { d15: 121990, d16: 111790, d31: 106690 };

  const basicDaily = (wardType === 'integrated') ? 50000 : 38000;

  const newDef = {
    ward: ward,
    roomKey: name,
    name: name,
    type: wardType,
    baseRoomKey: baseRoomKey,
    target30: target30,
    d15: feeDb.d15,
    d16: feeDb.d16,
    d31: feeDb.d31,
    basicCareDaily: basicDaily,
    copayRate: copayRate,
    fixedCopay: fixedCopay,
    presets: [
      Math.max(500000, Math.round((target30 - 300000) / 100000) * 100000),
      Math.max(500000, Math.round((target30 - 100000) / 100000) * 100000),
      target30,
      Math.round((target30 + 100000) / 100000) * 100000,
      Math.round((target30 + 300000) / 100000) * 100000
    ]
  };

  const computed = calculateFeesFromTarget(newDef, target30);
  newDef.d15 = computed.d15;
  newDef.d16 = computed.d16;
  newDef.d31 = computed.d31;
  newDef.basicCareDaily = computed.basicCareDaily;

  currentModalDraft[roomId] = newDef;
  DEFAULT_WARD_ROOM_SETTINGS[roomId] = newDef;

  toggleAddRoomDrawer();

  activeSettingsTab = ward;
  document.querySelectorAll('#ward-fee-tabs-container .ward-fee-tab').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-tab') === ward);
  });

  renderWardFeeModal();

  setTimeout(() => {
    const cardId = roomId.replace(/[\s\[\]]+/g, '_');
    const el = document.getElementById(`card-${cardId}`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, 100);

  showAdminToast(`'${ward} ${name}' 항목이 설정창에 추가되었습니다. 하단의 [저장]을 누르면 즉시 반영됩니다.`);
}

function onDraftRoomNameChange(k, newName) {
  if (currentModalDraft[k]) {
    currentModalDraft[k].name = newName.trim() || currentModalDraft[k].roomKey;
    const cardId = k.replace(/[\s\[\]]+/g, '_');
    const card = document.getElementById(`card-${cardId}`);
    if (card) card.classList.add('modified');
  }
}

function onDraftBaseKeyChange(k, newBaseKey) {
  const item = currentModalDraft[k];
  if (!item) return;

  item.baseRoomKey = newBaseKey;
  item.fixedCopay = ROOM_COP_FIXED[newBaseKey] || null;
  item.copayRate = item.fixedCopay || 0.20;

  const wardType = item.type || 'general';
  const feeDb = (INPATIENT_FEE_DB[wardType] && INPATIENT_FEE_DB[wardType][newBaseKey]) 
    ? INPATIENT_FEE_DB[wardType][newBaseKey] 
    : { d15: 121990, d16: 111790, d31: 106690 };

  item.d15 = feeDb.d15;
  item.d16 = feeDb.d16;
  item.d31 = feeDb.d31;

  const computed = calculateFeesFromTarget(item, item.target30);
  item.d15 = computed.d15;
  item.d16 = computed.d16;
  item.d31 = computed.d31;
  item.basicCareDaily = computed.basicCareDaily;

  updateCardLiveDisplay(k);
}

function deleteDraftRoom(k) {
  const item = currentModalDraft[k];
  const name = item ? `${item.ward} ${item.name}` : k;
  if (!confirm(`'${name}' 병실을 정말 삭제하시겠습니까?\n삭제 후 하단 [설정 저장]을 누르면 계산기 화면에서도 제거됩니다.`)) {
    return;
  }
  deletedDraftRooms.add(k);
  delete currentModalDraft[k];
  renderWardFeeModal();
  showAdminToast(`'${name}' 병실이 삭제되었습니다. [저장] 시 완전히 반영됩니다.`);
}

function renderWardFeeModal() {
  const container = document.getElementById('ward-fee-room-list');
  if (!container) return;

  container.innerHTML = '';

  const keys = Object.keys(currentModalDraft).filter(k => {
    const item = currentModalDraft[k];
    if (deletedDraftRooms.has(k)) return false;
    if (k === '5병동_4인실') return false; // 5병동 4인실 영구 배제
    if (activeSettingsTab === 'all') return true;
    return item.ward === activeSettingsTab;
  });

  if (keys.length === 0) {
    container.innerHTML = '<div style="text-align:center; padding:40px; color:var(--slate-500); font-weight:600;">선택하신 병동에 설정 가능한 병실 항목이 없습니다.<br>상단의 <strong>[➕ 새 병실 / 호실 추가하기]</strong> 버튼을 눌러 병실을 등록하세요.</div>';
    return;
  }

  keys.forEach(k => {
    const def = currentModalDraft[k] || DEFAULT_WARD_ROOM_SETTINGS[k];
    const currentTarget = def.target30;

    const computed = calculateFeesFromTarget(def, currentTarget);
    const dailyPatientCopay = Math.round(currentTarget / 30);

    const room30Before = 15 * computed.d15 + 15 * computed.d16;
    const basic30Before = 30 * computed.basicCareDaily;
    const rehab30Before = 6450000;
    const meals30Before = 729000;
    const total30MedicalBefore = room30Before + basic30Before + rehab30Before + meals30Before;

    const isModified = (currentTarget !== def.target30) || (def.customDailyRoom !== undefined);

    const card = document.createElement('div');
    card.className = `room-setting-card${isModified ? ' modified' : ''}`;
    const cardId = k.replace(/[\s\[\]]+/g, '_');
    card.id = `card-${cardId}`;

    const wardTypeLabel = def.type === 'integrated' ? '간호간병통합' : '일반병동';

    const presetBtnsHtml = (def.presets || [2600000, 3000000, 3100000]).map(p => {
      const pTenThousand = Math.round(p / 10000);
      const isSelected = p === currentTarget;
      return `<button type="button" class="room-preset-btn${isSelected ? ' active' : ''}" onclick="setDraftTarget30('${k}', ${p})">${pTenThousand}만</button>`;
    }).join(' ');

    card.innerHTML = `
      <div class="room-setting-header">
        <div class="room-setting-title-wrap" style="flex-wrap: wrap; gap: 8px; flex: 1;">
          <span class="room-name-badge">${def.ward}</span>
          <input type="text" 
                 class="room-name-inline-input" 
                 value="${def.name}" 
                 oninput="onDraftRoomNameChange('${k}', this.value)" 
                 placeholder="예: 2인실 (715호, 716호)" 
                 title="병실 명칭 및 호실 번호를 직접 수정할 수 있습니다">
          <span class="room-type-tag ${def.type}">${wardTypeLabel}</span>
          
          <div style="display:inline-flex; align-items:center; gap:4px;">
            <span style="font-size:11px; color:var(--slate-500); font-weight:600;">수가:</span>
            <select class="room-basekey-select" onchange="onDraftBaseKeyChange('${k}', this.value)" title="적용할 건강보험 수가 기준을 변경합니다">
              <option value="1인실" ${def.baseRoomKey === '1인실' ? 'selected' : ''}>1인실 (전액비급여 / 상한제✕)</option>
              <option value="2인실" ${def.baseRoomKey === '2인실' ? 'selected' : ''}>2인실 (상급병실 40% / 상한제✕)</option>
              <option value="3인실" ${def.baseRoomKey === '3인실' ? 'selected' : ''}>3인실 (상급병실 30% / 상한제✕)</option>
              <option value="4인실" ${def.baseRoomKey === '4인실' ? 'selected' : ''}>4인실 (기준병실 20% / 상한제○)</option>
              <option value="8인실" ${def.baseRoomKey === '8인실' ? 'selected' : ''}>8인실 (다인실 20% / 상한제○)</option>
            </select>
          </div>
        </div>

        <div style="display: flex; gap: 6px;">
          <button type="button" class="room-delete-btn" onclick="deleteDraftRoom('${k}')" title="이 병실을 목록에서 삭제합니다">
            🗑️ 삭제
          </button>
          <button type="button" class="room-reset-btn" onclick="resetRoomDraftToDefault('${k}')" title="이 병실을 공식 기본값으로 되돌립니다">
            ↺ 복원
          </button>
        </div>
      </div>

      <div class="room-setting-grid">
        <div class="target-price-input-wrap">
          <label class="target-price-label">
            <span>🏷️ 30일 기준 예상 환자본인부담금 설정</span>
          </label>
          <div class="target-input-row">
            <input type="text" 
                   class="target-price-input" 
                   id="input-target-${cardId}" 
                   value="${currentTarget.toLocaleString('ko-KR')}" 
                   oninput="onDraftTargetInput('${k}', this.value)"
                   inputmode="numeric">
            <span class="target-unit">원</span>
          </div>
          <div class="room-preset-chips">
            <span style="font-size:11px; color:var(--slate-500); align-self:center; margin-right:4px;">빠른 선택:</span>
            ${presetBtnsHtml}
          </div>
          <button type="button" class="advanced-toggle-btn" onclick="toggleAdvancedDrawer('${k}')">
            <span>⚙️ 1일 입원료/진료비 세부 수가 직접 조정</span> <span id="adv-arrow-${cardId}">▼</span>
          </button>
        </div>

        <div class="room-live-breakdown-box">
          <div class="breakdown-row">
            <span class="breakdown-label">30일 환자 본인부담금:</span>
            <span class="breakdown-val highlight" id="badge-target-${cardId}">${fmt(currentTarget)}</span>
          </div>
          <div class="breakdown-row">
            <span class="breakdown-label">1일 평균 환자 부담액:</span>
            <span class="breakdown-val" id="badge-daily-${cardId}">${fmt(dailyPatientCopay)}</span>
          </div>
          <div class="breakdown-row">
            <span class="breakdown-label">30일 총 진료비 (보험전):</span>
            <span class="breakdown-val" id="badge-totalmed-${cardId}">${fmt(total30MedicalBefore)}</span>
          </div>
          <div class="breakdown-row" style="border-top:1px dashed var(--slate-200); padding-top:4px; margin-top:4px;">
            <span class="breakdown-label">1일 기본 입원료 (1~15일):</span>
            <span class="breakdown-val" id="badge-d15-${cardId}">${fmt(computed.d15)}</span>
          </div>
          <div class="breakdown-row">
            <span class="breakdown-label">1일 기본 진료·검사비:</span>
            <span class="breakdown-val" id="badge-basic-${cardId}">${fmt(computed.basicCareDaily)}</span>
          </div>
        </div>
      </div>

      <!-- Advanced Drawer -->
      <div class="advanced-drawer" id="adv-drawer-${cardId}">
        <div style="font-size:11px; font-weight:700; color:var(--slate-700); margin-bottom:8px;">
          🔬 심평원 체감 구간별 1일 단가 직접 지정 (원 단위)
        </div>
        <div class="advanced-fields-grid">
          <div>
            <div class="adv-field-label">1~15일 입원료</div>
            <input type="number" class="adv-field-input" id="adv-d15-${cardId}" value="${computed.d15}" onchange="onDraftAdvChange('${k}')">
          </div>
          <div>
            <div class="adv-field-label">16~30일 입원료</div>
            <input type="number" class="adv-field-input" id="adv-d16-${cardId}" value="${computed.d16}" onchange="onDraftAdvChange('${k}')">
          </div>
          <div>
            <div class="adv-field-label">31일이상 입원료</div>
            <input type="number" class="adv-field-input" id="adv-d31-${cardId}" value="${computed.d31}" onchange="onDraftAdvChange('${k}')">
          </div>
          <div>
            <div class="adv-field-label">1일 기본 진료비</div>
            <input type="number" class="adv-field-input" id="adv-basic-${cardId}" value="${computed.basicCareDaily}" onchange="onDraftAdvChange('${k}')">
          </div>
        </div>
      </div>
    `;

    container.appendChild(card);
  });
}

function updateCardLiveDisplay(k) {
  const item = currentModalDraft[k];
  if (!item) return;
  const currentTarget = item.target30;
  const cardId = k.replace(/[\s\[\]]+/g, '_');

  let computed;
  if (item.customDailyRoom && item.customDailyBasic) {
    computed = {
      d15: item.customDailyRoom.d15,
      d16: item.customDailyRoom.d16,
      d31: item.customDailyRoom.d31,
      basicCareDaily: item.customDailyBasic
    };
  } else {
    computed = calculateFeesFromTarget(item, currentTarget);
  }

  const dailyPatientCopay = Math.round(currentTarget / 30);
  const room30Before = 15 * computed.d15 + 15 * computed.d16;
  const basic30Before = 30 * computed.basicCareDaily;
  const total30MedicalBefore = room30Before + basic30Before + 6450000 + 729000;

  const bTarget = document.getElementById(`badge-target-${cardId}`);
  const bDaily = document.getElementById(`badge-daily-${cardId}`);
  const bTotalMed = document.getElementById(`badge-totalmed-${cardId}`);
  const bD15 = document.getElementById(`badge-d15-${cardId}`);
  const bBasic = document.getElementById(`badge-basic-${cardId}`);
  const card = document.getElementById(`card-${cardId}`);

  if (bTarget) bTarget.textContent = fmt(currentTarget);
  if (bDaily) bDaily.textContent = fmt(dailyPatientCopay);
  if (bTotalMed) bTotalMed.textContent = fmt(total30MedicalBefore);
  if (bD15) bD15.textContent = fmt(computed.d15);
  if (bBasic) bBasic.textContent = fmt(computed.basicCareDaily);

  const advD15 = document.getElementById(`adv-d15-${cardId}`);
  const advD16 = document.getElementById(`adv-d16-${cardId}`);
  const advD31 = document.getElementById(`adv-d31-${cardId}`);
  const advBasic = document.getElementById(`adv-basic-${cardId}`);

  if (advD15) advD15.value = computed.d15;
  if (advD16) advD16.value = computed.d16;
  if (advD31) advD31.value = computed.d31;
  if (advBasic) advBasic.value = computed.basicCareDaily;

  if (card) {
    card.classList.add('modified');
    card.querySelectorAll('.room-preset-btn').forEach(btn => {
      const pVal = parseInt(btn.textContent.replace(/[^0-9]/g, ''), 10) * 10000;
      if (pVal === currentTarget) btn.classList.add('active');
      else btn.classList.remove('active');
    });
  }
}

function setDraftTarget30(k, amount) {
  const cardId = k.replace(/[\s\[\]]+/g, '_');
  if (currentModalDraft[k]) {
    currentModalDraft[k].target30 = amount;
  }
  const input = document.getElementById(`input-target-${cardId}`);
  if (input) input.value = amount.toLocaleString('ko-KR');
  updateCardLiveDisplay(k);
}

function onDraftTargetInput(k, rawVal) {
  const num = parseInt(rawVal.replace(/[^0-9]/g, ''), 10) || 0;
  if (currentModalDraft[k]) {
    currentModalDraft[k].target30 = num;
  }
  updateCardLiveDisplay(k);
}

function toggleAdvancedDrawer(k) {
  const cardId = k.replace(/[\s\[\]]+/g, '_');
  const drawer = document.getElementById(`adv-drawer-${cardId}`);
  const arrow = document.getElementById(`adv-arrow-${cardId}`);
  if (drawer) {
    const isOpen = drawer.classList.contains('open');
    if (isOpen) {
      drawer.classList.remove('open');
      if (arrow) arrow.textContent = '▼';
    } else {
      drawer.classList.add('open');
      if (arrow) arrow.textContent = '▲';
    }
  }
}

function onDraftAdvChange(k) {
  const cardId = k.replace(/[\s\[\]]+/g, '_');
  const item = currentModalDraft[k];
  if (!item) return;

  const d15 = parseInt(document.getElementById(`adv-d15-${cardId}`)?.value || item.d15, 10);
  const d16 = parseInt(document.getElementById(`adv-d16-${cardId}`)?.value || item.d16, 10);
  const d31 = parseInt(document.getElementById(`adv-d31-${cardId}`)?.value || item.d31, 10);
  const basic = parseInt(document.getElementById(`adv-basic-${cardId}`)?.value || item.basicCareDaily, 10);

  const room30Before = 15 * d15 + 15 * d16;
  const basic30Before = 30 * basic;
  const rehabMealCopay = 1654500;

  let roomCopay = 0;
  let basicCopay = 0;
  if (item.fixedCopay) {
    roomCopay = Math.round(room30Before * item.fixedCopay);
    basicCopay = Math.round(basic30Before * 0.20);
  } else {
    roomCopay = Math.round(room30Before * item.copayRate);
    basicCopay = Math.round(basic30Before * item.copayRate);
  }

  const calculatedTarget30 = roomCopay + basicCopay + rehabMealCopay;

  item.target30 = calculatedTarget30;
  item.customDailyRoom = { d15, d16, d31 };
  item.customDailyBasic = basic;

  const input = document.getElementById(`input-target-${cardId}`);
  if (input) input.value = calculatedTarget30.toLocaleString('ko-KR');

  updateCardLiveDisplay(k);
}

function resetRoomDraftToDefault(k) {
  const def = DEFAULT_WARD_ROOM_SETTINGS[k];
  if (!def) return;
  const cardId = k.replace(/[\s\[\]]+/g, '_');
  currentModalDraft[k] = JSON.parse(JSON.stringify(def));
  const input = document.getElementById(`input-target-${cardId}`);
  if (input) input.value = def.target30.toLocaleString('ko-KR');
  renderWardFeeModal();
}

function saveWardFeeSettings() {
  try {
    // 1. Process deleted rooms
    deletedDraftRooms.forEach(k => {
      delete DEFAULT_WARD_ROOM_SETTINGS[k];
      delete customWardFees[k];
    });

    // 2. Save custom rooms definition & fees
    const roomsToPersist = {};
    Object.keys(currentModalDraft).forEach(k => {
      const draft = currentModalDraft[k];
      DEFAULT_WARD_ROOM_SETTINGS[k] = draft;
      roomsToPersist[k] = draft;
    });

    localStorage.setItem(STORAGE_KEY_WARD_ROOMS, JSON.stringify({ rooms: roomsToPersist }));

    // 3. Save fee drafts
    customWardFees = JSON.parse(JSON.stringify(currentModalDraft));
    localStorage.setItem(STORAGE_KEY_WARD_FEES, JSON.stringify(customWardFees));

    // 4. Rebuild WARD_ROOM_CONFIG
    Object.keys(WARD_ROOM_CONFIG).forEach(w => {
      WARD_ROOM_CONFIG[w].rooms = {};
    });

    Object.keys(currentModalDraft).forEach(k => {
      const r = currentModalDraft[k];
      if (!WARD_ROOM_CONFIG[r.ward]) {
        WARD_ROOM_CONFIG[r.ward] = { type: r.type || 'general', rooms: {} };
      }
      WARD_ROOM_CONFIG[r.ward].rooms[r.roomKey] = {
        name: r.name,
        baseRoomKey: r.baseRoomKey
      };
    });

    // Ensure 5병동 never has 4인실
    if (WARD_ROOM_CONFIG['5병동'] && WARD_ROOM_CONFIG['5병동'].rooms['4인실']) {
      delete WARD_ROOM_CONFIG['5병동'].rooms['4인실'];
    }

    deletedDraftRooms.clear();
  } catch (err) {
    console.error('Failed to save to localStorage:', err);
  }

  closeWardFeeSettingsModal();
  renderRoomSelector();
  calculateAll();
  renderRoomSimulation();
  showAdminToast('병동·호실 설정 및 병원비가 성공적으로 저장되어 계산기에 즉시 반영되었습니다!');
}

function resetAllWardFeesToDefault() {
  if (!confirm('정말로 모든 병동 및 병실의 호실 구성과 금액을 공식 표준 기본값으로 초기화하시겠습니까?')) {
    return;
  }
  customWardFees = {};
  currentModalDraft = {};
  deletedDraftRooms.clear();
  try {
    localStorage.removeItem(STORAGE_KEY_WARD_FEES);
    localStorage.removeItem(STORAGE_KEY_WARD_ROOMS);
  } catch (err) {}

  // Restore factory WARD_ROOM_CONFIG
  WARD_ROOM_CONFIG['5병동'] = {
    type: 'integrated',
    rooms: { '8인실': { name: '8인실 (다인실)', baseRoomKey: '8인실' } }
  };
  WARD_ROOM_CONFIG['6병동'] = {
    type: 'general',
    rooms: {
      '4인실': { name: '4인실', baseRoomKey: '4인실' },
      '3인실': { name: '3인실 (606호, 609호) [4인실 수가]', baseRoomKey: '4인실' }
    }
  };
  WARD_ROOM_CONFIG['7병동'] = {
    type: 'general',
    rooms: {
      '4인실': { name: '4인실', baseRoomKey: '4인실' },
      '3인실': { name: '3인실 (717호, 718호)', baseRoomKey: '3인실' },
      '3인실 [4인실 수가]': { name: '3인실 (706호, 709호) [4인실 수가]', baseRoomKey: '4인실' },
      '2인실': { name: '2인실 (715호)', baseRoomKey: '2인실' }
    }
  };
  WARD_ROOM_CONFIG['8병동'] = {
    type: 'integrated',
    rooms: {
      '4인실': { name: '4인실', baseRoomKey: '4인실' },
      '3인실 [4인실 수가]': { name: '3인실 (809호, 819호) [4인실 수가]', baseRoomKey: '4인실' },
      '2인실': { name: '2인실 (806호, 815호, 818호)', baseRoomKey: '2인실' }
    }
  };

  showWardFeeModal();
  renderRoomSelector();
  calculateAll();
  renderRoomSimulation();
  showAdminToast('모든 병동 및 병실 설정이 공식 기본값으로 초기화되었습니다.');
}

function showAdminToast(msg) {
  const toast = document.getElementById('admin-toast');
  const text = document.getElementById('admin-toast-text');
  if (text) text.textContent = msg;
  if (toast) {
    toast.classList.add('show');
    clearTimeout(toast._timeout);
    toast._timeout = setTimeout(() => {
      toast.classList.remove('show');
    }, 3500);
  }
}

// Window click outside listener for closing modals
window.addEventListener('click', (e) => {
  const pinModal = document.getElementById('admin-pin-modal');
  if (e.target === pinModal) closeAdminPinModal();
  const wardModal = document.getElementById('ward-fee-modal');
  if (e.target === wardModal) closeWardFeeSettingsModal();
});

// Window global bindings for inline HTML handlers
window.switchView = switchView;
window.setRoomOccupancy = setRoomOccupancy;
window.adjustRoomBeds = adjustRoomBeds;
window.setTypeOccupancyCount = setTypeOccupancyCount;
window.adjustTypeOccupancy = adjustTypeOccupancy;
window.batchSetOccupancy = batchSetOccupancy;
window.setSimCapacityMode = setSimCapacityMode;
window.filterSimWard = filterSimWard;
window.renderRoomSimulation = renderRoomSimulation;

window.setExamMode = setExamMode;
window.toggleRobotRehab = toggleRobotRehab;
window.toggleNonBenefit = toggleNonBenefit;
window.toggleEmrTable = toggleEmrTable;

window.openWardFeeSettingsModal = openWardFeeSettingsModal;
window.closeWardFeeSettingsModal = closeWardFeeSettingsModal;
window.closeAdminPinModal = closeAdminPinModal;
window.submitAdminPin = submitAdminPin;
window.promptChangeAdminPin = promptChangeAdminPin;
window.switchSettingsWardTab = switchSettingsWardTab;
window.setDraftTarget30 = setDraftTarget30;
window.onDraftTargetInput = onDraftTargetInput;
window.toggleAdvancedDrawer = toggleAdvancedDrawer;
window.onDraftAdvChange = onDraftAdvChange;
window.resetRoomDraftToDefault = resetRoomDraftToDefault;
window.saveWardFeeSettings = saveWardFeeSettings;
window.resetAllWardFeesToDefault = resetAllWardFeesToDefault;
window.showAdminToast = showAdminToast;

window.toggleAddRoomDrawer = toggleAddRoomDrawer;
window.onNewRoomWardChange = onNewRoomWardChange;
window.onNewRoomBaseKeyChange = onNewRoomBaseKeyChange;
window.submitAddNewRoom = submitAddNewRoom;
window.onDraftRoomNameChange = onDraftRoomNameChange;
window.onDraftBaseKeyChange = onDraftBaseKeyChange;
window.deleteDraftRoom = deleteDraftRoom;

// Launch Calculator
init();

