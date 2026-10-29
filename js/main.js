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

// ---------- 이모지 스티커 기능 ----------
const EMOJIS = ["😀","😂","😍","🥰","😎","🤩","🥳","😭","😡","👍","👎","❤️","🔥","✨","🎉","🎁","🌈","⭐","🍕","🍔","🍟","☕","🐶","🐱","🦊","🐼","🌸","🌻","💡","💻"];
const stickerGrid = document.getElementById("stickerGrid");
EMOJIS.forEach(emoji => {
  const span = document.createElement("span");
  span.className = "sticker-item";
  span.textContent = emoji;
  span.addEventListener("click", () => {
    state.stickers.push({
      id: Date.now().toString(),
      emoji: emoji,
      x: 50, y: 50, size: 60 // 중앙에 기본 크기로 추가
    });
    render();
  });
  stickerGrid.appendChild(span);
});

document.getElementById("clearStickersBtn").addEventListener("click", () => {
  state.stickers = []; render();
});

// ---------- 캔버스 마우스/터치 이벤트 (스티커 드래그 & 그리기) ----------
let isDrawing = false;
let activeSticker = null;
let currentStroke = null;

// 마우스/터치 좌표를 캔버스 논리 좌표(%)로 변환
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

function startAction(e) {
  e.preventDefault();
  const { x, y } = getCanvasCoords(e);
  const activeTab = document.querySelector(".tab-btn.active").dataset.tab;

  if (activeTab === "tab-sticker") {
    // 클릭한 위치 근처에 있는 스티커 찾기 (역순으로 탐색하여 가장 위에 있는 것 선택)
    let found = null;
    for (let i = state.stickers.length - 1; i >= 0; i--) {
      const s = state.stickers[i];
      const dist = Math.hypot(s.x - x, s.y - y);
      // 대략적인 히트박스 (스티커 크기에 비례)
      if (dist < 10) { found = s; break; }
    }
    if (found) {
      activeSticker = found;
      // 드래그 시작 시 맨 앞으로 가져오기
      state.stickers = state.stickers.filter(s => s.id !== found.id);
      state.stickers.push(found);
      render();
    }
  } else if (activeTab === "tab-draw") {
    isDrawing = true;
    currentStroke = {
      points: [{ x, y }],
      color: document.getElementById("brushColor").value,
      size: Number(document.getElementById("brushSize").value)
    };
    state.drawings.push(currentStroke);
    render();
  }
}

function moveAction(e) {
  if (!activeSticker && !isDrawing) return;
  e.preventDefault();
  const { x, y } = getCanvasCoords(e);

  if (activeSticker) {
    activeSticker.x = x;
    activeSticker.y = y;
    render();
  } else if (isDrawing && currentStroke) {
    currentStroke.points.push({ x, y });
    render();
  }
}

function endAction() {
  isDrawing = false;
  activeSticker = null;
  currentStroke = null;
}

canvas.addEventListener("mousedown", startAction);
canvas.addEventListener("mousemove", moveAction);
canvas.addEventListener("mouseup", endAction);
canvas.addEventListener("mouseleave", endAction);

// 모바일 터치 지원
canvas.addEventListener("touchstart", startAction, { passive: false });
canvas.addEventListener("touchmove", moveAction, { passive: false });
canvas.addEventListener("touchend", endAction);
canvas.addEventListener("touchcancel", endAction);

// ---------- 브러시 설정 ----------
document.getElementById("brushSize").addEventListener("input", (e) => {
  document.getElementById("brushSizeVal").textContent = e.target.value;
});
document.getElementById("clearDrawBtn").addEventListener("click", () => {
  state.drawings = []; render();
});

// ---------- 초기화 ----------
updateCanvasSize();
render();
renderTemplateList();