import { state, render, updateCanvasSize, canvas } from "./state.js";
import { handleFile } from "./file-validation.js";
import { createTemplate, renderTemplateList, exportTemplates, importTemplates } from "./template.js";

// ---------- 탭 전환 ----------
document.querySelectorAll(".tab-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
    document.querySelectorAll(".tab-content").forEach(c => c.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById(btn.dataset.tab).classList.add("active");
  });
});

// ---------- 슬라이더/입력 연결 ----------
function bindRange(id, key) {
  const el = document.getElementById(id);
  const val = document.getElementById(id + "Val");
  el.addEventListener("input", () => {
    state[key] = Number(el.value);
    if (val) val.textContent = el.value;
    render();
  });
}

document.getElementById("aspectRatio").addEventListener("change", (e) => {
  state.aspectRatio = e.target.value; updateCanvasSize(); render();
});
document.getElementById("textInput").addEventListener("input", (e) => {
  state.text = e.target.value; render();
});
bindRange("posX", "posX"); bindRange("posY", "posY"); bindRange("fontSize", "fontSize");

document.getElementById("colorInput").addEventListener("input", (e) => {
  state.color = e.target.value; render();
});
document.getElementById("fontFamily").addEventListener("change", (e) => {
  state.fontFamily = e.target.value; render();
});

// ---------- 파일 업로드 ----------
document.getElementById("fileInput").addEventListener("change", (e) => {
  handleFile(e.target.files && e.target.files[0]);
  e.target.value = "";
});
const drop = document.getElementById("dropZone");
["dragenter", "dragover"].forEach(ev => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.style.borderColor = "var(--accent)"; }));
["dragleave", "drop"].forEach(ev => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.style.borderColor = ""; }));
drop.addEventListener("drop", (e) => handleFile(e.dataTransfer.files && e.dataTransfer.files[0]));

// ---------- 다운로드 ----------
document.getElementById("downloadBtn").addEventListener("click", () => {
  render();
  const dataURL = canvas.toDataURL("image/png");
  const link = document.createElement("a");
  const ratioName = state.aspectRatio.replace(":", "x");
  link.download = `card-studio_${ratioName}_${canvas.width}x${canvas.height}.png`;
  link.href = dataURL;
  document.body.appendChild(link); link.click(); document.body.removeChild(link);
});

// ---------- 템플릿 ----------
document.getElementById("saveTemplateBtn").addEventListener("click", createTemplate);
document.getElementById("exportJsonBtn").addEventListener("click", exportTemplates);
document.getElementById("importJsonBtn").addEventListener("click", () => document.getElementById("jsonFileInput").click());
document.getElementById("jsonFileInput").addEventListener("change", (e) => {
  importTemplates(e.target.files && e.target.files[0]); e.target.value = "";
});

// ---------- 이모지 스티커 ----------
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
    selectedEmojiDisplay.textContent = emoji;
  });
  stickerGrid.appendChild(span);
});

document.getElementById("clearStickersBtn").addEventListener("click", () => {
  state.stickers = [];
  state.selectedStickerId = null;
  render();
});

// ---------- 캔버스 마우스/터치 이벤트 ----------
let isDrawing = false;
let isDraggingSticker = false;
let isRotatingSticker = false;
let currentStroke = null;
let activeSticker = null;
let dragOffset = { x: 0, y: 0 };

function getCanvasCoords(e) {
  const rect = canvas.getBoundingClientRect();
  const clientX = e.touches ? e.touches[0].clientX : e.clientX;
  const clientY = e.touches ? e.touches[0].clientY : e.clientY;
  
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  
  return {
    x: ((clientX - rect.left) / rect.width) * 100,
    y: ((clientY - rect.top) / rect.height) * 100,
    px: (clientX - rect.left) * scaleX,
    py: (clientY - rect.top) * scaleY
  };
}

function getHandlePosition(s) {
  const px = (s.x / 100) * canvas.width;
  const py = (s.y / 100) * canvas.height;
  const w = s.size * 0.8;
  const h = s.size * 0.8;
  const hx = w / 2;
  const hy = -h / 2;
  const cos = Math.cos(s.rotation || 0);
  const sin = Math.sin(s.rotation || 0);
  return {
    x: px + (hx * cos - hy * sin),
    y: py + (hx * sin + hy * cos)
  };
}

function startAction(e) {
  e.preventDefault();
  const { x, y, px, py } = getCanvasCoords(e);
  const activeTab = document.querySelector(".tab-btn.active").dataset.tab;

  if (activeTab === "tab-sticker") {
    // 회전 핸들 확인
    const selected = state.stickers.find(s => s.id === state.selectedStickerId);
    if (selected) {
      const handle = getHandlePosition(selected);
      const distToHandle = Math.hypot(px - handle.x, py - handle.y);
      if (distToHandle < 20) {
        isRotatingSticker = true;
        activeSticker = selected;
        return;
      }
    }
    // 스티커 선택 확인
    let found = null;
    for (let i = state.stickers.length - 1; i >= 0; i--) {
      const s = state.stickers[i];
      const dist = Math.hypot(s.x - x, s.y - y);
      if (dist < 10) { found = s; break; }
    }

    if (found) {
      state.selectedStickerId = found.id;
      state.stickers = state.stickers.filter(s => s.id !== found.id);
      state.stickers.push(found);
      activeSticker = found;
      isDraggingSticker = true;
      dragOffset.x = found.x - x;
      dragOffset.y = found.y - y;
      render();
      return; 
    } else {
      state.selectedStickerId = null;
    }

    // 빈 공간 클릭 시 이모지 생성
    if (selectedEmojiToCreate && !found) {
      state.stickers.push({
        id: Date.now().toString(),
        emoji: selectedEmojiToCreate,
        x: x, y: y,
        size: 60,
        rotation: 0
      });
      state.selectedStickerId = state.stickers[state.stickers.length - 1].id;
      render();
    }

  } else if (activeTab === "tab-draw") {
    isDrawing = true;
    // 브러시 설정 읽기
    const brushType = document.getElementById("brushType").value;
    const brushColor = document.getElementById("brushColor").value;
    const brushSize = Number(document.getElementById("brushSize").value);
    
    currentStroke = {
      points: [{ x, y }],
      color: brushColor,
      size: brushSize,
      type: brushType // 브러시 종류 저장
    };
    state.drawings.push(currentStroke);
    render();
  }
}

function moveAction(e) {
  if (!activeSticker && !isDrawing) return;
  e.preventDefault();
  const { x, y, px, py } = getCanvasCoords(e);

  if (isDraggingSticker && activeSticker) {
    activeSticker.x = x + dragOffset.x;
    activeSticker.y = y + dragOffset.y;
    render();
  } else if (isRotatingSticker && activeSticker) {
    const cx = (activeSticker.x / 100) * canvas.width;
    const cy = (activeSticker.y / 100) * canvas.height;
    const angle = Math.atan2(py - cy, px - cx);
    activeSticker.rotation = angle + Math.PI / 4; 
    render();
  } else if (isDrawing && currentStroke) {
    currentStroke.points.push({ x, y });
    render();
  }
}

function endAction() {
  isDrawing = false;
  isDraggingSticker = false;
  isRotatingSticker = false;
  activeSticker = null;
  currentStroke = null;
}

canvas.addEventListener("mousedown", startAction);
canvas.addEventListener("mousemove", moveAction);
canvas.addEventListener("mouseup", endAction);
canvas.addEventListener("mouseleave", endAction);

canvas.addEventListener("touchstart", startAction, { passive: false });
canvas.addEventListener("touchmove", moveAction, { passive: false });
canvas.addEventListener("touchend", endAction);
canvas.addEventListener("touchcancel", endAction);

// ---------- 브러시 설정 (그리기 관련) ----------
document.getElementById("brushSize").addEventListener("input", (e) => {
  document.getElementById("brushSizeVal").textContent = e.target.value;
});

// 실행 취소 (가장 최근에 그린 선 1개 삭제)
document.getElementById("undoDrawBtn").addEventListener("click", () => {
  if (state.drawings.length > 0) {
    state.drawings.pop();
    render();
  }
});

document.getElementById("clearDrawBtn").addEventListener("click", () => {
  state.drawings = []; render();
});

// ---------- 초기화 ----------
updateCanvasSize();
render();
renderTemplateList();