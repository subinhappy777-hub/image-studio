import { state, render, updateCanvasSize } from "./state.js";

const STORAGE_KEY = "zzal_card_templates";

export function getTemplates() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; } catch { return []; }
}

function saveTemplates(templates) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(templates));
}

export function createTemplate() {
  const templates = getTemplates();
  const newId = Date.now().toString() + Math.random().toString(36).substr(2, 5);
  
  const newTemplate = {
    id: newId,
    name: `템플릿 ${templates.length + 1}`,
    aspectRatio: state.aspectRatio,
    text: state.text,
    posX: state.posX,
    posY: state.posY,
    fontSize: state.fontSize,
    fontFamily: state.fontFamily,
    color: state.color,
    imageSrc: state.image ? state.image.src : null,
    stickers: JSON.parse(JSON.stringify(state.stickers)),
    drawings: JSON.parse(JSON.stringify(state.drawings))
  };
  
  templates.push(newTemplate);
  saveTemplates(templates);
  renderTemplateList();
  alert("현재 상태가 템플릿으로 저장되었습니다.");
}

export function loadTemplate(id) {
  const templates = getTemplates();
  const t = templates.find(t => t.id === id);
  if (!t) return;

  state.aspectRatio = t.aspectRatio;
  state.text = t.text;
  state.posX = t.posX;
  state.posY = t.posY;
  state.fontSize = t.fontSize;
  state.fontFamily = t.fontFamily || "system-ui, 'Malgun Gothic', sans-serif";
  state.color = t.color;
  state.stickers = t.stickers || [];
  state.drawings = t.drawings || [];
  state.selectedStickerId = null;

  updateCanvasSize();
  document.getElementById("aspectRatio").value = state.aspectRatio;
  document.getElementById("textInput").value = state.text;
  document.getElementById("posX").value = state.posX; document.getElementById("posXVal").textContent = state.posX;
  document.getElementById("posY").value = state.posY; document.getElementById("posYVal").textContent = state.posY;
  document.getElementById("fontSize").value = state.fontSize; document.getElementById("fontSizeVal").textContent = state.fontSize;
  document.getElementById("fontFamily").value = state.fontFamily;
  document.getElementById("colorInput").value = state.color;

  if (t.imageSrc) {
    const img = new Image();
    img.onload = () => { state.image = img; state.fileName = "템플릿 이미지"; render(); };
    img.src = t.imageSrc;
  } else {
    state.image = null; state.fileName = ""; render();
  }
}

export function updateTemplate(id) {
  const templates = getTemplates();
  const index = templates.findIndex(t => t.id === id);
  if (index === -1) return;

  templates[index] = {
    ...templates[index],
    aspectRatio: state.aspectRatio, text: state.text, posX: state.posX, posY: state.posY,
    fontSize: state.fontSize, fontFamily: state.fontFamily, color: state.color,
    imageSrc: state.image ? state.image.src : null,
    stickers: JSON.parse(JSON.stringify(state.stickers)),
    drawings: JSON.parse(JSON.stringify(state.drawings))
  };
  saveTemplates(templates);
  renderTemplateList();
  alert("현재 상태로 템플릿이 수정되었습니다.");
}

export function deleteTemplate(id) {
  if (!confirm("이 템플릿을 삭제하시겠습니까?")) return;
  let templates = getTemplates().filter(t => t.id !== id);
  saveTemplates(templates);
  renderTemplateList();
}

export function renderTemplateList() {
  const listEl = document.getElementById("templateList");
  const templates = getTemplates();
  listEl.innerHTML = "";
  
  if (templates.length === 0) {
    listEl.innerHTML = '<li style="color:var(--muted); justify-content:center; border:none; background:transparent;">저장된 템플릿이 없습니다.</li>';
    return;
  }

  templates.forEach(t => {
    const li = document.createElement("li");
    li.innerHTML = `
      <span>${t.name}</span>
      <div class="btn-group">
        <button class="load" data-id="${t.id}">불러오기</button>
        <button class="update" data-id="${t.id}">수정</button>
        <button class="del" data-id="${t.id}">삭제</button>
      </div>
    `;
    listEl.appendChild(li);
  });

  listEl.querySelectorAll(".load").forEach(btn => btn.addEventListener("click", (e) => loadTemplate(e.target.dataset.id)));
  listEl.querySelectorAll(".update").forEach(btn => btn.addEventListener("click", (e) => updateTemplate(e.target.dataset.id)));
  listEl.querySelectorAll(".del").forEach(btn => btn.addEventListener("click", (e) => deleteTemplate(e.target.dataset.id)));
}

export function exportTemplates() {
  const templates = getTemplates();
  if (templates.length === 0) { alert("내보낼 템플릿이 없습니다."); return; }
  const dataStr = JSON.stringify(templates, null, 2);
  const blob = new Blob([dataStr], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url; link.download = `templates_backup_${Date.now()}.json`;
  document.body.appendChild(link); link.click(); document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function importTemplates(file) {
  const msgEl = document.getElementById("jsonMsg");
  msgEl.textContent = ""; msgEl.className = "msg";
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const parsedData = JSON.parse(e.target.result);
      if (!Array.isArray(parsedData) || parsedData.length === 0) throw new Error("올바른 템플릿 데이터가 아닙니다.");
      if (!confirm("가져온 템플릿으로 기존 템플릿을 덮어쓰시겠습니까?")) return;
      saveTemplates(parsedData);
      renderTemplateList();
      msgEl.textContent = `성공: ${parsedData.length}개의 템플릿을 복원했습니다.`;
      msgEl.className = "msg ok";
    } catch (error) {
      msgEl.textContent = `거부됨: ${error.message}`;
      msgEl.className = "msg error";
    }
  };
  reader.readAsText(file);
}