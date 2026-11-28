let fixedRoutineList = [];
let adminSelectedFixed = { 홍리안: [], 홍지운: [] };
let adminCustomTodos = { 홍리안: [], 홍지운: [] };
let adminTodoRewards = { 홍리안: {}, 홍지운: {} };
let adminMealReward = 0;

let photoDatesMap = {};
let settlementMap = {};

let calYear = parseInt(TODAY.slice(0, 4), 10);
let calMonth = parseInt(TODAY.slice(5, 7), 10) - 1;

function getFixedRewardByText(text) {
  const found = fixedRoutineList.find(r => r.text === text);
  return found ? (Number(found.reward) || 0) : 0;
}

function getCombinedAdminTodoList(kidName) {
  const fixedSel = adminSelectedFixed[kidName] || [];
  const customSel = adminCustomTodos[kidName] || [];
  const merged = [];
  fixedSel.forEach(item => {
    if (!merged.includes(item)) merged.push(item);
  });
  customSel.forEach(item => {
    if (!merged.includes(item)) merged.push(item);
  });
  return merged;
}

function renderFixedMasterChips() {
  const el = document.getElementById("fixedMasterChips");
  if (!fixedRoutineList.length) {
    el.innerHTML = "<span style='font-size:11px; color:#b45309;'>등록된 고정 할일이 없습니다. 위 입력창에서 자주 쓰는 할일과 용돈을 추가해 주세요.</span>";
    return;
  }
  el.innerHTML = fixedRoutineList.map((item, idx) =>
    "<span class='fixed-master-chip'>" +
    "<span>⭐ " + escapeHtml(item.text) + " (" + formatWon(item.reward) + ")</span>" +
    "<button type='button' class='fixed-master-del' title='고정 목록에서 삭제' onclick=\"removeFixedRoutineItem(" + idx + ")\">✕</button>" +
    "</span>"
  ).join("");
}

function renderFixedPickersForAllKids() {
  KIDS.forEach(kidName => {
    const el = document.getElementById("fixedPicker_" + kidName);
    if (!el) return;
    if (!fixedRoutineList.length) {
      el.innerHTML = "<span style='font-size:11px; color:#94a3b8;'>위 노란 상자에서 먼저 고정 할일을 등록하면 여기에 선택 칩이 나타납니다.</span>";
      return;
    }
    const selectedSet = new Set(adminSelectedFixed[kidName] || []);
    el.innerHTML = fixedRoutineList.map(item => {
      const isSel = selectedSet.has(item.text);
      const prefix = isSel ? "✓ " : "+ ";
      const rwText = item.reward > 0 ? (" · " + formatWon(item.reward)) : "";
      return "<button type='button' class='fixed-pick-chip" + (isSel ? " selected" : "") + "' onclick=\"toggleFixedForKid('" + kidName + "', '" + escapeJsStr(item.text) + "')\">" +
        prefix + escapeHtml(item.text) + rwText +
        "</button>";
    }).join("");
  });
}

function renderAdminTodoChips(kidName) {
  const combined = getCombinedAdminTodoList(kidName);
  const fixedSet = new Set(fixedRoutineList.map(r => r.text));
  const el = document.getElementById("adminTodoChips_" + kidName);
  if (!combined.length) {
    el.innerHTML = "<span style='font-size:11px; color:#94a3b8;'>선택되거나 입력된 할일이 없습니다.</span>";
    return;
  }
  if (!adminTodoRewards[kidName]) adminTodoRewards[kidName] = {};

  el.innerHTML = combined.map((item, idx) => {
    const isFixed = fixedSet.has(item) && (adminSelectedFixed[kidName] || []).includes(item);
    const badge = isFixed ? "⭐ " : "";
    const rw = Math.max(0, Number(adminTodoRewards[kidName][item]) || 0);
    return "<div class='todo-assigned-row" + (isFixed ? " is-fixed" : "") + "'>" +
      "<span class='todo-assigned-name'>" + (idx + 1) + ". " + badge + escapeHtml(item) + "</span>" +
      "<input type='number' min='0' step='100' class='todo-row-reward' value='" + rw + "' onchange=\"onRowRewardChange('" + kidName + "', '" + escapeJsStr(item) + "', this.value)\" />" +
      "<span style='font-size:11px; font-weight:800; color:#6d28d9;'>원</span>" +
      "<button type='button' class='todo-chip-del' onclick=\"removeCombinedTodoItem('" + kidName + "', '" + escapeJsStr(item) + "')\">✕</button>" +
      "</div>";
  }).join("");
}

function onRowRewardChange(kidName, item, val) {
  if (!adminTodoRewards[kidName]) adminTodoRewards[kidName] = {};
  adminTodoRewards[kidName][item] = Math.max(0, Number(val) || 0);
}

function onMealRewardChange() {
  const val = document.getElementById("mealRewardInput").value;
  adminMealReward = Math.max(0, Number(val) || 0);
}

function toggleFixedForKid(kidName, item) {
  if (!adminSelectedFixed[kidName]) adminSelectedFixed[kidName] = [];
  if (!adminTodoRewards[kidName]) adminTodoRewards[kidName] = {};
  const idx = adminSelectedFixed[kidName].indexOf(item);
  if (idx >= 0) {
    adminSelectedFixed[kidName].splice(idx, 1);
  } else {
    adminSelectedFixed[kidName].push(item);
    adminCustomTodos[kidName] = (adminCustomTodos[kidName] || []).filter(v => v !== item);
    if (typeof adminTodoRewards[kidName][item] === "undefined") {
      adminTodoRewards[kidName][item] = getFixedRewardByText(item);
    }
  }
  renderFixedPickersForAllKids();
  renderAdminTodoChips(kidName);
}

function selectAllFixedForKid(kidName) {
  if (!fixedRoutineList.length) {
    alert("먼저 위 노란 상자에서 고정 할일을 등록해 주세요.");
    return;
  }
  if (!adminTodoRewards[kidName]) adminTodoRewards[kidName] = {};
  adminSelectedFixed[kidName] = fixedRoutineList.map(r => r.text);
  const fixedSet = new Set(adminSelectedFixed[kidName]);
  adminCustomTodos[kidName] = (adminCustomTodos[kidName] || []).filter(v => !fixedSet.has(v));
  fixedRoutineList.forEach(r => {
    if (typeof adminTodoRewards[kidName][r.text] === "undefined") {
      adminTodoRewards[kidName][r.text] = Math.max(0, Number(r.reward) || 0);
    }
  });
  renderFixedPickersForAllKids();
  renderAdminTodoChips(kidName);
}

function addTodoItem(kidName) {
  const input = document.getElementById("adminTodoInput_" + kidName);
  const rewardInput = document.getElementById("adminTodoReward_" + kidName);
  if (!input) return;
  const parts = input.value.split(/\n|,/).map(s => s.trim()).filter(Boolean);
  if (!parts.length) return;
  const enteredReward = rewardInput ? Math.max(0, Number(rewardInput.value) || 0) : 0;

  if (!adminCustomTodos[kidName]) adminCustomTodos[kidName] = [];
  if (!adminSelectedFixed[kidName]) adminSelectedFixed[kidName] = [];
  if (!adminTodoRewards[kidName]) adminTodoRewards[kidName] = {};

  parts.forEach(p => {
    const fixedRw = getFixedRewardByText(p);
    const finalRw = rewardInput && rewardInput.value !== "" ? enteredReward : fixedRw;
    if (fixedRoutineList.some(r => r.text === p)) {
      if (!adminSelectedFixed[kidName].includes(p)) {
        adminSelectedFixed[kidName].push(p);
      }
    } else if (!adminCustomTodos[kidName].includes(p)) {
      adminCustomTodos[kidName].push(p);
    }
    adminTodoRewards[kidName][p] = Math.max(0, Number(finalRw) || 0);
  });

  input.value = "";
  if (rewardInput) rewardInput.value = "";
  renderFixedPickersForAllKids();
  renderAdminTodoChips(kidName);
}

function removeCombinedTodoItem(kidName, item) {
  adminSelectedFixed[kidName] = (adminSelectedFixed[kidName] || []).filter(v => v !== item);
  adminCustomTodos[kidName] = (adminCustomTodos[kidName] || []).filter(v => v !== item);
  renderFixedPickersForAllKids();
  renderAdminTodoChips(kidName);
}

async function addFixedRoutineItem() {
  const input = document.getElementById("fixedRoutineInput");
  const rewardInput = document.getElementById("fixedRoutineRewardInput");
  if (!input) return;
  const parts = input.value.split(/\n|,/).map(s => s.trim()).filter(Boolean);
  if (!parts.length) return;
  const rw = rewardInput ? Math.max(0, Number(rewardInput.value) || 0) : 0;

  parts.forEach(p => {
    const existing = fixedRoutineList.find(r => r.text === p);
    if (existing) {
      existing.reward = rw;
    } else {
      fixedRoutineList.push({ text: p, reward: rw });
    }
  });

  input.value = "";
  if (rewardInput) rewardInput.value = "";
  renderFixedMasterChips();
  renderFixedPickersForAllKids();
  if (window.fbSaveFixedRoutines) await window.fbSaveFixedRoutines();
}

async function removeFixedRoutineItem(idx) {
  const removedObj = fixedRoutineList[idx];
  if (!removedObj) return;
  const removedText = removedObj.text;
  fixedRoutineList.splice(idx, 1);

  KIDS.forEach(kidName => {
    if ((adminSelectedFixed[kidName] || []).includes(removedText)) {
      adminSelectedFixed[kidName] = adminSelectedFixed[kidName].filter(v => v !== removedText);
      if (!(adminCustomTodos[kidName] || []).includes(removedText)) {
        adminCustomTodos[kidName].unshift(removedText);
      }
    }
    renderAdminTodoChips(kidName);
  });
  renderFixedMasterChips();
  renderFixedPickersForAllKids();
  if (window.fbSaveFixedRoutines) await window.fbSaveFixedRoutines();
}

function updateSettleButtonUI(dateStr) {
  const btn = document.getElementById("settleToggleBtn");
  const hasPhoto = !!photoDatesMap[dateStr];
  const isSettled = !!settlementMap[dateStr];
  if (!hasPhoto) {
    btn.className = "settle-btn unsettled";
    btn.textContent = "💰 사진 없음";
    btn.disabled = true;
    btn.style.opacity = "0.5";
  } else {
    btn.disabled = false;
    btn.style.opacity = "1";
    if (isSettled) {
      btn.className = "settle-btn settled";
      btn.textContent = "✅ 정산완료 (클릭해 취소)";
    } else {
      btn.className = "settle-btn unsettled";
      btn.textContent = "💰 미정산 (정산하기)";
    }
  }
}

function renderPhotoCalendar() {
  const selectedDate = document.getElementById("adminDate").value;
  document.getElementById("calMonthTitle").textContent = calYear + "년 " + (calMonth + 1) + "월";
  const grid = document.getElementById("photoCalendarGrid");

  const firstDay = new Date(calYear, calMonth, 1).getDay();
  const lastDate = new Date(calYear, calMonth + 1, 0).getDate();

  let html = "";
  for (let i = 0; i < firstDay; i++) {
    html += "<div class='cal-cell empty'></div>";
  }

  for (let day = 1; day <= lastDate; day++) {
    const ds = calYear + "-" + pad2(calMonth + 1) + "-" + pad2(day);
    const hasPhoto = !!photoDatesMap[ds];
    const isSettled = !!settlementMap[ds];
    const isSelected = ds === selectedDate;

    if (!hasPhoto) {
      html += "<div class='cal-cell no-photo'></div>";
    } else {
      const tagClass = isSettled ? "settled" : "unsettled";
      const tagText = isSettled ? "정산완료" : "미정산";
      const selClass = isSelected ? " selected" : "";
      html += "<div class='cal-cell has-photo" + selClass + "' onclick=\"pickCalendarDate('" + ds + "')\">" +
        "<span>" + day + "일</span>" +
        "<span class='cal-tag " + tagClass + "'>" + tagText + "</span>" +
        "</div>";
    }
  }

  grid.innerHTML = html;
  updateSettleButtonUI(selectedDate);
}

function moveCalendarMonth(delta) {
  calMonth += delta;
  if (calMonth < 0) {
    calMonth = 11;
    calYear -= 1;
  } else if (calMonth > 11) {
    calMonth = 0;
    calYear += 1;
  }
  renderPhotoCalendar();
}

function pickCalendarDate(dateStr) {
  document.getElementById("adminDate").value = dateStr;
  updateSettleButtonUI(dateStr);
  renderPhotoCalendar();
  loadAdminDate(dateStr);
}

function onDateInputChange(dateStr) {
  if (!dateStr) return;
  calYear = parseInt(dateStr.slice(0, 4), 10);
  calMonth = parseInt(dateStr.slice(5, 7), 10) - 1;
  updateSettleButtonUI(dateStr);
  renderPhotoCalendar();
  loadAdminDate(dateStr);
}

function checkPw() {
  if (document.getElementById("pwInput").value === "1234") {
    adminOpen = true;
    document.getElementById("lockCard").style.display = "none";
    document.getElementById("dashCard").style.display = "block";
    if (window.fbLoadAdmin) window.fbLoadAdmin();
  } else {
    alert("비밀번호가 틀렸습니다.");
  }
}

function loadAdminDate(d) {
  if (window.fbLoadAdminDate) window.fbLoadAdminDate(d);
}

function saveDailyTodos() {
  if (window.fbSaveDailyTodos) window.fbSaveDailyTodos();
}

function toggleSettlement() {
  if (window.fbToggleSettlement) window.fbToggleSettlement();
}

function deleteSelectedDate() {
  if (window.fbDeleteDate) window.fbDeleteDate();
}
