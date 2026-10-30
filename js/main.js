import { state, render, updateCanvasSize, canvas } from "./state.js";
import { handleFile } from "./file-validation.js";

const STORAGE_KEY = "zzal_card_templates";
const inlineInput = document.getElementById("inlineTextInput");

// 1. 상단 툴바 아이콘 클릭 시 기능(패널) 전환
document.querySelectorAll(".tool-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    const tool = btn.dataset.tool;
    
    if (tool === "undo") {
      if (state.drawings.length) state.drawings.pop();
      else if (state.texts.length) state.texts.pop();
      else if (state.stickers.length) state.stickers.pop();
      render(); return;
    }
    
    // 활성화 스타일 변경
    document.querySelectorAll(".tool-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    
    // 하단 패널 변경
    document.querySelectorAll(".opt-content").forEach(c => c.classList.remove("active"));
    const panel = document.getElementById(`opt-${tool}`);
    if (panel) panel.classList.add("active");
  });
});

// 2. 하단 메인 버튼 (INPUT / SAVE / OUTPUT)
document.getElementById("btnInput").addEventListener("click", () => document.getElementById("fileInput").click());
document.getElementById("fileInput").addEventListener("change", (e) => { handleFile(e.target.files[0]); e.target.value = ""; });
document.getElementById("uploadPlaceholder").addEventListener("click", () => document.getElementById("fileInput").click());

document.getElementById("btnSave").addEventListener("click", () => {
  const templates = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  templates.push({
    id: Date.now().toString(), name: `템플릿 ${templates.length + 1}`,
    aspectRatio: state.aspectRatio, texts: state.texts, drawings: state.drawings, stickers: state.stickers,
    imageSrc: state.image ? state.image.src : null
  });
  localStorage.setItem(STORAGE_KEY, JSON.stringify(templates));
  renderTemplateList();
  document.getElementById("templateModal").classList.add("open");
});

document.getElementById("closeModalBtn").addEventListener("click", () => document.getElementById("templateModal").classList.remove("open"));

document.getElementById("btnOutput").addEventListener("click", () => {
  render(); // 다운로드 전 동기화
  const link = document.createElement("a");
  link.download = `card-studio_${Date.now()}.png`;
  link.href = canvas.toDataURL("image/png");
  document.body.appendChild(link); link.click(); document.body.removeChild(link);
});

// 3. 이미지 크기(줌) 조절 및 화면비
document.getElementById("zoomInBtn").addEventListener("click", () => { state.zoomLevel = Math.min(2.0, state.zoomLevel + 0.1); updateCanvasSize(); });
document.getElementById("zoomOutBtn").addEventListener("click", () => { state.zoomLevel = Math.max(0.5, state.zoomLevel - 0.1); updateCanvasSize(); });
document.getElementById("aspectRatio").addEventListener("change", (e) => { state.aspectRatio = e.target.value; updateCanvasSize(); });
document.getElementById("bgColor").addEventListener("input", render);

// 4. 템플릿 리스트 렌더링
function renderTemplateList() {
  const listEl = document.getElementById("templateList");
  const templates = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  listEl.innerHTML = templates.length === 0 ? '<li style="justify-content:center;">저장된 템플릿이 없습니다.</li>' : "";
  
  templates.forEach(t => {
    const li = document.createElement("li");
    li.innerHTML = `<span>${t.name}</span><button class="load-btn" data-id="${t.id}">불러오기</button>`;
    listEl.appendChild(li);
  });

  listEl.querySelectorAll(".load-btn").forEach(btn => btn.addEventListener("click", (e) => {
    const templates = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
    const t = templates.find(x => x.id === e.target.dataset.id);
    if (t) {
      state.aspectRatio = t.aspectRatio; state.texts = t.texts || [];
      state.drawings = t.drawings || []; state.stickers = t.stickers || [];
      document.getElementById("aspectRatio").value = state.aspectRatio;
      if (t.imageSrc) {
        const img = new Image(); img.onload = () => { state.image = img; document.getElementById("uploadPlaceholder").style.display = "none"; updateCanvasSize(); }; img.src = t.imageSrc;
      } else {
        state.image = null; document.getElementById("uploadPlaceholder").style.display = "flex"; updateCanvasSize();
      }
      document.getElementById("templateModal").classList.remove("open");
    }
  }));
}

// 5. 캔버스 마우스/터치 이벤트 (직접 텍스트 입력 & 그림 그리기)
let isDrawing = false, currentStroke = null;

function getCoords(e) {
  const rect = canvas.getBoundingClientRect();
  const clientX = e.touches ? e.touches[0].clientX : e.clientX;
  const clientY = e.touches ? e.touches[0].clientY : e.clientY;
  return {
    x: ((clientX - rect.left) / rect.width) * 100,
    y: ((clientY - rect.top) / rect.height) * 100
  };
}

function showInlineInput(x, y) {
  inlineInput.value = "";
  inlineInput.style.left = `${x}%`;
  inlineInput.style.top = `${y}%`;
  inlineInput.style.display = "block";
  inlineInput.focus();
}

inlineInput.addEventListener("blur", () => {
  inlineInput.style.display = "none";
  const val = inlineInput.value.trim();
  if (val) {
    state.texts.push({
      id: Date.now().toString(), text: val,
      x: parseFloat(inlineInput.style.left), y: parseFloat(inlineInput.style.top),
      fontSize: Number(document.getElementById("fontSize").value),
      fontFamily: document.getElementById("fontFamily").value,
      color: document.getElementById("colorInput").value
    });
    render();
  }
});

function startAction(e) {
  e.preventDefault();
  const activeTool = document.querySelector(".tool-btn.active").dataset.tool;
  const { x, y } = getCoords(e);

  if (activeTool === "text") {
    showInlineInput(x, y); // T 아이콘 활성화 시 캔버스 클릭 지점에 입력창 생성
  } else if (activeTool === "draw") {
    isDrawing = true;
    currentStroke = {
      points: [{ x, y }], color: document.getElementById("brushColor").value,
      size: Number(document.getElementById("brushSize").value), type: document.getElementById("brushType").value
    };
    state.drawings.push(currentStroke);
  }
}

function moveAction(e) {
  if (!isDrawing || !currentStroke) return;
  e.preventDefault();
  const { x, y } = getCoords(e);
  currentStroke.points.push({ x, y });
  render();
}

function endAction() { isDrawing = false; currentStroke = null; }

canvas.addEventListener("mousedown", startAction);
canvas.addEventListener("mousemove", moveAction);
canvas.addEventListener("mouseup", endAction);
canvas.addEventListener("mouseleave", endAction);
canvas.addEventListener("touchstart", startAction, { passive: false });
canvas.addEventListener("touchmove", moveAction, { passive: false });
canvas.addEventListener("touchend", endAction);
canvas.addEventListener("touchcancel", endAction);

// 6. 초기화
window.addEventListener("resize", updateCanvasSize);
updateCanvasSize();
renderTemplateList();