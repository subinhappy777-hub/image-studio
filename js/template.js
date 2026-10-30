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
  const newId = Date.now().toString();
  const newTemplate = {
    id: newId, name: `템플릿 ${templates.length + 1}`,
    aspectRatio: state.aspectRatio,
    texts: JSON.parse(JSON.stringify(state.texts)),
    imageSrc: state.image ? state.image.src : null,
    stickers: JSON.parse(JSON.stringify(state.stickers)),
    drawings: JSON.parse(JSON.stringify(state.drawings))
  };
  templates.push(newTemplate);
  saveTemplates(templates);
  alert("현재 상태가 메모리에 저장되었습니다.");
  renderTemplateList();
}

export function loadTemplate(id) {
  const templates = getTemplates();
  const t = templates.find(t => t.id === id);
  if (!t) return;

  state.aspectRatio = t.aspectRatio;
  state.texts = t.texts || [];
  state.stickers = t.stickers || [];
  state.drawings = t.drawings || [];
  state.selectedTextId = null;
  state.selectedStickerId = null;

  document.getElementById("aspectRatio").value = state.aspectRatio;
  
  if (t.imageSrc) {
    const img = new Image();
    img.onload = () => { 
      state.image = img; 
      document.getElementById("uploadPlaceholder").style.display = "none";
      updateCanvasSize(); 
    };
    img.src = t.imageSrc;
  } else {
    state.image = null; 
    document.getElementById("uploadPlaceholder").style.display = "flex";
    updateCanvasSize();
  }
}

export function renderTemplateList() {
  const listEl = document.getElementById("templateList");
  const modal = document.getElementById("templateModal");
  const templates = getTemplates();
  listEl.innerHTML = "";
  
  if (templates.length === 0) {
    listEl.innerHTML = '<li style="justify-content:center;">저장된 템플릿이 없습니다.</li>';
    return;
  }

  templates.forEach(t => {
    const li = document.createElement("li");
    li.innerHTML = `
      <span>${t.name}</span>
      <div>
        <button class="load-btn" data-id="${t.id}">불러오기</button>
      </div>
    `;
    listEl.appendChild(li);
  });

  listEl.querySelectorAll(".load-btn").forEach(btn => {
    btn.addEventListener("click", (e) => {
      loadTemplate(e.target.dataset.id);
      modal.classList.remove("open");
    });
  });
}