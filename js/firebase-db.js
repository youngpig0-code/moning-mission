import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore, doc, getDoc, setDoc, deleteDoc, collection, getDocs } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBA_SgB4qFaT5X_aUxpyHjqG5VIYD2KgQw",
  authDomain: "morning-mission-2c6ea.firebaseapp.com",
  projectId: "morning-mission-2c6ea",
  storageBucket: "morning-mission-2c6ea.firebasestorage.app",
  messagingSenderId: "338264773151",
  appId: "1:338264773151:web:f590cd987772de5ff1bb2a",
  measurementId: "G-5RFF32328E"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function fetchFixedRoutinesDoc() {
  const snap = await getDoc(doc(db, "daily_todos", "fixed_routines"));
  if (!snap.exists()) return { routines: [], mealReward: 0 };
  const data = snap.data();
  return {
    routines: normalizeFixedRoutines(data.items),
    mealReward: Math.max(0, Number(data.mealReward) || 0)
  };
}

window.fbSaveFixedRoutines = async function() {
  onMealRewardChange();
  await setDoc(doc(db, "daily_todos", "fixed_routines"), {
    items: normalizeFixedRoutines(fixedRoutineList),
    mealReward: adminMealReward,
    updatedAt: new Date().toISOString()
  }, { merge: true });
  const st = document.getElementById("fixedRoutineStatus");
  if (st) st.textContent = "고정·용돈 설정 저장됨";
};

async function fetchTodoForDate(dateStr) {
  const snap = await getDoc(doc(db, "daily_todos", dateStr));
  if (!snap.exists()) {
    return { 홍리안: [], 홍지운: [], rewards: { 홍리안: [], 홍지운: [] }, mealReward: null };
  }
  const data = snap.data();
  const rewardsRaw = data.rewards || {};
  return {
    홍리안: normalizeTodoItems(data["홍리안"]),
    홍지운: normalizeTodoItems(data["홍지운"]),
    rewards: {
      홍리안: Array.isArray(rewardsRaw["홍리안"]) ? rewardsRaw["홍리안"].map(n => Math.max(0, Number(n) || 0)) : [],
      홍지운: Array.isArray(rewardsRaw["홍지운"]) ? rewardsRaw["홍지운"].map(n => Math.max(0, Number(n) || 0)) : []
    },
    mealReward: typeof data.mealReward !== "undefined" && data.mealReward !== null ? Math.max(0, Number(data.mealReward) || 0) : null
  };
}

window.fbLoadKidData = async function() {
  const name = document.getElementById("childSelect").value;
  const targetDate = getSelectedKidDate();
  try {
    const fixedDoc = await fetchFixedRoutinesDoc();
    const todoDoc = await fetchTodoForDate(targetDate);

    currentMealReward = todoDoc.mealReward !== null ? todoDoc.mealReward : fixedDoc.mealReward;
    updateKidMealRewardBadge();

    const assignedItems = todoDoc[name] || [];
    const assignedRewards = todoDoc.rewards[name] || [];

    const snap = await getDoc(doc(db, "morning_missions", targetDate + "_" + name));
    const d = snap.exists() ? snap.data() : null;

    const effectiveItems = assignedItems.length
      ? assignedItems
      : normalizeTodoItems(d && d.todoItems);

    const effectiveRewards = assignedItems.length
      ? assignedRewards
      : (Array.isArray(d && d.todoRewards) ? d.todoRewards : []);

    const existingTodoPhotos = Array.isArray(d && d.todoPhotos) ? d.todoPhotos : [];
    const legacyTodoPhoto = (d && d.todoPhoto) || null;

    renderKidTodoSlots(effectiveItems, effectiveRewards, existingTodoPhotos, legacyTodoPhoto);

    if (d && d.mealPhoto) {
      mealData = d.mealPhoto;
      initialMealPhotoSaved = d.mealPhoto;
      setMealPreview(d.mealPhoto, "저장됨");
    } else {
      mealData = null;
      initialMealPhotoSaved = null;
      setMealPreview(null);
    }

    if (d && (d.mealPhoto || legacyTodoPhoto || existingTodoPhotos.some(Boolean))) {
      document.getElementById("statusMsg").textContent = "✨ " + targetDate + " 저장된 사진이 있어요! 사진을 누르면 크게 보여요.";
    } else {
      document.getElementById("statusMsg").textContent = "👋 안녕 " + name + "! " + targetDate + " 미션 사진을 찍어 올려주세요!";
    }
  } catch (e) {
    console.error(e);
  }
};

window.fbSave = async function() {
  const name = document.getElementById("childSelect").value;
  const targetDate = getSelectedKidDate();
  try {
    const cleanTodoPhotos = todoPhotosByIdx.map(p => p || null);

    let earnedTotal = 0;
    const earnedBreakdown = [];

    if (mealData && mealData !== initialMealPhotoSaved) {
      earnedTotal += currentMealReward;
      earnedBreakdown.push({ label: "아침밥 완료", amount: currentMealReward });
    }

    for (let i = 0; i < cleanTodoPhotos.length; i++) {
      const curPhoto = cleanTodoPhotos[i];
      const prevPhoto = initialTodoPhotosSaved[i] || null;
      if (curPhoto && curPhoto !== prevPhoto) {
        const rw = Math.max(0, Number(currentKidTodoRewards[i]) || 0);
        const taskName = currentKidTodoItems[i]
          ? ("할일 " + (i + 1) + ": " + currentKidTodoItems[i])
          : ("할일 " + (i + 1));
        earnedTotal += rw;
        earnedBreakdown.push({ label: taskName, amount: rw });
      }
    }

    const payload = {
      date: targetDate,
      childName: name,
      mealPhoto: mealData || null,
      mealReward: currentMealReward,
      studyPhoto: null,
      todoPhotos: cleanTodoPhotos,
      todoPhoto: cleanTodoPhotos[0] || null,
      todoItems: currentKidTodoItems,
      todoRewards: currentKidTodoRewards,
      updatedAt: new Date().toISOString()
    };

    const totalBytes = estimateUtf8Bytes(JSON.stringify(payload));
    if (totalBytes > MAX_DOC_BYTES) {
      hideCuteLoading();
      alert("한 번에 저장할 수 있는 최대 용량(1MB)을 넘었습니다. 사진 수를 조금 줄여 저장해 주세요!");
      return;
    }

    await setDoc(doc(db, "morning_missions", targetDate + "_" + name), payload, { merge: true });

    const settleRef = doc(db, "allowance_settlements", targetDate);
    const settleSnap = await getDoc(settleRef);
    if (!settleSnap.exists()) {
      await setDoc(settleRef, { date: targetDate, settled: false });
    }

    initialMealPhotoSaved = mealData || null;
    initialTodoPhotosSaved = [...cleanTodoPhotos];
    if (mealData) setMealPreview(mealData, "저장됨");
    todoSavedFlags = cleanTodoPhotos.map(p => !!p);
    for (let i = 0; i < todoPhotosByIdx.length; i++) {
      refreshTodoSlotUI(i);
    }

    hideCuteLoading();
    openRewardModal(earnedTotal, earnedBreakdown, name);
  } catch (e) {
    hideCuteLoading();
    alert("저장 오류: " + e.message);
  }
};

window.fbSaveDailyTodos = async function() {
  const dateStr = document.getElementById("adminDate").value;
  if (!dateStr) return;

  addTodoItem("홍리안");
  addTodoItem("홍지운");
  onMealRewardChange();

  const rianItems = getCombinedAdminTodoList("홍리안");
  const jiwoonItems = getCombinedAdminTodoList("홍지운");

  const rianRewards = rianItems.map(item => Math.max(0, Number((adminTodoRewards["홍리안"] || {})[item]) || 0));
  const jiwoonRewards = jiwoonItems.map(item => Math.max(0, Number((adminTodoRewards["홍지운"] || {})[item]) || 0));

  await setDoc(doc(db, "daily_todos", dateStr), {
    date: dateStr,
    mealReward: adminMealReward,
    "홍리안": rianItems,
    "홍지운": jiwoonItems,
    rewards: {
      "홍리안": rianRewards,
      "홍지운": jiwoonRewards
    },
    updatedAt: new Date().toISOString()
  }, { merge: true });

  await window.fbSaveFixedRoutines();

  document.getElementById("todoSaveStatus").textContent = "✅ " + dateStr + " 할일·용돈이 저장되었습니다.";
  await window.fbLoadAdminDate(dateStr);
  if (dateStr === getSelectedKidDate() && window.fbLoadKidData) {
    await window.fbLoadKidData();
  }
};

async function refreshCalendarMaps() {
  photoDatesMap = {};
  settlementMap = {};

  const qs = await getDocs(collection(db, "morning_missions"));
  qs.forEach(s => {
    const data = s.data();
    const hasAnyTodo = Array.isArray(data.todoPhotos) && data.todoPhotos.some(Boolean);
    if (data.date && (data.mealPhoto || data.todoPhoto || data.studyPhoto || hasAnyTodo)) {
      photoDatesMap[data.date] = true;
    }
  });

  const sqs = await getDocs(collection(db, "allowance_settlements"));
  sqs.forEach(s => {
    const data = s.data();
    if (data.date) {
      settlementMap[data.date] = !!data.settled;
    }
  });

  Object.keys(photoDatesMap).forEach(dt => {
    if (typeof settlementMap[dt] === "undefined") {
      settlementMap[dt] = false;
    }
  });
}

window.fbLoadAdmin = async function() {
  const fixedDoc = await fetchFixedRoutinesDoc();
  fixedRoutineList = fixedDoc.routines;
  adminMealReward = fixedDoc.mealReward;
  document.getElementById("mealRewardInput").value = adminMealReward;
  renderFixedMasterChips();

  await refreshCalendarMaps();
  const d = document.getElementById("adminDate").value || TODAY;
  calYear = parseInt(d.slice(0, 4), 10);
  calMonth = parseInt(d.slice(5, 7), 10) - 1;
  renderPhotoCalendar();
  await window.fbLoadAdminDate(d);
};

window.fbToggleSettlement = async function() {
  const dateStr = document.getElementById("adminDate").value;
  if (!dateStr || !photoDatesMap[dateStr]) return;
  const nextVal = !settlementMap[dateStr];
  await setDoc(doc(db, "allowance_settlements", dateStr), {
    date: dateStr,
    settled: nextVal,
    updatedAt: new Date().toISOString()
  }, { merge: true });
  settlementMap[dateStr] = nextVal;
  renderPhotoCalendar();
  alert(dateStr + (nextVal ? " 정산완료 처리되었습니다!" : " 미정산 상태로 변경되었습니다."));
};

window.fbLoadAdminDate = async function(dateStr) {
  if (!dateStr) return;
  updateSettleButtonUI(dateStr);

  const fixedDoc = await fetchFixedRoutinesDoc();
  if (!fixedRoutineList.length && fixedDoc.routines.length) {
    fixedRoutineList = fixedDoc.routines;
    renderFixedMasterChips();
  }

  const todoDoc = await fetchTodoForDate(dateStr);
  adminMealReward = todoDoc.mealReward !== null ? todoDoc.mealReward : fixedDoc.mealReward;
  document.getElementById("mealRewardInput").value = adminMealReward;

  const fixedSet = new Set(fixedRoutineList.map(r => r.text));

  KIDS.forEach(kidName => {
    const savedList = todoDoc[kidName] || [];
    const savedRewards = todoDoc.rewards[kidName] || [];
    adminSelectedFixed[kidName] = savedList.filter(item => fixedSet.has(item));
    adminCustomTodos[kidName] = savedList.filter(item => !fixedSet.has(item));
    const rwMap = {};
    savedList.forEach((item, idx) => {
      if (typeof savedRewards[idx] !== "undefined") {
        rwMap[item] = Math.max(0, Number(savedRewards[idx]) || 0);
      } else {
        rwMap[item] = getFixedRewardByText(item);
      }
    });
    adminTodoRewards[kidName] = rwMap;
  });

  renderFixedPickersForAllKids();
  renderAdminTodoChips("홍리안");
  renderAdminTodoChips("홍지운");

  const hasAnySaved = (todoDoc["홍리안"] || []).length || (todoDoc["홍지운"] || []).length;
  document.getElementById("todoSaveStatus").textContent = hasAnySaved
    ? "현재 저장된 할일·용돈이 불러와졌습니다."
    : "① 고정 할일을 선택하고 ② 추가 할일과 용돈을 입력해 주세요.";

  let html = "";
  for (const name of KIDS) {
    const snap = await getDoc(doc(db, "morning_missions", dateStr + "_" + name));
    const d = snap.exists() ? snap.data() : null;
    const assignedItems = (todoDoc[name] && todoDoc[name].length)
      ? todoDoc[name]
      : normalizeTodoItems(d && d.todoItems);
    const assignedRewards = (todoDoc[name] && todoDoc[name].length)
      ? todoDoc.rewards[name]
      : (Array.isArray(d && d.todoRewards) ? d.todoRewards : []);

    const savedTodoPhotos = Array.isArray(d && d.todoPhotos) ? d.todoPhotos : [];
    const legacyPhoto = (d && d.todoPhoto) || null;
    const photoCount = Math.max(
      assignedItems.length,
      savedTodoPhotos.length,
      legacyPhoto ? 1 : 0
    );

    html += "<div class='box'><div style='display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;'>";
    html += "<strong style='background:#fbbf24; padding:3px 9px; border-radius:8px;'>" + name + "</strong>";
    if (d) html += "<button type='button' class='del-btn' onclick=\"fbDelOne('" + dateStr + "','" + name + "')\">삭제</button>";
    html += "</div>";

    html += "<div style='margin-bottom:12px;'>";
    html += "<div style='font-size:12px; font-weight:800; color:#ea580c; margin-bottom:4px;'>🍚 1. 밥 사진 (" + formatWon(adminMealReward) + ")</div>";
    if (d && d.mealPhoto) {
      html += "<img src='" + d.mealPhoto + "' onclick=\"openAdminImg('" + dateStr + " " + name + " 밥 사진','" + d.mealPhoto + "')\" style='width:100%; max-width:220px; height:115px; object-fit:cover; border-radius:10px; cursor:pointer;' />";
    } else {
      html += "<div style='height:90px; background:#f8fafc; border-radius:10px; display:flex; align-items:center; justify-content:center; font-size:12px; color:#94a3b8;'>밥 사진 없음</div>";
    }
    html += "</div>";

    html += "<div>";
    html += "<div style='font-size:12px; font-weight:800; color:#6d28d9; margin-bottom:4px;'>📌 2. 오늘의 할일별 사진</div>";

    if (photoCount === 0) {
      html += "<div style='height:80px; background:#f8fafc; border-radius:10px; display:flex; align-items:center; justify-content:center; font-size:12px; color:#94a3b8;'>할일 및 사진 없음</div>";
    } else {
      html += "<div class='admin-todo-photo-grid'>";
      for (let i = 0; i < photoCount; i++) {
        const rw = Math.max(0, Number(assignedRewards[i]) || 0);
        const taskName = assignedItems[i]
          ? ("할일 " + (i + 1) + ": " + assignedItems[i] + " (" + formatWon(rw) + ")")
          : ("할일 " + (i + 1) + " (" + formatWon(rw) + ")");
        const pSrc = savedTodoPhotos[i] || (i === 0 ? legacyPhoto : null);
        const safeTitle = escapeHtml(dateStr + " " + name + " - " + taskName);

        html += "<div class='admin-todo-photo-card'>";
        html += "<div class='admin-todo-photo-label'>" + escapeHtml(taskName) + "</div>";
        if (pSrc) {
          html += "<img src='" + pSrc + "' onclick=\"openAdminImg('" + safeTitle + "','" + pSrc + "')\" style='width:100%; height:96px; object-fit:cover; border-radius:8px; cursor:pointer;' />";
        } else {
          html += "<div style='height:96px; background:#ffffff; border:1px dashed #ddd6fe; border-radius:8px; display:flex; align-items:center; justify-content:center; font-size:11px; color:#94a3b8;'>미등록</div>";
        }
        html += "</div>";
      }
      html += "</div>";
    }

    html += "</div></div>";
  }
  document.getElementById("adminList").innerHTML = html;
};

window.openAdminImg = function(title, src) {
  document.getElementById("popTitle").textContent = title;
  document.getElementById("popBody").innerHTML = "<img src='" + src + "' style='max-width:100%; max-height:70vh; object-fit:contain;' />";
  document.getElementById("popModal").style.display = "flex";
};

window.fbDelOne = async function(dateStr, name) {
  if (!confirm(dateStr + " " + name + " 사진을 삭제할까요?")) return;
  await deleteDoc(doc(db, "morning_missions", dateStr + "_" + name));
  await window.fbLoadAdmin();
};

window.fbDeleteDate = async function() {
  const dateStr = document.getElementById("adminDate").value;
  if (!dateStr || !confirm(dateStr + " 날짜 사진을 모두 삭제할까요?")) return;
  for (const name of KIDS) await deleteDoc(doc(db, "morning_missions", dateStr + "_" + name));
  await deleteDoc(doc(db, "allowance_settlements", dateStr));
  alert("삭제되었습니다.");
  await window.fbLoadAdmin();
};

window.fbLoadKidData();
