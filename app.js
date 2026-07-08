// Current State Variables
let selectedWard = '5병동';
let selectedRoom = '8인실'; // Selected room key in WARD_ROOM_CONFIG
let selectedDisease = 'cns_stroke';
let selectedInsurance = 'nhi_general';
let selectedRehab = 'intensive';
let selectedDays = 30;
let selectedMealsPerDay = 3;
let selectedCeilingDecile = 'decile_1';

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

// Receipt DOM elements
const recWardRoom = document.getElementById('rec-ward-room');
const recInsurance = document.getElementById('rec-insurance');
const recDays = document.getElementById('rec-days');
const recBaseRoomTotal = document.getElementById('rec-base-room-total');
const recSurchargeRow = document.getElementById('rec-surcharge-row');
const recSurchargeTotal = document.getElementById('rec-surcharge-total');
const recRehabTotal = document.getElementById('rec-rehab-total');
const recMealsTotal = document.getElementById('rec-meals-total');
const recCopayBenefit = document.getElementById('rec-copay-benefit');
const recCopayNonBenefit = document.getElementById('rec-copay-non-benefit');
const recGrandTotal = document.getElementById('rec-grand-total');
const receiptFootnote = document.getElementById('receipt-footnote');
const mobilePrice = document.getElementById('mobile-price');
const compareGrid = document.getElementById('compare-grid');
const projectionGrid = document.getElementById('projection-grid');

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

// Initialization
function init() {
  // Date setup (defaulting to current date and onset 1 month ago)
  const todayStr = new Date().toISOString().split('T')[0];
  const pastStr = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  document.getElementById('onset-date-input').value = pastStr;
  document.getElementById('admission-date-input').value = todayStr;

  setupEventListeners();
  renderRoomSelector();
  checkGoldenTime();
  calculateAll();
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

// Calculation Engine
function calculateAll() {
  const config = WARD_ROOM_CONFIG[selectedWard];
  const wardType = config.type; // general or integrated
  const baseRoomKey = getRoomBaseKey(selectedRoom);
  const roomDisplayName = getRoomDisplayName(selectedRoom);
  const roomFees = INPATIENT_FEE_DB[wardType][baseRoomKey];
  
  // 1. Get room rate total with decay rules: d15, d16, d31
  let baseRoomTotal = 0;
  for (let d = 1; d <= selectedDays; d++) {
    if (d <= 15) {
      baseRoomTotal += roomFees.d15;
    } else if (d <= 30) {
      baseRoomTotal += roomFees.d16;
    } else {
      baseRoomTotal += roomFees.d31;
    }
  }

  // 2. Room surcharge (difference) for Workers' Comp or standard fixed copay
  let surchargeTotal = 0;
  const fixedCopayRate = ROOM_COP_FIXED[baseRoomKey];
  const isUpperRoom = !!fixedCopayRate;
  
  const insObj = COPAY_RATES[selectedInsurance];
  const generalCopayRate = insObj.rate;

  // Meal cost display update based on selected insurance
  const mealCostInfo = document.getElementById('meal-cost-info');
  if (mealCostInfo) {
    if (insObj.type === 'workers_comp') {
      mealCostInfo.value = "8,100원 (본인부담금 0%: 0원)";
    } else if (insObj.type === 'medical') {
      mealCostInfo.value = "8,100원 (본인부담금 20%: 1,620원)";
    } else if (insObj.type === 'special_billing') {
      mealCostInfo.value = "8,100원 (별도 산정)";
    } else {
      mealCostInfo.value = "8,100원 (본인부담금 50%: 4,050원)";
    }
  }
  
  // Calculate basic room copay
  let roomCopayPatient = 0;
  
  // Handle special billing category (의료급여 1종, 2종장애인, 차상위 1종)
  if (insObj.type === 'special_billing') {
    recWardRoom.textContent = `${selectedWard} ${roomDisplayName}`;
    recInsurance.textContent = `${insObj.name} (식대+전액+비급여)`;
    recDays.textContent = `${selectedDays}일`;
    recBaseRoomTotal.textContent = '별도 산정';
    recSurchargeRow.style.display = 'none';
    recRehabTotal.textContent = '별도 산정';
    recMealsTotal.textContent = '별도 산정';
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
  
  // Normal NHI, standard medical benefit, or Workers' Comp
  receiptFootnote.textContent = "※ 치료재료대, 약제비 및 비급여 검사/처치 비용은 제외된 모의 계산입니다.";

  if (insObj.type === 'workers_comp') {
    if (isUpperRoom) {
      // Under Workers' Comp, upper-tier room difference = Selected Room Fee - 4-bed Room Fee
      const base4RoomFees = INPATIENT_FEE_DB[wardType]['4인실'];
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
    // NHI & Medical Benefits
    if (isUpperRoom) {
      // NHI & Medical Benefit: upper-tier room pays fixed rate (40% for 2-bed, 30% for 3-bed) regardless of patient status
      roomCopayPatient = Math.round(baseRoomTotal * fixedCopayRate);
    } else {
      // 4-bed or 8-bed is covered by standard copay rate
      roomCopayPatient = Math.round(baseRoomTotal * generalCopayRate);
    }
  }

  // 3. Rehabilitation Therapy Fee
  const rehabBaseDaily = REHAB_COST_DAILY_BEFORE_INS[selectedRehab];
  const totalRehabBeforeIns = rehabBaseDaily * selectedDays;
  let rehabCopayPatient = 0;
  
  if (insObj.type === 'workers_comp') {
    rehabCopayPatient = 0; // Fully covered
  } else {
    rehabCopayPatient = Math.round(totalRehabBeforeIns * generalCopayRate);
  }

  // 4. Meals Cost
  const totalMealsCount = selectedMealsPerDay * selectedDays;
  const totalMealCostBeforeIns = totalMealsCount * MEAL_COST_PER_MEAL;
  let mealCopayRate = 0.50; // NHI general meal copay is 50%
  
  if (insObj.type === 'workers_comp') {
    mealCopayRate = 0.00; // Covered 100%
  } else if (insObj.type === 'medical') {
    mealCopayRate = 0.20; // Medical benefit type 2 meal copay is 20%
  }
  
  const mealCopayPatient = Math.round(totalMealCostBeforeIns * mealCopayRate);

  // 5. Split into Benefit Deductible (대상 본인부담금) & Non-Benefit (상급병실 차액, 비급여 등)
  let benefitCopayTotal = 0;
  let nonBenefitTotal = 0;
  
  if (insObj.type === 'workers_comp') {
    benefitCopayTotal = 0;
    nonBenefitTotal = surchargeTotal;
  } else {
    if (isUpperRoom) {
      benefitCopayTotal = rehabCopayPatient;
      nonBenefitTotal = roomCopayPatient;
    } else {
      benefitCopayTotal = roomCopayPatient + rehabCopayPatient;
      nonBenefitTotal = 0;
    }
  }

  // 6. Calculate Copay Ceiling Simulator
  let ceilingTextHtml = '';
  if (insObj.type === 'nhi') {
    const decileObj = CEILING_THRESHOLDS_2026[selectedCeilingDecile];
    const currentYearCeiling = decileObj.threshold;
    
    const subjectToCeiling = benefitCopayTotal;
    const isExceedCeiling = subjectToCeiling > currentYearCeiling;
    
    if (isExceedCeiling) {
      const refundEst = subjectToCeiling - currentYearCeiling;
      ceilingAlert.className = "notice-box box-success";
      ceilingTextHtml = `
        <span class="notice-box-icon">💡</span>
        <div>
          <strong>본인부담상한제 환급 가능 대상 (예상)</strong><br>
          <span>급여 본인부담금(${fmt(subjectToCeiling)})이 선택하신 ${decileObj.name} 연간 상한액(${fmt(currentYearCeiling)})을 초과합니다.<br>
          연간 누적 청구 시 약 <strong>${fmt(refundEst)}</strong>을 건강보험공단에서 환급받으실 수 있습니다. (상급병실 차액, 식대 제외)</span>
        </div>
      `;
    } else {
      const remaining = currentYearCeiling - subjectToCeiling;
      ceilingAlert.className = "notice-box";
      ceilingTextHtml = `
        <span class="notice-box-icon">ℹ️</span>
        <div>
          <strong>본인부담상한액 한도 이내 (환급 대상 아님)</strong><br>
          <span>급여 본인부담금(${fmt(subjectToCeiling)})이 ${decileObj.name} 연간 상한액(${fmt(currentYearCeiling)}) 이하입니다. 상한액까지 약 <strong>${fmt(remaining)}</strong>의 누적 한도가 남아있습니다.</span>
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

  // 7. Calculate Grand Total
  const grandTotal = roomCopayPatient + rehabCopayPatient + mealCopayPatient;

  // 8. Update Receipt Panel
  recWardRoom.textContent = `${selectedWard} ${roomDisplayName}`;
  recInsurance.textContent = `${insObj.label} (${insObj.type === 'workers_comp' ? '산재' : insObj.rate * 100 + '%'})`;
  recDays.textContent = `${selectedDays}일`;
  
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

  recRehabTotal.textContent = fmt(totalRehabBeforeIns);
  recMealsTotal.textContent = fmt(totalMealCostBeforeIns);
  
  recCopayBenefit.textContent = fmt(benefitCopayTotal + mealCopayPatient);
  recCopayNonBenefit.textContent = fmt(nonBenefitTotal);
  
  recGrandTotal.textContent = fmt(grandTotal);
  mobilePrice.textContent = fmt(grandTotal);

  // 9. Render room comparisons
  renderRoomComparison(insObj, generalCopayRate);

  // 10. Render projections (1-3 months)
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
    const baseKey = roomObj.baseRoomKey;
    const fixedCopay = ROOM_COP_FIXED[baseKey];
    const isUpper = !!fixedCopay;
    const roomFees = INPATIENT_FEE_DB[config.type][baseKey];
    
    let baseRoomTotal = 0;
    for (let d = 1; d <= selectedDays; d++) {
      if (d <= 15) baseRoomTotal += roomFees.d15;
      else if (d <= 30) baseRoomTotal += roomFees.d16;
      else baseRoomTotal += roomFees.d31;
    }

    let roomCopayPatient = 0;
    if (insObj.type === 'workers_comp') {
      if (isUpper) {
        const base4RoomFees = INPATIENT_FEE_DB[config.type]['4인실'];
        let total4RoomFee = 0;
        for (let d = 1; d <= selectedDays; d++) {
          if (d <= 15) total4RoomFee += base4RoomFees.d15;
          else if (d <= 30) total4RoomFee += base4RoomFees.d16;
          else total4RoomFee += base4RoomFees.d31;
        }
        roomCopayPatient = Math.max(0, baseRoomTotal - total4RoomFee);
      } else {
        roomCopayPatient = 0;
      }
    } else {
      if (isUpper) {
        roomCopayPatient = Math.round(baseRoomTotal * fixedCopay);
      } else {
        roomCopayPatient = Math.round(baseRoomTotal * generalCopayRate);
      }
    }

    // Rehab Therapy Copay
    const rehabBaseDaily = REHAB_COST_DAILY_BEFORE_INS[selectedRehab];
    const totalRehabBeforeIns = rehabBaseDaily * selectedDays;
    let rehabCopayPatient = insObj.type === 'workers_comp' ? 0 : Math.round(totalRehabBeforeIns * generalCopayRate);

    // Meals Copay
    const totalMealsCount = selectedMealsPerDay * selectedDays;
    const totalMealCostBeforeIns = totalMealsCount * MEAL_COST_PER_MEAL;
    let mealCopayRate = 0.50;
    if (insObj.type === 'workers_comp') mealCopayRate = 0.00;
    else if (insObj.type === 'medical') mealCopayRate = 0.20;
    const mealCopayPatient = Math.round(totalMealCostBeforeIns * mealCopayRate);

    const totalCopay = roomCopayPatient + rehabCopayPatient + mealCopayPatient;

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

  const config = WARD_ROOM_CONFIG[selectedWard];
  const periods = [30, 60, 90];
  const baseRoomKey = getRoomBaseKey(selectedRoom);
  
  periods.forEach((stayDays, index) => {
    const roomFees = INPATIENT_FEE_DB[config.type][baseRoomKey];
    const fixedCopay = ROOM_COP_FIXED[baseRoomKey];
    const isUpper = !!fixedCopay;
    
    // Inpatient Room Total
    let baseRoomTotal = 0;
    for (let d = 1; d <= stayDays; d++) {
      if (d <= 15) baseRoomTotal += roomFees.d15;
      else if (d <= 30) baseRoomTotal += roomFees.d16;
      else baseRoomTotal += roomFees.d31;
    }

    // Room Copay
    let roomCopayPatient = 0;
    if (insObj.type === 'workers_comp') {
      if (isUpper) {
        const base4RoomFees = INPATIENT_FEE_DB[config.type]['4인실'];
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
      if (isUpper) {
        roomCopayPatient = Math.round(baseRoomTotal * fixedCopay);
      } else {
        roomCopayPatient = Math.round(baseRoomTotal * generalCopayRate);
      }
    }

    // Rehab Therapy Copay
    const rehabBaseDaily = REHAB_COST_DAILY_BEFORE_INS[selectedRehab];
    const totalRehabBeforeIns = rehabBaseDaily * stayDays;
    let rehabCopayPatient = insObj.type === 'workers_comp' ? 0 : Math.round(totalRehabBeforeIns * generalCopayRate);

    // Meals Copay
    const totalMealsCount = selectedMealsPerDay * stayDays;
    const totalMealCostBeforeIns = totalMealsCount * MEAL_COST_PER_MEAL;
    let mealCopayRate = 0.50;
    if (insObj.type === 'workers_comp') mealCopayRate = 0.00;
    else if (insObj.type === 'medical') mealCopayRate = 0.20;
    const mealCopayPatient = Math.round(totalMealCostBeforeIns * mealCopayRate);

    const totalCopay = roomCopayPatient + rehabCopayPatient + mealCopayPatient;

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

// Launch Calculator
init();
