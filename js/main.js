import {
  state,
  canvas,
  render,
  updateCanvasSize,
  setStatus
} from "./state.js";

import {
  handleFile
} from "./file-validation.js";

import {
  createTemplate,
  openTemplateModal,
  closeTemplateModal
} from "./template.js";

// ======================================
// 1. 기본 설정
// ======================================

const $ = id => document.getElementById(id);

let activeTool = "text";
let drag = null;

const history = [];
const HISTORY_LIMIT = 30;

// ======================================
// 2. 편집 기록 저장
// ======================================

function snapshot() {
  return {
    texts: structuredClone(state.texts),
    drawings: structuredClone(state.drawings),
    imageX: state.imageX,
    imageY: state.imageY,
    imageScale: state.imageScale,
    background: state.background
  };
}

function remember() {
  history.push(snapshot());

  if (history.length > HISTORY_LIMIT) {
    history.shift();
  }
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

  $("imageScale").value = String(
    Math.round(state.imageScale * 100)
  );

  $("bgColor").value = state.background;

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
    x,
    y,
    fontSize: Number($("fontSize").value),
    fontFamily: $("fontFamily").value,
    color: $("colorInput").value
  };

  state.texts.push(item);

  state.selectedTextId = item.id;

  render();

  setStatus("문구를 추가했습니다.");
}

// ======================================
// 6. 선택된 문구 찾기
// ======================================

function selectedText() {
  return state.texts.find(
    text => text.id === state.selectedTextId
  ) || null;
}

function pickText(x, y) {
  return [...state.texts].reverse().find(text => {
    const width = Math.min(
      48,
      Math.max(
        7,
        String(text.text).length *
        text.fontSize / canvas.width * 45
      )
    );

    const height = Math.max(
      4,
      text.fontSize / canvas.height * 70
    );

    return (
      Math.abs(text.x - x) <= width &&
      Math.abs(text.y - y) <= height
    );
  });
}

// ======================================
// 7. 문구 설정 동기화
// ======================================

function syncTextControls(text) {
  $("textInput").value = text.text;

  $("fontSize").value = String(text.fontSize);

  $("fontSizeValue").textContent =
    String(text.fontSize);

  $("colorInput").value = text.color;

  $("fontFamily").value = text.fontFamily;
}

// ======================================
// 8. 도구 선택
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
      const selected = btn === button;

      btn.classList.toggle("active", selected);

      if (btn.dataset.tool !== "undo") {
        btn.setAttribute(
          "aria-pressed",
          String(selected)
        );
      }
    });

    document.querySelectorAll(".opt-content").forEach(panel => {
      panel.classList.toggle(
        "active",
        panel.id === `opt-${tool}`
      );
    });
  });
});

// ======================================
// 9. 문구 추가 버튼
// ======================================

$("addTextBtn").addEventListener("click", () => {
  addText($("textInput").value);
});

// ======================================
// 10. 문구 내용 수정
// ======================================

$("textInput").addEventListener("input", event => {
  const text = selectedText();

  if (!text) return;

  text.text = event.target.value.slice(0, 300);

  render();
});

// ======================================
// 11. 글자 크기
// ======================================

$("fontSize").addEventListener("input", event => {
  $("fontSizeValue").textContent = event.target.value;

  const text = selectedText();

  if (text) {
    text.fontSize = Number(event.target.value);
    render();
  }
});

// ======================================
// 12. 글자 색상
// ======================================

$("colorInput").addEventListener("input", event => {
  const text = selectedText();

  if (text) {
    text.color = event.target.value;
    render();
  }
});

// ======================================
// 13. 글꼴 변경
// ======================================

$("fontFamily").addEventListener("change", event => {
  const text = selectedText();

  if (text) {
    text.fontFamily = event.target.value;
    render();
  }
});

// ======================================
// 14. 이미지 설정
// ======================================

$("bgColor").addEventListener("input", event => {
  state.background = event.target.value;
  render();
});

$("imageScale").addEventListener("input", event => {
  state.imageScale = Number(event.target.value) / 100;
  render();
});

// ======================================
// 15. 이미지 업로드
// ======================================

$("btnInput").addEventListener("click", () => {
  $("fileInput").click();
});

$("uploadPlaceholder").addEventListener("click", () => {
  $("fileInput").click();
});

$("fileInput").addEventListener("change", async event => {
  const file = event.target.files?.[0];

  if (file) {
    await handleFile(file);
  }

  event.target.value = "";
});

// ======================================
// 16. 화면비 변경
// ======================================

$("aspectRatio").addEventListener("change", event => {
  state.aspectRatio = event.target.value;
  updateCanvasSize();
});

// ======================================
// 17. 확대·축소
// ======================================

$("zoomInBtn").addEventListener("click", () => {
  state.zoomLevel = Math.min(
    2,
    state.zoomLevel + 0.1
  );

  updateCanvasSize();
});

$("zoomOutBtn").addEventListener("click", () => {
  state.zoomLevel = Math.max(
    0.5,
    state.zoomLevel - 0.1
  );

  updateCanvasSize();
});

// ======================================
// 18. 캔버스 편집 시작
// ======================================

canvas.addEventListener("pointerdown", event => {
  if (event.button !== 0) return;

  const point = getCoords(event);

  // 문구 이동 및 선택
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
      addText(
        $("textInput").value,
        point.x,
        point.y
      );
    }
  }

  // 그림 그리기
  else if (activeTool === "draw") {
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
  }

  // 이미지 이동
  else if (activeTool === "image" && state.image) {
    remember();

    drag = {
      type: "image",
      offsetX: point.x - state.imageX,
      offsetY: point.y - state.imageY
    };

    canvas.setPointerCapture(event.pointerId);
  }
});

// ======================================
// 19. 드래그 이동
// ======================================

canvas.addEventListener("pointermove", event => {
  if (!drag) return;

  const point = getCoords(event);

  if (drag.type === "text") {
    drag.target.x = point.x - drag.offsetX;
    drag.target.y = point.y - drag.offsetY;
  }

  else if (drag.type === "draw") {
    drag.target.points.push(point);
  }

  else if (drag.type === "image") {
    state.imageX = point.x - drag.offsetX;
    state.imageY = point.y - drag.offsetY;
  }

  render();
});

// ======================================
// 20. 드래그 종료
// ======================================

function stopDrag() {
  drag = null;
}

canvas.addEventListener("pointerup", stopDrag);
canvas.addEventListener("pointercancel", stopDrag);

// ======================================
// 21. SAVE - 템플릿 관리
// ======================================

// SAVE 버튼은 관리 창을 엽니다.
$("btnSave").addEventListener("click", () => {
  openTemplateModal();
});

// 새 템플릿 생성
$("createTemplateBtn").addEventListener("click", () => {
  createTemplate();
});

// 템플릿 창 닫기
$("closeModalBtn").addEventListener("click", () => {
  closeTemplateModal();
});

// 바깥 영역 클릭 시 닫기
$("templateModal").addEventListener("click", event => {
  if (event.target === $("templateModal")) {
    closeTemplateModal();
  }
});

// ESC 키
document.addEventListener("keydown", event => {
  if (event.key === "Escape") {
    closeTemplateModal();
  }
});

// ======================================
// 22. OUTPUT - PNG 다운로드
// ======================================

$("btnOutput").addEventListener("click", () => {
  render();

  canvas.toBlob(blob => {
    if (!blob) {
      setStatus(
        "PNG 파일을 생성하지 못했습니다.",
        true
      );
      return;
    }

    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");

    link.href = url;

    link.download = `card-studio-${Date.now()}.png`;

    document.body.appendChild(link);

    link.click();

    link.remove();

    setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 1000);

    setStatus(
      "PNG 파일 다운로드가 시작되었습니다."
    );

  }, "image/png");
});

// ======================================
// 23. 초기 실행
// ======================================

window.addEventListener("resize", updateCanvasSize);

updateCanvasSize();