import {
  state,
  updateCanvasSize,
  setStatus
} from "./state.js";

// ======================================
// 1. 저장소 설정
// ======================================

const STORAGE_KEY = "zzal_card_templates_v2";
const LEGACY_KEY = "zzal_card_templates";

const $ = id => document.getElementById(id);

let currentTemplateId = null;

function clone(value) {
  return structuredClone(value);
}

// ======================================
// 2. 저장된 템플릿 가져오기
// ======================================

export function getTemplates() {
  try {
    const raw =
      localStorage.getItem(STORAGE_KEY) ??
      localStorage.getItem(LEGACY_KEY) ??
      "[]";

    const templates = JSON.parse(raw);

    return Array.isArray(templates) ? templates : [];

  } catch (error) {
    console.error("템플릿 읽기 오류:", error);
    return [];
  }
}

// ======================================
// 3. 템플릿 목록 저장
// ======================================

function saveTemplates(templates) {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(templates)
    );

    return true;

  } catch (error) {
    console.error("템플릿 저장 오류:", error);

    setStatus(
      "브라우저 저장 공간이 부족하거나 저장이 차단되었습니다.",
      true
    );

    return false;
  }
}

// ======================================
// 4. 이미지 저장 데이터 생성
// ======================================

function imageToData(image) {
  if (!image) return null;

  const tempCanvas = document.createElement("canvas");

  const maxSide = 1400;

  const scale = Math.min(
    1,
    maxSide / Math.max(
      image.naturalWidth,
      image.naturalHeight
    )
  );

  tempCanvas.width = Math.max(
    1,
    Math.round(image.naturalWidth * scale)
  );

  tempCanvas.height = Math.max(
    1,
    Math.round(image.naturalHeight * scale)
  );

  const tempCtx = tempCanvas.getContext("2d");

  tempCtx.drawImage(
    image,
    0,
    0,
    tempCanvas.width,
    tempCanvas.height
  );

  return tempCanvas.toDataURL("image/jpeg", 0.8);
}

// ======================================
// 5. 현재 편집 상태 복사
// ======================================

function getCurrentState() {
  return {
    aspectRatio: state.aspectRatio,

    texts: clone(state.texts),

    drawings: clone(state.drawings),

    stickers: clone(state.stickers),

    imageData: imageToData(state.image),

    imageScale: state.imageScale,

    imageX: state.imageX,
    imageY: state.imageY,

    background: state.background
  };
}

// ======================================
// 6. 템플릿 생성
// ======================================

export function createTemplate() {
  const templates = getTemplates();

  const input = prompt(
    "템플릿 이름을 입력하세요.",
    `템플릿 ${templates.length + 1}`
  );

  if (input === null) return;

  const name = input.trim().slice(0, 50);

  if (!name) {
    setStatus(
      "템플릿 이름을 입력해야 합니다.",
      true
    );
    return;
  }

  try {
    const id = crypto.randomUUID();

    const now = new Date().toISOString();

    const newTemplate = {
      id,
      name,
      createdAt: now,
      updatedAt: now,
      ...getCurrentState()
    };

    const updated = [...templates, newTemplate];

    if (!saveTemplates(updated)) return;

    currentTemplateId = id;

    setStatus(
      `"${name}" 템플릿을 저장했습니다.`
    );

    renderTemplateList();

  } catch (error) {
    console.error(error);

    setStatus(
      "템플릿 생성에 실패했습니다.",
      true
    );
  }
}

// ======================================
// 7. 템플릿 불러오기
// ======================================

export async function loadTemplate(id) {
  const template = getTemplates().find(
    item => item.id === id
  );

  if (!template) {
    setStatus(
      "템플릿을 찾을 수 없습니다.",
      true
    );
    return false;
  }

  try {
    let image = null;

    const source =
      template.imageData || template.imageSrc;

    if (source) {
      if (
        !/^data:image\/(png|jpeg);base64,/i.test(source)
      ) {
        throw new Error("지원하지 않는 이미지 데이터");
      }

      image = new Image();

      await new Promise((resolve, reject) => {
        image.onload = resolve;
        image.onerror = reject;
        image.src = source;
      });
    }

    // 이미지 복원이 성공한 뒤 상태 변경
    const allowedRatios = ["1:1", "4:5", "16:9"];

    state.image = image;

    state.aspectRatio =
      allowedRatios.includes(template.aspectRatio)
        ? template.aspectRatio
        : "1:1";

    state.texts = clone(
      Array.isArray(template.texts)
        ? template.texts
        : []
    );

    state.drawings = clone(
      Array.isArray(template.drawings)
        ? template.drawings
        : []
    );

    state.stickers = clone(
      Array.isArray(template.stickers)
        ? template.stickers
        : []
    );

    state.selectedTextId = null;
    state.selectedStickerId = null;

    state.imageScale =
      Number.isFinite(template.imageScale)
        ? template.imageScale
        : 1;

    state.imageX =
      Number.isFinite(template.imageX)
        ? template.imageX
        : 50;

    state.imageY =
      Number.isFinite(template.imageY)
        ? template.imageY
        : 50;

    state.background =
      /^#[0-9a-f]{6}$/i.test(template.background || "")
        ? template.background
        : "#222b42";

    currentTemplateId = id;

    // HTML 설정값 복원
    $("aspectRatio").value = state.aspectRatio;
    $("bgColor").value = state.background;

    $("imageScale").value = String(
      Math.round(state.imageScale * 100)
    );

    $("uploadPlaceholder").style.display =
      image ? "none" : "flex";

    updateCanvasSize();

    setStatus(
      `"${template.name}" 템플릿을 불러왔습니다.`
    );

    return true;

  } catch (error) {
    console.error(error);

    setStatus(
      "템플릿을 복원하지 못했습니다. 기존 작업은 유지됩니다.",
      true
    );

    return false;
  }
}

// ======================================
// 8. 템플릿 수정
// ======================================

export function updateTemplate(id = currentTemplateId) {
  if (!id) {
    setStatus(
      "수정할 템플릿을 먼저 선택하세요.",
      true
    );
    return;
  }

  const templates = getTemplates();

  const index = templates.findIndex(
    item => item.id === id
  );

  if (index === -1) {
    setStatus(
      "수정할 템플릿이 없습니다.",
      true
    );
    return;
  }

  try {
    templates[index] = {
      ...templates[index],
      ...getCurrentState(),
      updatedAt: new Date().toISOString()
    };

    if (!saveTemplates(templates)) return;

    currentTemplateId = id;

    setStatus(
      `"${templates[index].name}" 템플릿을 수정했습니다.`
    );

    renderTemplateList();

  } catch (error) {
    console.error(error);

    setStatus(
      "템플릿 수정에 실패했습니다.",
      true
    );
  }
}

// ======================================
// 9. 템플릿 삭제
// ======================================

export function deleteTemplate(id) {
  const templates = getTemplates();

  const target = templates.find(
    item => item.id === id
  );

  if (!target) return;

  const confirmed = confirm(
    `"${target.name}" 템플릿을 삭제하시겠습니까?`
  );

  if (!confirmed) return;

  const remaining = templates.filter(
    item => item.id !== id
  );

  if (!saveTemplates(remaining)) return;

  if (currentTemplateId === id) {
    currentTemplateId = null;
  }

  setStatus(
    `"${target.name}" 템플릿을 삭제했습니다.`
  );

  renderTemplateList();
}

// ======================================
// 10. 템플릿 목록 표시
// ======================================

export function renderTemplateList() {
  const list = $("templateList");

  list.replaceChildren();

  const templates = getTemplates();

  if (!templates.length) {
    const li = document.createElement("li");

    li.textContent = "저장된 템플릿이 없습니다.";

    list.appendChild(li);
    return;
  }

  templates.forEach(template => {
    const li = document.createElement("li");

    const name = document.createElement("span");
    name.textContent = template.name;

    const buttons = document.createElement("div");
    buttons.className = "template-buttons";

    // 불러오기
    const loadButton = document.createElement("button");
    loadButton.textContent = "불러오기";

    loadButton.addEventListener("click", async () => {
      const success = await loadTemplate(template.id);

      if (success) {
        closeTemplateModal();
      }
    });

    // 수정
    const updateButton = document.createElement("button");
    updateButton.textContent = "수정";

    updateButton.addEventListener("click", () => {
      const confirmed = confirm(
        `현재 편집 상태로 "${template.name}"을 덮어쓰시겠습니까?`
      );

      if (confirmed) {
        updateTemplate(template.id);
      }
    });

    // 삭제
    const deleteButton = document.createElement("button");
    deleteButton.textContent = "삭제";
    deleteButton.className = "delete-btn";

    deleteButton.addEventListener("click", () => {
      deleteTemplate(template.id);
    });

    buttons.append(
      loadButton,
      updateButton,
      deleteButton
    );

    li.append(name, buttons);

    list.appendChild(li);
  });
}

// ======================================
// 11. 템플릿 창 열기
// ======================================

export function openTemplateModal() {
  renderTemplateList();

  $("templateModal").classList.add("open");

  $("templateModal").setAttribute(
    "aria-hidden",
    "false"
  );
}

// ======================================
// 12. 템플릿 창 닫기
// ======================================

export function closeTemplateModal() {
  $("templateModal").classList.remove("open");

  $("templateModal").setAttribute(
    "aria-hidden",
    "true"
  );
}