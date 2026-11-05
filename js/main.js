import {ndo
  state,
  canvas,
  render,
  updateCanvasSize,
  setStatus,
  measureTextLayout
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
  deleteCustomSticker,
  addCustomFont,
  restoreCustomFonts
} from "./assets-library.js";

import { BUILTIN_STICKERS } from "./sticker-assets.js";

// ======================================
// 1. 기본 설정
// ======================================

const $ = id => document.getElementById(id);

let activeTool = "text";
let drag = null;
let selectedStickerData = null;

const history = [];
const HISTORY_LIMIT = 30;

// ======================================
// 2. 편집 기록 저장 (Undo)
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
    frameType: state.frameType || "none",

    // 사진 분할 상태 저장
    splitLayout: state.splitLayout,
    splitImages: [...(state.splitImages || [])]
  };
}

function remember() {
  history.push(snapshot());

  if (history.length > HISTORY_LIMIT) {
    history.shift();
  }
}

function undo() {
  const previous = history.pop();

  if (!previous) {
    setStatus("되돌릴 작업이 없습니다.");
    return;
  }

  Object.assign(state, previous);

  state.selectedTextId = null;
  state.selectedStickerId = null;

  // 이미지 설정 복원
  $("imageScale").value =
    String(Math.round(state.imageScale * 100));

  $("bgColor").value = state.background;
  $("frameType").value = state.frameType || "none";

  // 사진 분할 레이아웃 화면 복원
  syncSplitLayoutUI();

  render();

  setStatus("이전 편집 상태로 되돌렸습니다.");
}

// ======================================
// 편집 조작당 Undo 기록을 한 번만 저장
// ======================================

function bindUndoStart(element, condition = () => true) {
  if (!element) return;

  let isRecorded = false;

  const startEdit = () => {
    if (isRecorded) return;
    if (!condition()) return;

    remember();

    isRecorded = true;
  };

  const finishEdit = () => {
    isRecorded = false;
  };

  element.addEventListener("pointerdown", startEdit);
  element.addEventListener("keydown", startEdit);

  // 실제 변경이 끝났거나 입력창에서 벗어났을 때 초기화
  element.addEventListener("change", finishEdit);
  element.addEventListener("blur", finishEdit);
  element.addEventListener("pointercancel", finishEdit);
}

// ======================================
// 3. 캔버스 좌표 계산
// ======================================

function getCoords(event) {
  const rect = canvas.getBoundingClientRect();

  return {
    x: (event.clientX - rect.left) / rect.width * 100,
    y: (event.clientY - rect.top) / rect.height * 100
  };
}

// ======================================
// 4. 도구 선택
// ======================================

document.querySelectorAll(".tool-btn").forEach(button => {
  button.addEventListener("click", () => {
    const tool = button.dataset.tool;

    if (tool === "undo") {
      undo();
      return;
    }

    activeTool = tool;

    document.querySelectorAll(".tool-btn").forEach(btn => {
      const isSelected = btn === button;

      btn.classList.toggle("active", isSelected);

      if (btn.dataset.tool !== "undo") {
        btn.setAttribute("aria-pressed", String(isSelected));
      }
    });

    document.querySelectorAll(".opt-content").forEach(panel => {
      panel.classList.toggle(
        "active",
        panel.id === `opt-${tool}`
      );
    });

    if (tool === "draw") {
      canvas.style.cursor = "crosshair";
    } else if (tool === "text") {
      canvas.style.cursor = "text";
    } else {
      canvas.style.cursor = "default";
    }

    setStatus(
      `"${button.querySelector("span").textContent}" 도구가 활성화되었습니다.`
    );
  });
});

// ======================================
// 5. 문구 추가 및 동기화
// ======================================

function addText(value, x = 50, y = 50) {
  const originalText = String(value ?? "");

  // 공백만 입력한 경우에만 추가를 막음
  if (!originalText.trim()) {
    setStatus("문구를 입력해 주세요.", true);
    return;
  }

  remember();

  const item = {
    id: crypto.randomUUID(),

    // 앞뒤 공백과 직접 입력한 줄바꿈을 유지
    text: originalText.slice(0, 300),

    x,
    y,
    fontSize: Number($("fontSize").value),
    fontFamily: $("fontFamily").value,
    color: $("colorInput").value,
    bold: $("fontBold").checked
  };

  state.texts.push(item);
  state.selectedTextId = item.id;

  render();
  setStatus("문구를 추가했습니다.");
}

function selectedText() {
  return state.texts.find(
    text => text.id === state.selectedTextId
  ) || null;
}

// ======================================
// 6. 실제 텍스트 영역으로 선택
// ======================================

function pickText(x, y) {
  // 마우스 좌표는 퍼센트이므로 실제 캔버스 픽셀로 변환
  const pointerX = x * canvas.width / 100;
  const pointerY = y * canvas.height / 100;

  // 나중에 추가한 텍스트부터 선택
  return [...state.texts].reverse().find(text => {
    const layout = measureTextLayout(text);
    const bounds = layout.bounds;

    // 글자 외곽을 조금 더 쉽게 선택할 수 있도록 여유 공간 추가
    const padding = Math.max(6, layout.fontSize * 0.12);

    return (
      pointerX >= bounds.left - padding &&
      pointerX <= bounds.right + padding &&
      pointerY >= bounds.top - padding &&
      pointerY <= bounds.bottom + padding
    );
  });
}

function syncTextControls(text) {
  $("textInput").value = text.text;
  $("fontSize").value = String(text.fontSize);
  $("fontSizeValue").textContent = String(text.fontSize);
  $("colorInput").value = text.color;
  $("fontFamily").value = text.fontFamily;
  $("fontBold").checked = text.bold || false;
}

// ======================================
// 7. 스티커 패널 동적 렌더링
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

    let items = BUILTIN_STICKERS[cat.key] || [];

    if (cat.key === "custom") {
      items = getCustomStickers();
    }

    items.forEach(item => {
      // 스티커와 삭제 버튼을 담는 별도 영역
      const wrapper = document.createElement("div");

      wrapper.className = "sticker-card";

      // 스티커 선택 버튼
      const btn = document.createElement("button");

      btn.type = "button";
      btn.className = "sticker-item";

      if (item.kind === "emoji") {
        btn.textContent = item.emoji;
      } else if (item.kind === "speech") {
        btn.textContent = item.text;
        btn.classList.add("speech-bubble");
      } else if (item.kind === "image") {
        const img = document.createElement("img");

        img.src = item.src;
        img.alt = item.name || "사용자 스티커";

        btn.appendChild(img);
      }

      btn.addEventListener("click", () => {
        selectedStickerData = item;

        state.selectedStickerId = null;

        activeTool = "sticker";

        document.querySelectorAll(".tool-btn").forEach(toolBtn => {
          const isSelected =
            toolBtn.dataset.tool === "sticker";

          toolBtn.classList.toggle("active", isSelected);

          if (toolBtn.dataset.tool !== "undo") {
            toolBtn.setAttribute(
              "aria-pressed",
              String(isSelected)
            );
          }
        });

        document.querySelectorAll(".opt-content").forEach(panel => {
          panel.classList.toggle(
            "active",
            panel.id === "opt-sticker"
          );
        });

        document.querySelectorAll(".sticker-item").forEach(stickerBtn => {
          stickerBtn.classList.remove("selected");
        });

        btn.classList.add("selected");

        setStatus(
          `"${item.name}" 스티커를 선택했습니다. 이미지를 클릭해 붙여보세요.`
        );
      });

      wrapper.appendChild(btn);

      // 커스텀 스티커 삭제 버튼
      if (cat.key === "custom") {
        const delBtn = document.createElement("button");

        delBtn.type = "button";
        delBtn.className = "custom-sticker-delete";

        delBtn.textContent = "✕";
        delBtn.title = "이 스티커 삭제";
        delBtn.setAttribute("aria-label", `${item.name} 스티커 삭제`);

        delBtn.addEventListener("click", e => {
          e.stopPropagation();

          if (
            confirm(`"${item.name}" 스티커를 삭제하시겠습니까?`)
          ) {
            deleteCustomSticker(item.id);

            renderStickerPanel();

            setStatus("커스텀 스티커가 삭제되었습니다.");
          }
        });

        wrapper.appendChild(delBtn);
      }

      container.appendChild(wrapper);
    });

    grid.appendChild(container);
  });
}

// ======================================
// 8. 스티커 추가 및 선택
// ======================================

function addSticker(x, y) {
  if (!selectedStickerData) {
    setStatus(
      "먼저 스티커 창에서 스티커를 선택해 주세요.",
      true
    );
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

  if (selectedStickerData.kind === "emoji") {
    sticker.emoji = selectedStickerData.emoji;
  } else if (selectedStickerData.kind === "speech") {
    sticker.text = selectedStickerData.text;
  } else if (selectedStickerData.kind === "image") {
    sticker.src = selectedStickerData.src;
  }

  state.stickers.push(sticker);
  state.selectedStickerId = sticker.id;

  render();
  setStatus("스티커를 추가했습니다.");
}

function pickSticker(x, y) {
  return [...state.stickers].reverse().find(sticker => {
    const width = sticker.size / canvas.width * 100;
    const height = sticker.size / canvas.height * 100;

    return (
      Math.abs(sticker.x - x) <= width / 2 &&
      Math.abs(sticker.y - y) <= height / 2
    );
  });
}

// ======================================
// 9. 스티커 설정 이벤트
// ======================================

$("stickerSize").addEventListener("change", e => {
  const sticker = state.stickers.find(
    s => s.id === state.selectedStickerId
  );

  if (!sticker) return;

  remember();
  sticker.size = Number(e.target.value);

  render();
});

// 스티커 회전 변경 전 Undo 기록
bindUndoStart(
  $("stickerRotation"),
  () => !!state.stickers.find(
    s => s.id === state.selectedStickerId
  )
);

// 스티커 회전 실시간 변경
$("stickerRotation")?.addEventListener("input", e => {
  const sticker = state.stickers.find(
    s => s.id === state.selectedStickerId
  );

  if (!sticker) return;

  sticker.rotation = Number(e.target.value);

  render();
});

// 스티커 회전 조작 종료
$("stickerRotation")?.addEventListener("change", () => {
  const sticker = state.stickers.find(
    s => s.id === state.selectedStickerId
  );

  if (!sticker) return;

  setStatus("스티커를 회전했습니다.");
});

$("deleteStickerBtn").addEventListener("click", () => {
  if (!state.selectedStickerId) {
    setStatus("삭제할 스티커를 먼저 선택하세요.", true);
    return;
  }

  remember();

  state.stickers = state.stickers.filter(
    s => s.id !== state.selectedStickerId
  );

  state.selectedStickerId = null;

  render();
  setStatus("선택한 스티커를 삭제했습니다.");
});

$("clearAllStickersBtn")?.addEventListener("click", () => {
  if (state.stickers.length === 0) {
    setStatus("삭제할 스티커가 없습니다.", true);
    return;
  }

  if (!confirm("캔버스에 붙인 모든 스티커를 삭제하시겠습니까?")) {
    return;
  }

  remember();

  state.stickers = [];
  state.selectedStickerId = null;

  render();
  setStatus("캔버스의 모든 스티커를 삭제했습니다.");
});

// ======================================
// 10. 텍스트 설정 이벤트
// ======================================

// 텍스트 입력 전 Undo 기록
bindUndoStart($("textInput"), () => !!selectedText());

// 글자 크기 변경 전 Undo 기록
bindUndoStart($("fontSize"), () => !!selectedText());

// 글자 색상 변경 전 Undo 기록
bindUndoStart($("colorInput"), () => !!selectedText());

// 텍스트 추가
$("addTextBtn").addEventListener("click", () => {
  addText($("textInput").value);
});

// 텍스트 내용 실시간 수정
$("textInput").addEventListener("input", e => {
  const text = selectedText();

  if (!text) return;

  text.text = e.target.value.slice(0, 300);

  render();
});

// 글자 크기 변경
$("fontSize").addEventListener("input", e => {
  $("fontSizeValue").textContent = e.target.value;

  const text = selectedText();

  if (!text) return;

  text.fontSize = Number(e.target.value);

  render();
});

// 글자 색상 변경
$("colorInput").addEventListener("input", e => {
  const text = selectedText();

  if (!text) return;

  text.color = e.target.value;

  render();
});

// 글꼴 변경
$("fontFamily").addEventListener("change", e => {
  const text = selectedText();

  if (!text) return;

  remember();

  text.fontFamily = e.target.value;

  render();
});

// 굵게 설정
$("fontBold").addEventListener("change", e => {
  const text = selectedText();

  if (!text) return;

  remember();

  text.bold = e.target.checked;

  render();
});

// ======================================
// 11. 이미지 설정
// ======================================

$("bgColor").addEventListener("input", e => {
  state.background = e.target.value;
  render();
});

$("imageScale").addEventListener("input", e => {
  state.imageScale = Number(e.target.value) / 100;
  render();
});

$("frameType").addEventListener("change", e => {
  state.frameType = e.target.value;
  render();
});

// ======================================
// 12. 이미지 업로드 및 분할
// ======================================

const fileInput = $("fileInput");
const uploadPlaceholder = $("uploadPlaceholder");
const btnInput = $("btnInput");

btnInput?.addEventListener("click", () => fileInput?.click());

uploadPlaceholder?.addEventListener("click", () => fileInput?.click());

fileInput?.addEventListener("change", async e => {
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

// ======================================
// 13. 커스텀 스티커/폰트 추가
// ======================================

$("customStickerInput")?.addEventListener("change", async e => {
  const file = e.target.files?.[0];

  if (file) {
    try {
      await addCustomSticker(file);
      renderStickerPanel();
      setStatus("커스텀 스티커가 추가되었습니다.");
    } catch (err) {
      setStatus(err.message, true);
    }
  }

  e.target.value = "";
});

// ======================================
// 14. 화면비 및 줌 컨트롤
// ======================================

$("aspectRatio").addEventListener("change", e => {
  state.aspectRatio = e.target.value;
  updateCanvasSize();
});

$("zoomInBtn").addEventListener("click", () => {
  if (state.zoomLevel < 2.0) {
    state.zoomLevel += 0.1;
    updateCanvasSize();
  }
});

$("zoomOutBtn").addEventListener("click", () => {
  if (state.zoomLevel > 0.5) {
    state.zoomLevel -= 0.1;
    updateCanvasSize();
  }
});

// ======================================
// 15. 캔버스 마우스/터치 이벤트
// ======================================

canvas.addEventListener("pointerdown", event => {
  if (event.button !== 0) return;

  const point = getCoords(event);

  // 그리기 도구
  if (activeTool === "draw") {
    remember();

    const stroke = {
      points: [point],
      color: $("brushColor").value,
      size: Number($("brushSize").value),
      type: $("brushType").value
    };

    state.drawings.push(stroke);

    drag = {
      type: "draw",
      target: stroke
    };

    canvas.setPointerCapture(event.pointerId);
    render();
    return;
  }

  // 문구 도구
  if (activeTool === "text") {
    const text = pickText(point.x, point.y);

    if (text) {
      remember();

      state.selectedTextId = text.id;
      syncTextControls(text);

      drag = {
        type: "text",
        target: text,
        offsetX: point.x - text.x,
        offsetY: point.y - text.y
      };

      canvas.setPointerCapture(event.pointerId);
    } else {
      addText($("textInput").value, point.x, point.y);
    }

    return;
  }

  // 스티커 도구
  if (activeTool === "sticker") {
    const sticker = pickSticker(point.x, point.y);

    if (sticker) {
      remember();

      state.selectedStickerId = sticker.id;

      $("stickerSize").value = String(sticker.size);
      $("stickerRotation").value =
        String(sticker.rotation || 0);

      drag = {
        type: "sticker",
        target: sticker,
        offsetX: point.x - sticker.x,
        offsetY: point.y - sticker.y
      };

      canvas.setPointerCapture(event.pointerId);
    } else {
      addSticker(point.x, point.y);
    }

    return;
  }

  // 이미지 도구
  if (activeTool === "image" && state.image) {
    remember();

    drag = {
      type: "image",
      offsetX: point.x - state.imageX,
      offsetY: point.y - state.imageY
    };

    canvas.setPointerCapture(event.pointerId);
    return;
  }
});

canvas.addEventListener("pointermove", event => {
  if (!drag) return;

  const point = getCoords(event);

  if (drag.type === "text") {
    drag.target.x = point.x - drag.offsetX;
    drag.target.y = point.y - drag.offsetY;
  } else if (drag.type === "draw") {
    drag.target.points.push(point);
  } else if (drag.type === "sticker") {
    drag.target.x = point.x - drag.offsetX;
    drag.target.y = point.y - drag.offsetY;
  } else if (drag.type === "image") {
    state.imageX = point.x - drag.offsetX;
    state.imageY = point.y - drag.offsetY;
  }

  render();
});

function stopDrag() {
  drag = null;
}

canvas.addEventListener("pointerup", stopDrag);
canvas.addEventListener("pointercancel", stopDrag);

// ======================================
// 16. SAVE / JSON / OUTPUT
// ======================================

$("btnSave").addEventListener("click", openTemplateModal);

$("createTemplateBtn").addEventListener("click", createTemplate);

$("closeModalBtn").addEventListener("click", closeTemplateModal);

$("templateModal").addEventListener("click", e => {
  if (e.target === $("templateModal")) {
    closeTemplateModal();
  }
});

document.addEventListener("keydown", e => {
  if (e.key === "Escape") {
    closeTemplateModal();
  }
});

$("btnSaveJson")?.addEventListener("click", exportToJson);

$("jsonFileInput")?.addEventListener("change", e => {
  const file = e.target.files?.[0];

  if (file) {
    importFromJson(file);
  }

  e.target.value = "";
});

$("btnOutput").addEventListener("click", () => {
  render();

  const format =
    $("outputFormat")?.value || "image/png";

  const ext =
    format === "image/jpeg"
      ? "jpg"
      : format === "image/webp"
        ? "webp"
        : "png";

  canvas.toBlob(
    blob => {
      if (!blob) {
        setStatus("파일 생성 실패", true);
        return;
      }

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");

      link.href = url;
      link.download = `card-studio-${Date.now()}.${ext}`;

      document.body.appendChild(link);
      link.click();
      link.remove();

      setTimeout(() => URL.revokeObjectURL(url), 1000);

      setStatus(
        `${ext.toUpperCase()} 파일 다운로드가 시작되었습니다.`
      );
    },
    format,
    format === "image/jpeg" || format === "image/webp"
      ? 0.9
      : undefined
  );
});

// ======================================
// 17. 사진 분할 레이아웃
// ======================================

const splitOverlay = $("splitOverlay");
const splitZoneBtns =
  document.querySelectorAll(".split-zone-btn");

const slotFileInput = $("slotFileInput");

let currentSlotIndex = 0;

function setLayout(layout) {
  if (state.splitLayout === layout) return;

  remember();

  state.splitLayout = layout;

  state.splitImages = [null, null, null, null];

  syncSplitLayoutUI();

  render();

  setStatus(`${layout}칸 사진 분할 레이아웃으로 변경했습니다.`);
}

// 사진 분할 레이아웃 화면 동기화
function syncSplitLayoutUI() {
  const layout = state.splitLayout || 1;

  splitOverlay.className = "split-overlay";

  if (layout === 2) {
    splitOverlay.classList.add("mode-2");
  }

  if (layout === 4) {
    splitOverlay.classList.add("mode-4");
  }

  if (layout === 1) {
    splitOverlay.style.display = "none";
    uploadPlaceholder.style.display = "flex";
  } else {
    splitOverlay.style.display = "grid";
    uploadPlaceholder.style.display = "none";
  }

  $("layout1Btn").style.background =
    layout === 1 ? "#bfdbfe" : "#e6efff";

  $("layout2Btn").style.background =
    layout === 2 ? "#bfdbfe" : "#e6efff";

  $("layout4Btn").style.background =
    layout === 4 ? "#bfdbfe" : "#e6efff";
}

$("layout1Btn")?.addEventListener("click", () => setLayout(1));
$("layout2Btn")?.addEventListener("click", () => setLayout(2));
$("layout4Btn")?.addEventListener("click", () => setLayout(4));

splitZoneBtns.forEach(btn => {
  btn.addEventListener("click", e => {
    e.stopPropagation();

    currentSlotIndex = Number(btn.dataset.slot);
    slotFileInput.click();
  });
});

slotFileInput?.addEventListener("change", e => {
  const file = e.target.files?.[0];

  if (!file) return;
  remember();

  const url = URL.createObjectURL(file);
  const img = new Image();

  img.onload = () => {
    state.splitImages[currentSlotIndex] = img;

    render();

    setStatus(
      `${currentSlotIndex + 1}번째 칸에 사진이 추가되었습니다.`
    );

    URL.revokeObjectURL(url);
  };

  img.onerror = () => {
    setStatus("이미지를 불러오지 못했습니다.", true);
    URL.revokeObjectURL(url);
  };

  img.src = url;
  e.target.value = "";
});

// ======================================
// 18. 초기 실행
// ======================================

$("frameType").value = state.frameType || "none";

renderStickerPanel();
restoreCustomFonts();

window.addEventListener("resize", updateCanvasSize);

updateCanvasSize();