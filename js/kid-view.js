let mealData = null;
let initialMealPhotoSaved = null;
let todoPhotosByIdx = [];
let initialTodoPhotosSaved = [];
let todoSavedFlags = [];
let currentKidTodoItems = [];
let currentKidTodoRewards = [];
let currentMealReward = 0;

function getSelectedKidDate() {
  return document.getElementById("kidDateInput").value || TODAY;
}

function updateKidMealRewardBadge() {
  const el = document.getElementById("kidMealRewardBadge");
  if (el) el.textContent = "+" + formatWon(currentMealReward);
}

function updateTodoOverallState() {
  const total = currentKidTodoItems.length;
  const doneCount = todoPhotosByIdx.filter(Boolean).length;
  const el = document.getElementById("todoOverallState");
  if (!total) {
    el.textContent = todoPhotosByIdx[0] ? "등록됨" : "미등록";
    el.style.color = todoPhotosByIdx[0] ? "#15803d" : "#94a3b8";
    return;
  }
  el.textContent = doneCount + " / " + total + " 완료";
  el.style.color = doneCount === total ? "#15803d" : "#7c3aed";
}

function refreshTodoSlotUI(idx) {
  const img = document.getElementById("todoImg_" + idx);
  const hint = document.getElementById("todoHint_" + idx);
  const st = document.getElementById("todoItemState_" + idx);
  const b64 = todoPhotosByIdx[idx];
  if (!img || !hint || !st) return;

  if (b64) {
    img.src = b64;
    img.style.display = "block";
    hint.style.display = "none";
    st.textContent = todoSavedFlags[idx] ? "저장됨" : "준비됨";
    st.style.color = "#15803d";
  } else {
    img.src = "";
    img.style.display = "none";
    hint.style.display = "block";
    st.textContent = "미등록";
    st.style.color = "#94a3b8";
  }
  updateTodoOverallState();
}

function renderKidTodoSlots(items, rewards, existingTodoPhotos, legacyTodoPhoto) {
  currentKidTodoItems = normalizeTodoItems(items);
  const slotCount = currentKidTodoItems.length > 0 ? currentKidTodoItems.length : 1;

  currentKidTodoRewards = [];
  todoPhotosByIdx = [];
  initialTodoPhotosSaved = [];
  todoSavedFlags = [];

  for (let i = 0; i < slotCount; i++) {
    const rw = Array.isArray(rewards) ? Math.max(0, Number(rewards[i]) || 0) : 0;
    currentKidTodoRewards.push(rw);

    let photo = null;
    if (Array.isArray(existingTodoPhotos) && existingTodoPhotos[i]) {
      photo = existingTodoPhotos[i];
    } else if (i === 0 && legacyTodoPhoto) {
      photo = legacyTodoPhoto;
    }
    todoPhotosByIdx.push(photo);
    initialTodoPhotosSaved.push(photo || null);
    todoSavedFlags.push(!!photo);
  }

  const container = document.getElementById("kidTodoSlotsContainer");
  let html = "";

  for (let i = 0; i < slotCount; i++) {
    const taskLabel = currentKidTodoItems[i]
      ? ("할일 " + (i + 1) + ": " + escapeHtml(currentKidTodoItems[i]))
      : "오늘의 할일 인증 (지정된 할일 없음)";
    const rwBadge = "<span class='reward-pill'>+" + formatWon(currentKidTodoRewards[i] || 0) + "</span>";

    html += "<div class='todo-sub-card'>" +
      "<div class='todo-sub-header'>" +
      "<span class='todo-sub-title'>" + taskLabel + " " + rwBadge + "</span>" +
      "<span id='todoItemState_" + i + "' style='font-size:11px; font-weight:800; color:#94a3b8; white-space:nowrap;'>미등록</span>" +
      "</div>" +
      "<div class='mission-grid'>" +
      "<label for='todoFile_" + i + "' class='cam-btn cam-todo'>" +
      "<span style='font-size:22px;'>📷</span>" +
      "<span>할일 " + (i + 1) + " 사진</span>" +
      "</label>" +
      "<input id='todoFile_" + i + "' type='file' accept='image/*' capture='environment' style='display:none;' onchange=\"onPickTodoPhoto(event, " + i + ")\" />" +
      "<div class='preview-box' onclick=\"openBigTodoPhoto(" + i + ")\">" +
      "<img id='todoImg_" + i + "' alt='할일 사진 " + (i + 1) + "' />" +
      "<span id='todoHint_" + i + "' style='font-size:12px; color:#94a3b8; text-align:center;'>버튼을 눌러<br>사진을 찍어주세요</span>" +
      "</div>" +
      "</div>" +
      "</div>";
  }

  container.innerHTML = html;

  for (let i = 0; i < slotCount; i++) {
    refreshTodoSlotUI(i);
  }
}

function setMealPreview(b64, text) {
  const img = document.getElementById("mealImg");
  const hint = document.getElementById("mealHint");
  const st = document.getElementById("mealState");

  if (b64) {
    img.src = b64;
    img.style.display = "block";
    hint.style.display = "none";
    st.textContent = text || "저장됨";
    st.style.color = "#15803d";
  } else {
    img.src = "";
    img.style.display = "none";
    hint.style.display = "block";
    st.textContent = "미등록";
    st.style.color = "#94a3b8";
  }
}

function onPickMealPhoto(ev) {
  if (isSavingLock) return;
  const file = ev.target.files[0];
  if (!file) return;
  compress(file, function(b64) {
    mealData = b64;
    setMealPreview(b64, "준비됨");
    ev.target.value = "";
  });
}

function onPickTodoPhoto(ev, idx) {
  if (isSavingLock) return;
  const file = ev.target.files[0];
  if (!file) return;
  compress(file, function(b64) {
    todoPhotosByIdx[idx] = b64;
    todoSavedFlags[idx] = false;
    refreshTodoSlotUI(idx);
    ev.target.value = "";
  });
}

function openBigPhoto(type) {
  if (isSavingLock) return;
  if (type !== "meal") return;
  if (!mealData) return;
  const name = document.getElementById("childSelect").value;
  const dt = getSelectedKidDate();
  document.getElementById("popTitle").textContent = dt + " " + name + " - 밥 사진";
  document.getElementById("popBody").innerHTML = "<img src='" + mealData + "' style='max-width:100%; max-height:70vh; object-fit:contain;' />";
  document.getElementById("popModal").style.display = "flex";
}

function openBigTodoPhoto(idx) {
  if (isSavingLock) return;
  const src = todoPhotosByIdx[idx];
  if (!src) return;
  const name = document.getElementById("childSelect").value;
  const dt = getSelectedKidDate();
  const titleText = currentKidTodoItems[idx]
    ? ("할일 " + (idx + 1) + ": " + currentKidTodoItems[idx])
    : ("할일 " + (idx + 1) + " 사진");
  document.getElementById("popTitle").textContent = dt + " " + name + " - " + titleText;
  document.getElementById("popBody").innerHTML = "<img src='" + src + "' style='max-width:100%; max-height:70vh; object-fit:contain;' />";
  document.getElementById("popModal").style.display = "flex";
}

function onKidContextChange() {
  if (isSavingLock) return;
  mealData = null;
  initialMealPhotoSaved = null;
  setMealPreview(null);
  renderKidTodoSlots([], [], [], null);
  if (window.fbLoadKidData) window.fbLoadKidData();
}

async function savePhotos() {
  if (isSavingLock) return;
  const hasAnyTodoPhoto = todoPhotosByIdx.some(Boolean);
  if (!mealData && !hasAnyTodoPhoto) {
    return alert("밥 사진 또는 오늘의 할일 사진 중 최소 한 장을 찍어주세요!");
  }
  if (!window.fbSave) return alert("Firebase 연결을 확인해주세요.");

  const kidName = document.getElementById("childSelect").value;
  const ok = await verifyFaceIdPasskey(kidName);
  if (!ok) return;

  showCuteLoading(kidName);
  try {
    await window.fbSave();
  } finally {
    hideCuteLoading();
  }
}
