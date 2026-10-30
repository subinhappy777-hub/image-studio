import { state, render, updateCanvasSize, canvas } from "./state.js";
import { handleFile } from "./file-validation.js";
import { createTemplate, renderTemplateList, exportTemplates, importTemplates } from "./template.js";

// ---------- 1. 툴바 탭 전환 ----------
document.querySelectorAll(".tool-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    // 버튼 활성화 상태 변경
    document.querySelectorAll(".tool-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    
    // 패널 내용 변경
    document.querySelectorAll(".panel-content").forEach(c => c.classList.remove("active"));
    document.getElementById(`panel-${btn.dataset.tool}`).classList.add("active");
  });
});

// ---------- 2. 하단 주요 액션 (Input, Save, Output) ----------
// [Input] 사진 선택
document.getElementById("btnInput").addEventListener("click", () => {
  document.getElementById("fileInput").click();
  // 사진 탭으로 강제 이동
  document.querySelector('[data-tool="image"]').click();
});

// [Save] 템플릿 저장 (메모리)
document.getElementById("btnSave").addEventListener("click", () => {
  createTemplate();
  // 템플릿 목록 창 열기
  document.getElementById("templateListContainer").classList.add("open");
});

// [Output] 파일로 다운로드
document.getElementById("btnOutput").addEventListener("click", () => {
  render(); // 다운로드 전 최신 상태 렌더링
  const dataURL = canvas.toDataURL("image/png");
  const link = document.createElement("a");
  const ratioName = state.aspectRatio.replace(":", "x");
  link.download = `card-studio_${ratioName}_${Date.now()}.png`;
  link.href = dataURL;
  document.body.appendChild(link); 
  link.click(); 
  document.body.removeChild(link);
});

// ---------- 3. 편집 도구 이벤트 연결 ----------
// 사진
document.getElementById("fileInput").addEventListener("change", (e) => {
  handleFile(e.target.files && e.target.files[0]);
  e.target.value = "";
});
document.getElementById("aspectRatio").addEventListener("change", (e) => {
  state.aspectRatio = e.target.value; updateCanvasSize(); render();
});

// 텍스트
document.getElementById("textInput").addEventListener("input", (e) => {
  state.text = e.target.value; render();
});
document.getElementById("fontFamily").addEventListener("change", (e) => {
  state.fontFamily = e.target.value; render();
});
document.getElementById("colorInput").addEventListener("input", (e) => {
  state.color = e.target.value; render();
});
document.getElementById("fontSize").addEventListener("input", (e) => {
  state.fontSize = Number(e.target.value); render();
});

// 스티커
const EMOJIS = ["😀","😂","😍","🥰","😎","🤩","🥳","😭","😡","👍","👎","❤️","🔥","✨","🎉","🎁","🌈","⭐","🍕","🍔","🍟","☕","🐶","🐱","🦊","🐼","🌸","🌻","💡","💻"];
let selectedEmojiToCreate = null; 
const stickerGrid = document.getElementById("stickerGrid");
const selectedEmojiDisplay = document.getElementById("selectedEmojiDisplay");

EMOJIS.forEach(emoji => {
  const span = document.createElement("span");
  span.className = "sticker-item";
  span.textContent = emoji;
  span.addEventListener("click", () => {
    stickerGrid.querySelectorAll(".sticker-item").forEach(el => el.classList.remove("selected"));
    span.classList.add("selected");
    selectedEmojiToCreate = emoji;
    selectedEmojiDisplay.textContent = `선택된 스티커: ${emoji}`;
  });
  stickerGrid.appendChild(span);
});

document.getElementById("clearStickersBtn").addEventListener("click", () => {
  state.stickers = []; state.selectedStickerId = null; render();
});

// 그리기
document.getElementById("brushSize").addEventListener("input", (e) => {
  // UI 업데이트용
});
document.getElementById("undoDrawBtn").addEventListener("click", () => {
  if (state.drawings.length > 0) { state.drawings.pop(); render(); }
});

// ---------- 4. 캔버스 마우스/터치 이벤트 ----------
let isDrawing = false, isDraggingSticker = false, isRotatingSticker = false;
let currentStroke = null, activeSticker = null, dragOffset = { x: 0, y: 0 };

function getCanvasCoords(e) {
  const rect = canvas.getBoundingClientRect();
  const clientX = e.touches ? e.touches[0].clientX : e.clientX;
  const clientY = e.touches ? e.touches[0].clientY : e.clientY;
  const scaleX = canvas.width / rect.width, scaleY = canvas.height / rect.height;
  return {
    x: ((clientX - rect.left) / rect.width) * 100,
    y: ((clientY - rect.top) / rect.height) * 100,
    px: (clientX - rect.left) * scaleX,
    py: (clientY - rect.top) * scaleY
  };
}

function getHandlePosition(s) {
  const px = (s.x / 100) * canvas.width, py = (s.y / 100) * canvas.height;
  const w = s.size * 0.8, h = s.size * 0.8, hx = w / 2, hy = -h / 2;
  const cos = Math.cos(s.rotation || 0), sin = Math.sin(s.rotation || 0);
  return { x: px + (hx * cos - hy * sin), y: py + (hx * sin + hy * cos) };
}

function startAction(e) {
  e.preventDefault();
  const { x, y, px, py } = getCanvasCoords(e);
  const activeTool = document.querySelector(".tool-btn.active").dataset.tool;

  if (activeTool === "sticker") {
    const selected = state.stickers.find(s => s.id === state.selectedStickerId);
    if (selected) {
      const handle = getHandlePosition(selected);
      if (Math.hypot(px - handle.x, py - handle.y) < 20) {
        isRotatingSticker = true; activeSticker = selected; return;
      }
    }
    let found = null;
    for (let i = state.stickers.length - 1; i >= 0; i--) {
      const s = state.stickers[i];
      if (Math.hypot(s.x - x, s.y - y) < 10) { found = s; break; }
    }
    if (found) {
      state.selectedStickerId = found.id;
      state.stickers = state.stickers.filter(s => s.id !== found.id);
      state.stickers.push(found);
      activeSticker = found; isDraggingSticker = true;
      dragOffset.x = found.x - x; dragOffset.y = found.y - y;
      render(); return; 
    } else {
      state.selectedStickerId = null;
    }
    if (selectedEmojiToCreate && !found) {
      state.stickers.push({
        id: Date.now().toString(), emoji: selectedEmojiToCreate, x, y, size: 60, rotation: 0
      });
      state.selectedStickerId = state.stickers[state.stickers.length - 1].id;
      render();
    }
  } else if (activeTool === "draw") {
    isDrawing = true;
    currentStroke = {
      points: [{ x, y }],
      color: document.getElementById("brushColor").value,
      size: Number(document.getElementById("brushSize").value),
      type: document.getElementById("brushType").value
    };
    state.drawings.push(currentStroke); render();
  }
}

function moveAction(e) {
  if (!activeSticker && !isDrawing) return;
  e.preventDefault();
  const { x, y, px, py } = getCanvasCoords(e);

  if (isDraggingSticker && activeSticker) {
    activeSticker.x = x + dragOffset.x; activeSticker.y = y + dragOffset.y; render();
  } else if (isRotatingSticker && activeSticker) {
    const cx = (activeSticker.x / 100) * canvas.width, cy = (activeSticker.y / 100) * canvas.height;
    activeSticker.rotation = Math.atan2(py - cy, px - cx) + Math.PI / 4; render();
  } else if (isDrawing && currentStroke) {
    currentStroke.points.push({ x, y }); render();
  }
}

function endAction() {
  isDrawing = false; isDraggingSticker = false; isRotatingSticker = false;
  activeSticker = null; currentStroke = null;
}

canvas.addEventListener("mousedown", startAction);
canvas.addEventListener("mousemove", moveAction);
canvas.addEventListener("mouseup", endAction);
canvas.addEventListener("mouseleave", endAction);
canvas.addEventListener("touchstart", startAction, { passive: false });
canvas.addEventListener("touchmove", moveAction, { passive: false });
canvas.addEventListener("touchend", endAction);
canvas.addEventListener("touchcancel", endAction);

// ---------- 5. 기타 (템플릿 JSON) ----------
document.getElementById("exportJsonBtn").addEventListener("click", exportTemplates);
document.getElementById("importJsonBtn").addEventListener("click", () => document.getElementById("jsonFileInput").click());
document.getElementById("jsonFileInput").addEventListener("change", (e) => {
  importTemplates(e.target.files && e.target.files[0]); e.target.value = "";
});

// ---------- 초기화 ----------
updateCanvasSize();
render();
renderTemplateList();