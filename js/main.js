import { state, render, updateCanvasSize, canvas } from "./state.js";
import { handleFile } from "./file-validation.js";
import { createTemplate, renderTemplateList } from "./template.js";

// ---------- 1. 툴바 및 옵션 패널 전환 ----------
document.querySelectorAll(".tool-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    const tool = btn.dataset.tool;
    
    // 실행 취소(Undo) 버튼 처리
    if (tool === "undo") {
      if (state.drawings.length > 0) state.drawings.pop();
      else if (state.texts.length > 0) state.texts.pop();
      else if (state.stickers.length > 0) state.stickers.pop();
      render();
      return;
    }

    // 툴 활성화 UI 변경
    document.querySelectorAll(".tool-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    
    document.querySelectorAll(".opt-content").forEach(c => c.classList.remove("active"));
    const panel = document.getElementById(`opt-${tool}`);
    if (panel) panel.classList.add("active");
  });
});

// ---------- 2. 하단 메인 액션 ----------
document.getElementById("btnInput").addEventListener("click", () => document.getElementById("fileInput").click());
document.getElementById("fileInput").addEventListener("change", (e) => {
  handleFile(e.target.files && e.target.files[0]);
  e.target.value = "";
});
document.getElementById("btnSave").addEventListener("click", () => {
  createTemplate();
  document.getElementById("templateModal").classList.add("open");
});
document.getElementById("btnOutput").addEventListener("click", () => {
  render();
  const link = document.createElement("a");
  link.download = `card-studio_${state.aspectRatio.replace(":", "x")}_${Date.now()}.png`;
  link.href = canvas.toDataURL("image/png");
  document.body.appendChild(link); link.click(); document.body.removeChild(link);
});

// ---------- 3. 줌 컨트롤 ----------
document.getElementById("zoomInBtn").addEventListener("click", () => {
  state.zoomLevel = Math.min(2.0, state.zoomLevel + 0.1);
  updateCanvasSize();
});
document.getElementById("zoomOutBtn").addEventListener("click", () => {
  state.zoomLevel = Math.max(0.5, state.zoomLevel - 0.1);
  updateCanvasSize();
});

// ---------- 4. 옵션 패널 이벤트 ----------
document.getElementById("aspectRatio").addEventListener("change", (e) => {
  state.aspectRatio = e.target.value; updateCanvasSize();
});
document.getElementById("bgColor").addEventListener("input", render);

// ---------- 5. 캔버스 마우스/터치 (텍스트, 그림, 선택) ----------
let isDrawing = false, currentStroke = null;
let activeSticker = null, isDraggingSticker = false;
let activeText = null, isDraggingText = false;
let dragOffset = { x: 0, y: 0 };

const inlineInput = document.getElementById("inlineTextInput");

function getCanvasCoords(e) {
  const rect = canvas.getBoundingClientRect();
  const clientX = e.touches ? e.touches[0].clientX : e.clientX;
  const clientY = e.touches ? e.touches[0].clientY : e.clientY;
  return {
    x: ((clientX - rect.left) / rect.width) * 100,
    y: ((clientY - rect.top) / rect.height) * 100,
    px: (clientX - rect.left) * (canvas.width / rect.width),
    py: (clientY - rect.top) * (canvas.height / rect.height)
  };
}

// 캔버스 클릭 시 인라인 텍스트 입력 활성화
function showInlineInput(t = null) {
  const rect = canvas.getBoundingClientRect();
  const containerRect = document.getElementById("canvasContainer").getBoundingClientRect();
  
  if (t) {
    inlineInput.value = t.text;
    inlineInput.style.left = `${(t.x / 100) * 100}%`;
    inlineInput.style.top = `${(t.y / 100) * 100}%`;
    inlineInput.style.fontSize = `${t.fontSize * (rect.width / canvas.width)}px`;
    inlineInput.style.color = t.color;
    inlineInput.dataset.targetId = t.id;
  } else {
    const x = parseFloat(inlineInput.style.left) || 50;
    const y = parseFloat(inlineInput.style.top) || 50;
    inlineInput.value = "";
    inlineInput.dataset.targetId = "";
  }
  
  inlineInput.style.display = "block";
  inlineInput.focus();
}

inlineInput.addEventListener("blur", () => {
  inlineInput.style.display = "none";
  const val = inlineInput.value.trim();
  const targetId = inlineInput.dataset.targetId;
  
  if (val) {
    if (targetId) {
      const t = state.texts.find(t => t.id === targetId);
      if (t) t.text = val;
    } else {
      state.texts.push({
        id: Date.now().toString(),
        text: val,
        x: parseFloat(inlineInput.style.left),
        y: parseFloat(inlineInput.style.top),
        fontSize: Number(document.getElementById("fontSize").value),
        fontFamily: document.getElementById("fontFamily").value,
        color: document.getElementById("colorInput").value
      });
    }
  } else if (targetId) {
    state.texts = state.texts.filter(t => t.id !== targetId);
  }
  render();
});

function startAction(e) {
  e.preventDefault();
  const activeTool = document.querySelector(".tool-btn.active").dataset.tool;
  const { x, y, px, py } = getCanvasCoords(e);

  if (activeTool === "text") {
    // 텍스트 툴: 기존 텍스트 클릭 시 수정, 빈 곳 클릭 시 새로 생성
    let found = null;
    for (let i = state.texts.length - 1; i >= 0; i--) {
      const t = state.texts[i];
      const rect = canvas.getBoundingClientRect();
      const scale = rect.width / canvas.width;
      
      // 히트박스 판정 (단순화)
      if (Math.hypot(t.x - x, t.y - y) < 10) { found = t; break; }
    }
    
    if (found) {
      inlineInput.style.left = `${found.x}%`;
      inlineInput.style.top = `${found.y}%`;
      showInlineInput(found);
    } else {
      inlineInput.style.left = `${x}%`;
      inlineInput.style.top = `${y}%`;
      showInlineInput(null);
    }
    return;
  }
  
  if (activeTool === "draw") {
    isDrawing = true;
    currentStroke = {
      points: [{ x, y }],
      color: document.getElementById("brushColor").value,
      size: Number(document.getElementById("brushSize").value),
      type: document.getElementById("brushType").value
    };
    state.drawings.push(currentStroke); render();
    return;
  }
}

function moveAction(e) {
  if (!isDrawing || !currentStroke) return;
  e.preventDefault();
  const { x, y } = getCanvasCoords(e);
  currentStroke.points.push({ x, y });
  render();
}

function endAction() {
  isDrawing = false; isDraggingSticker = false;
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

// 업로드 플레이스홀더 클릭 이벤트
document.getElementById("uploadPlaceholder").addEventListener("click", () => {
  document.getElementById("fileInput").click();
});
document.getElementById("closeModalBtn").addEventListener("click", () => {
  document.getElementById("templateModal").classList.remove("open");
});

// ---------- 초기화 ----------
updateCanvasSize();
render();
renderTemplateList();

// 화면 크기 변경 시 캔버스 재조정
window.addEventListener("resize", updateCanvasSize);