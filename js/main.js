import {
  state,
  canvas,
  render,
  updateCanvasSize,
  setStatus
} from "./state.js";

import { handleFile } from "./file-validation.js";

import {
  createTemplate,
  openTemplateModal,
  closeTemplateModal,
  exportToJson,
  importFromJson
} from "./template.js";

import {
  getCustomStickers,
  addCustomSticker,
  addCustomFont,
  restoreCustomFonts,
  createSpeechBubbleSticker
} from "./assets-library.js";

import { BUILTIN_STICKERS } from "./sticker-assets.js";

// ======================================
// 1. 기본 설정
// ======================================
const $ = id => document.getElementById(id);

let activeTool = "text";
let drag = null;
let selectedStickerData = null; // 선택한 스티커 정보 (emoji, image, speech 등)

// 실행 취소 기록
const history = [];
const HISTORY_LIMIT = 30;

// ======================================
// 2. 편집 기록 저장
// ======================================
function snapshot() {
  return {
    texts: structuredClone(state.texts),
    drawings: structuredClone(state.drawings),
    stickers: structuredClone(state.stickers),
    imageX: state.imageX,
    imageY: state.imageY,
    imageScale: state.imageScale,
    background: state.background,
    frameType: state.frameType || "none"
  };
}

function remember() {
  history.push(snapshot());
  if (history.length > HISTORY_LIMIT) history.shift();
}

// ======================================
// 3. 실행 취소
// ======================================
function undo() {
  const previous = history.pop();
  if (!previous) {
    setStatus("되돌릴 작업이 없습니다.");
    return;
  }

  Object.assign(state, previous);
  state.selectedTextId = null;
  state.selectedStickerId = null;

  $("imageScale").value = String(Math.round(state.imageScale * 100));
  $("bgColor").value = state.background;
  $("frameType").value = state.frameType || "none";

  render();
  setStatus("이전 편집 상태로 되돌렸습니다.");
}

// ======================================
// 4. 캔버스 좌표 계산
// ======================================
function getCoords(event) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (event.clientX - rect.left) / rect.width * 100,
    y: (event.clientY - rect.top) / rect.height * 100
  };
}

// ======================================
// 5. 문구 추가
// ======================================
function addText(value, x = 50, y = 50) {
  const text = String(value).trim();
  if (!text) {
    setStatus("문구를 입력해 주세요.", true);
    return;
  }

  remember();

  const item = {
    id: crypto.randomUUID(),
    text: text.slice(0, 300),
    x, y,
    fontSize: Number($("fontSize").value),
    fontFamily: $("fontFamily").value,
    color: $("colorInput").value,
    bold: $("fontBold").checked // 🟢 볼드 기능 추가
  };

  state.texts.push(item);
  state.selectedTextId = item.id;
  render();
  setStatus("문구를 추가했습니다.");
}

// ======================================
// 6. 문구 선택 및 동기화
// ======================================
function selectedText() {
  return state.texts.find(text => text.id === state.selectedTextId) || null;
}

function pickText(x, y) {
  return [...state.texts].reverse().find(text => {
    const width = Math.min(48, Math.max(7, String(text.text).length * text.fontSize / canvas.width * 45));
    const height = Math.max(4, text.fontSize / canvas.height * 70);
    return Math.abs(text.x - x) <= width && Math.abs(text.y - y) <= height;
  });
}

function syncTextControls(text) {
  $("textInput").value = text.text;
  $("fontSize").value = String(text.fontSize);
  $("fontSizeValue").textContent = String(text.fontSize);
  $("colorInput").value = text.color;
  $("fontFamily").value = text.fontFamily;
  $("fontBold").checked = text.bold || false; // 🟢 볼드 동기화
}

// ======================================
// 7. 도구 선택
// ======================================
document.querySelectorAll(".tool-btn").forEach(button => {
  button.addEventListener("click", () => {
    const tool = button.dataset.tool;

    if (tool === "undo") { undo(); return; }

    activeTool = tool;

    document.querySelectorAll(".tool-btn").forEach(btn => {
      const selected = btn === button;
      btn.classList.toggle("active", selected);
      if (btn.dataset.tool !== "undo") btn.setAttribute("aria-pressed", String(selected));
    });

    document.querySelectorAll(".opt-content").forEach(panel => {
      panel.classList.toggle("active", panel.id === `opt-${tool}`);
    });
  });
});

// ======================================
// 8. 🟢 스티커 패널 동적 렌더링 (카테고리 분류)
// ======================================
function renderStickerPanel() {
  const grid = $("stickerGrid");
  if (!grid) return;
  grid.innerHTML = "";

  const categories = [
    { key: "animal", title: "동물 귀/수염" },
    { key: "speech", title: "💬 유행어 말풍선" },
    { key: "emoji", title: "기본 이모지" },
    { key: "custom", title: "🎨 내 스티커" }
  ];

  categories.forEach(cat => {
    const title = document.createElement("h3");
    title.textContent = cat.title;
    grid.appendChild(title);

    const container = document.createElement("div");
    container.className = "sticker-grid";

    // 데이터 가져오기 (내장 + 커스텀)
    let items = BUILTIN_STICKERS[cat.key] || [];
    if (cat.key === "custom") items = getCustomStickers();

    items.forEach(item => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "sticker-item";
      
      if (item.kind === "emoji") btn.textContent = item.emoji;
      else if (item.kind === "speech") {
        btn.textContent = item.text;
        btn.classList.add("speech-bubble");
      } else if (item.kind === "image") {
        const img = document.createElement("img");
        img.src = item.src;
        btn.appendChild(img);
      }

      btn.addEventListener("click", () => {
        selectedStickerData = item;
        state.selectedStickerId = null;
        activeTool = "sticker"; // 스티커를 선택하면 스티커 도구도 자동 활성화
        document.querySelectorAll(".sticker-item").forEach(b => b.classList.remove("selected"));
        btn.classList.add("selected");
        setStatus(`"${item.name}" 스티커를 선택했습니다. 이미지를 클릭해 붙여보세요.`);
      });

      container.appendChild(btn);
    });

    grid.appendChild(container);
  });
}

// ======================================
// 9. 스티커 추가
// ======================================

function addSticker(x, y) {
  if (!selectedStickerData) {
    setStatus("먼저 스티커 창에서 스티커를 선택해 주세요.", true);
    return;
  }

  remember();

  const sticker = {
    id: crypto.randomUUID(),
    x,
    y,
    size: Number($("stickerSize")?.value) || 120,
    rotation: 0,
    kind: selectedStickerData.kind,
    name: selectedStickerData.name
  };

  // 이모지 스티커
  if (selectedStickerData.kind === "emoji") {
    sticker.emoji = selectedStickerData.emoji;
  }

  // 말풍선 스티커
  else if (selectedStickerData.kind === "speech") {
    sticker.text = selectedStickerData.text;
  }

  // 이미지 스티커
  else if (selectedStickerData.kind === "image") {
    sticker.src = selectedStickerData.src;
  }

  state.stickers.push(sticker);
  state.selectedStickerId = sticker.id;

  render();

  setStatus("스티커를 추가했습니다.");
}


// ======================================
// 10. 스티커 선택 및 이동/회전
// ======================================
function pickSticker(x, y) {
  return [...state.stickers].reverse().find(sticker => {
    const width = sticker.size / canvas.width * 100;
    const height = sticker.size / canvas.height * 100;
    return Math.abs(sticker.x - x) <= width / 2 && Math.abs(sticker.y - y) <= height / 2;
  });
}

$("stickerSize").addEventListener("change", e => {
  const sticker = state.stickers.find(s => s.id === state.selectedStickerId);
  if (!sticker) return;
  remember();
  sticker.size = Number(e.target.value);
  render();
});

// 🟢 스티커 회전 슬라이더 (신규)
$("stickerRotation")?.addEventListener("input", e => {
  const sticker = state.stickers.find(s => s.id === state.selectedStickerId);
  if (!sticker) return;
  // 실시간으로 렌더링만 하고, 저장은 change 이벤트에서
  sticker.rotation = Number(e.target.value);
  render();
});

$("stickerRotation")?.addEventListener("change", e => {
  const sticker = state.stickers.find(s => s.id === state.selectedStickerId);
  if (!sticker) return;
  remember();
  setStatus("스티커를 회전했습니다.");
});

$("deleteStickerBtn").addEventListener("click", () => {
  if (!state.selectedStickerId) {
    setStatus("삭제할 스티커를 먼저 선택하세요.", true);
    return;
  }
  remember();
  state.stickers = state.stickers.filter(s => s.id !== state.selectedStickerId);
  state.selectedStickerId = null;
  render();
  setStatus("선택한 스티커를 삭제했습니다.");
});

// ======================================
// 11. 텍스트 설정 이벤트 (볼드/폰트)
// ======================================
$("addTextBtn").addEventListener("click", () => addText($("textInput").value));

$("textInput").addEventListener("input", e => {
  const text = selectedText();
  if (text) { text.text = e.target.value.slice(0, 300); render(); }
});

$("fontSize").addEventListener("input", e => {
  $("fontSizeValue").textContent = e.target.value;
  const text = selectedText();
  if (text) { text.fontSize = Number(e.target.value); render(); }
});

$("colorInput").addEventListener("input", e => {
  const text = selectedText();
  if (text) { text.color = e.target.value; render(); }
});

$("fontFamily").addEventListener("change", e => {
  const text = selectedText();
  if (text) { text.fontFamily = e.target.value; render(); }
});

// 🟢 볼드 체크박스 이벤트
$("fontBold").addEventListener("change", e => {
  const text = selectedText();
  if (text) { text.bold = e.target.checked; render(); }
});

// ======================================
// 12. 이미지 설정 (배경, 크기, 프레임)
// ======================================
$("bgColor").addEventListener("input", e => { state.background = e.target.value; render(); });
$("imageScale").addEventListener("input", e => { state.imageScale = Number(e.target.value) / 100; render(); });
$("frameType").addEventListener("change", e => { state.frameType = e.target.value; render(); });

// ======================================
// 13. 이미지 업로드 및 분할
// ======================================
// 이미지 업로드 요소
const fileInput = $("fileInput");
const uploadPlaceholder = $("uploadPlaceholder");
const btnInput = $("btnInput");

// 이미지 불러오기 버튼
btnInput?.addEventListener("click", () => {
  fileInput?.click();
});

uploadPlaceholder?.addEventListener("click", () => {
  fileInput?.click();
});

// 이미지 선택 및 불러오기
fileInput?.addEventListener("change", async (e) => {
  const file = e.target.files?.[0];

  if (!file) return;

  try {
    await handleFile(file);
  } catch (error) {
    console.error("이미지 불러오기 실패:", error);
    alert("이미지를 불러오지 못했습니다.");
  } finally {
    e.target.value = "";
  }
});

// 사진 분할 업로드 (2등분 / 4등분)
const splitFileInput = $("splitFileInput");

$("split2Btn")?.addEventListener("click", () => {
  if (!splitFileInput) return;

  splitFileInput.onchange = async (e) => {
    const file = e.target.files?.[0];

    if (!file) return;

    try {
      await handleFile(file, "2");
    } catch (error) {
      console.error("2분할 이미지 업로드 실패:", error);
      alert("이미지 분할에 실패했습니다.");
    } finally {
      e.target.value = "";
    }
  };

  splitFileInput.click();
});

$("split4Btn")?.addEventListener("click", () => {
  if (!splitFileInput) return;

  splitFileInput.onchange = async (e) => {
    const file = e.target.files?.[0];

    if (!file) return;

    try {
      await handleFile(file, "4");
    } catch (error) {
      console.error("4분할 이미지 업로드 실패:", error);
      alert("이미지 분할에 실패했습니다.");
    } finally {
      e.target.value = "";
    }
  };

  splitFileInput.click();
});

// ======================================
// 14. 커스텀 스티커/폰트 추가
// ======================================
$("customStickerInput")?.addEventListener("change", async e => {
  const file = e.target.files?.[0];
  if (file) {
    try {
      await addCustomSticker(file);
      renderStickerPanel();
      setStatus("커스텀 스티커가 추가되었습니다.");
    } catch (err) { setStatus(err.message, true); }
  }
  e.target.value = "";
});

// (HTML에 커스텀 폰트 추가 버튼이 있다면 연결)
// 예: $("customFontInput")?.addEventListener("change", async e => { ... });

// ======================================
// 15. 화면비, 줌, 캔버스 이벤트
// ======================================
$("aspectRatio").addEventListener("change", e => {
  state.aspectRatio = e.target.value;
  updateCanvasSize();
});

$("zoomInBtn").addEventListener("click", () => { state.zoomLevel = Math.min(2, state.zoomLevel + 0.1); updateCanvasSize(); });
$("zoomOutBtn").addEventListener("click", () => { state.zoomLevel = Math.max(0.5, state.zoomLevel - 0.1); updateCanvasSize(); });

canvas.addEventListener("pointerdown", event => {
  if (event.button !== 0) return;
  const point = getCoords(event);

  if (activeTool === "text") {
    const text = pickText(point.x, point.y);
    if (text) {
      remember();
      state.selectedTextId = text.id;
      syncTextControls(text);
      drag = { type: "text", target: text, offsetX: point.x - text.x, offsetY: point.y - text.y };
      canvas.setPointerCapture(event.pointerId);
    } else {
      addText($("textInput").value, point.x, point.y);
    }
  } else if (activeTool === "draw") {
    remember();
    const stroke = { points: [point], color: $("brushColor").value, size: Number($("brushSize").value), type: $("brushType").value };
    state.drawings.push(stroke);
    drag = { type: "draw", target: stroke };
    canvas.setPointerCapture(event.pointerId);
    render();
  } else if (activeTool === "sticker") {
    const sticker = pickSticker(point.x, point.y);
    if (sticker) {
      remember();
      state.selectedStickerId = sticker.id;
      $("stickerSize").value = String(sticker.size);
      $("stickerRotation").value = String(sticker.rotation || 0);
      drag = { type: "sticker", target: sticker, offsetX: point.x - sticker.x, offsetY: point.y - sticker.y };
      canvas.setPointerCapture(event.pointerId);
    } else {
      addSticker(point.x, point.y);
    }
  } else if (activeTool === "image" && state.image) {
    remember();
    drag = { type: "image", offsetX: point.x - state.imageX, offsetY: point.y - state.imageY };
    canvas.setPointerCapture(event.pointerId);
  }
});

canvas.addEventListener("pointermove", event => {
  if (!drag) return;
  const point = getCoords(event);

  if (drag.type === "text") { drag.target.x = point.x - drag.offsetX; drag.target.y = point.y - drag.offsetY; }
  else if (drag.type === "draw") { drag.target.points.push(point); }
  else if (drag.type === "sticker") { drag.target.x = point.x - drag.offsetX; drag.target.y = point.y - drag.offsetY; }
  else if (drag.type === "image") { state.imageX = point.x - drag.offsetX; state.imageY = point.y - drag.offsetY; }
  render();
});

function stopDrag() { drag = null; }
canvas.addEventListener("pointerup", stopDrag);
canvas.addEventListener("pointercancel", stopDrag);

// ======================================
// 16. SAVE / JSON / OUTPUT
// ======================================
$("btnSave").addEventListener("click", openTemplateModal);
$("createTemplateBtn").addEventListener("click", createTemplate);
$("closeModalBtn").addEventListener("click", closeTemplateModal);
$("templateModal").addEventListener("click", e => { if (e.target === $("templateModal")) closeTemplateModal(); });
document.addEventListener("keydown", e => { if (e.key === "Escape") closeTemplateModal(); });

// 🟢 JSON 저장 버튼 (기존 INPUT 버튼 위치)
$("btnSaveJson")?.addEventListener("click", exportToJson);

// 🟢 JSON 불러오기 (파일 입력 연결)
$("jsonFileInput")?.addEventListener("change", e => {
  const file = e.target.files?.[0];
  if (file) importFromJson(file);
  e.target.value = "";
});

$("btnOutput").addEventListener("click", () => {
  render();
  canvas.toBlob(blob => {
    if (!blob) { setStatus("PNG 생성 실패", true); return; }
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `card-studio-${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setStatus("PNG 다운로드가 시작되었습니다.");
  }, "image/png");
});

// ======================================
// 17. 초기 실행
// ======================================
$("frameType").value = state.frameType || "none";
renderStickerPanel(); // 🟢 스티커 패널 초기 렌더링
restoreCustomFonts(); // 🟢 커스텀 폰트 복원
window.addEventListener("resize", updateCanvasSize);
updateCanvasSize();