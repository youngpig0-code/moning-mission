const KIDS = ["홍리안", "홍지운"];
const MAX_DOC_BYTES = 900 * 1024;
const TARGET_PHOTO_BYTES = 78 * 1024;

let adminOpen = false;
let isSavingLock = false;

function getToday() {
  const d = new Date();
  const off = d.getTimezoneOffset() * 60000;
  return new Date(d - off).toISOString().slice(0, 10);
}

const TODAY = getToday();

function pad2(n) {
  return n < 10 ? "0" + n : "" + n;
}

function formatWon(num) {
  const n = Math.max(0, Number(num) || 0);
  return n.toLocaleString("ko-KR") + "원";
}

function estimateUtf8Bytes(str) {
  if (!str) return 0;
  return new TextEncoder().encode(String(str)).length;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeJsStr(str) {
  return String(str)
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "\\'");
}

function normalizeTodoItems(raw) {
  if (Array.isArray(raw)) {
    return raw.map(v => {
      if (typeof v === "string") return v.trim();
      if (v && typeof v === "object" && v.text) return String(v.text).trim();
      return "";
    }).filter(Boolean);
  }
  if (typeof raw === "string" && raw.trim()) {
    return raw.split(/\n|,/).map(v => v.trim()).filter(Boolean);
  }
  return [];
}

function normalizeFixedRoutines(raw) {
  if (!Array.isArray(raw)) return [];
  const result = [];
  raw.forEach(item => {
    if (typeof item === "string") {
      const t = item.trim();
      if (t && !result.some(r => r.text === t)) result.push({ text: t, reward: 0 });
    } else if (item && typeof item === "object") {
      const t = String(item.text || "").trim();
      const rw = Math.max(0, Number(item.reward) || 0);
      if (t && !result.some(r => r.text === t)) result.push({ text: t, reward: rw });
    }
  });
  return result;
}

function showCuteLoading(kidName) {
  isSavingLock = true;
  document.getElementById("cuteLoadingTitle").textContent = (kidName ? kidName + "의 " : "") + "사진을 쏙쏙 올리는 중!";
  document.getElementById("cuteLoadingSub").textContent = "참 잘했어요! 조금만 기다려 주세요~";
  document.getElementById("cuteLoadingModal").style.display = "flex";
}

function hideCuteLoading() {
  isSavingLock = false;
  document.getElementById("cuteLoadingModal").style.display = "none";
}

function openRewardModal(earnedAmount, breakdownItems, kidName) {
  document.getElementById("rewardEarnedMain").textContent = "용돈 " + formatWon(earnedAmount) + " 획득!";
  document.getElementById("rewardEarnedSub").textContent = kidName + "의 새 미션 인증 완료!";
  const listEl = document.getElementById("rewardEarnedList");
  if (breakdownItems && breakdownItems.length > 0) {
    listEl.style.display = "block";
    listEl.innerHTML = breakdownItems.map(b =>
      "• " + escapeHtml(b.label) + ": +" + formatWon(b.amount)
    ).join("<br>");
  } else {
    listEl.style.display = "none";
    listEl.innerHTML = "";
  }
  document.getElementById("rewardEarnedModal").style.display = "flex";
}

function closeRewardModal() {
  document.getElementById("rewardEarnedModal").style.display = "none";
}

function showQr() {
  if (isSavingLock) return;
  const url = window.location.href;
  const qrApi = "https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=" + encodeURIComponent(url);
  document.getElementById("popTitle").textContent = "📱 아이들 폰 연결 QR코드";
  document.getElementById("popBody").innerHTML =
    "<p style='font-size:12px; color:#64748b;'>카메라로 비추면 바로 열립니다.</p>" +
    "<img src='" + qrApi + "' alt='QR' style='width:200px; height:200px; margin:8px auto; display:block;' />" +
    "<div style='font-size:11px; color:#64748b; word-break:break-all;'>" + url + "</div>";
  document.getElementById("popModal").style.display = "flex";
}

function closePop() {
  document.getElementById("popModal").style.display = "none";
}

function compress(file, cb) {
  const reader = new FileReader();
  reader.onload = function(e) {
    const img = new Image();
    img.onload = function() {
      const tiers = [
        { maxW: 720, quality: 0.68 },
        { maxW: 640, quality: 0.58 },
        { maxW: 540, quality: 0.50 },
        { maxW: 450, quality: 0.44 }
      ];
      let chosen = "";
      for (let t = 0; t < tiers.length; t++) {
        const { maxW, quality } = tiers[t];
        let w = img.width, h = img.height;
        if (w > maxW) {
          h = Math.round(h * maxW / w);
          w = maxW;
        }
        const c = document.createElement("canvas");
        c.width = w;
        c.height = h;
        c.getContext("2d").drawImage(img, 0, 0, w, h);
        chosen = c.toDataURL("image/jpeg", quality);
        if (estimateUtf8Bytes(chosen) <= TARGET_PHOTO_BYTES) break;
      }
      cb(chosen);
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

async function verifyFaceIdPasskey(kidName) {
  if (!window.PublicKeyCredential || !navigator.credentials) {
    return confirm("이 브라우저에서는 Face ID 팝업을 직접 띄울 수 없습니다. " + kidName + "의 사진을 저장할까요?");
  }

  const credIdKey = "morning_passkey_cred_id_" + kidName;
  const savedCredIdB64 = localStorage.getItem(credIdKey);
  const challenge = new Uint8Array(32);
  window.crypto.getRandomValues(challenge);

  const rpId = window.location.hostname || "localhost";

  try {
    if (!savedCredIdB64) {
      const createRes = await navigator.credentials.create({
        publicKey: {
          challenge: challenge,
          rp: { name: "오늘의 아침 미션", id: rpId },
          user: {
            id: new TextEncoder().encode("kid_" + kidName),
            name: kidName + "@morning-mission.local",
            displayName: kidName
          },
          pubKeyCredParams: [{ alg: -7, type: "public-key" }, { alg: -257, type: "public-key" }],
          authenticatorSelection: {
            authenticatorAttachment: "platform",
            userVerification: "required"
          },
          timeout: 60000
        }
      });
      if (createRes && createRes.rawId) {
        const bytes = new Uint8Array(createRes.rawId);
        let bin = "";
        for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
        localStorage.setItem(credIdKey, btoa(bin));
      }
      return true;
    } else {
      const bin = atob(savedCredIdB64);
      const rawId = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) rawId[i] = bin.charCodeAt(i);

      const authRes = await navigator.credentials.get({
        publicKey: {
          challenge: challenge,
          rpId: rpId,
          allowCredentials: [{ id: rawId, type: "public-key" }],
          userVerification: "required",
          timeout: 60000
        }
      });
      return !!authRes;
    }
  } catch (err) {
    if (err && err.name === "NotAllowedError") {
      alert("Face ID 인증이 취소되었거나 실패했습니다. 다시 시도해주세요.");
      return false;
    }
    return confirm("Face ID 인증 팝업이 표시되지 않았습니다(" + (err && err.name ? err.name : "오류") + "). 그래도 사진을 저장할까요?");
  }
}

function showTab(tab) {
  if (isSavingLock) return;
  const isKid = tab === "kid";
  document.getElementById("kidSection").style.display = isKid ? "block" : "none";
  document.getElementById("adminSection").style.display = isKid ? "none" : "block";
  document.getElementById("btnKid").classList.toggle("active", isKid);
  document.getElementById("btnAdmin").classList.toggle("active", !isKid);
  if (isKid && window.fbLoadKidData) window.fbLoadKidData();
  if (!isKid && adminOpen && window.fbLoadAdmin) window.fbLoadAdmin();
  window.scrollTo(0, 0);
}

document.getElementById("kidDateInput").value = TODAY;
document.getElementById("adminDate").value = TODAY;
document.getElementById("statusMsg").textContent = "👋 " + TODAY + " 미션 사진을 찍어 올려주세요!";
