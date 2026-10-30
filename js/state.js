// ======================================
// 1. 편집 상태
// ======================================

export const state = {
  image: null,
  aspectRatio: "1:1",
  zoomLevel: 1,

  texts: [],
  drawings: [],
  stickers: [],

  selectedTextId: null,
  selectedStickerId: null,

  imageScale: 1,
  imageX: 50,
  imageY: 50,

  background: "#222b42"
};

// ======================================
// 2. 이미지 제한
// ======================================

export const LIMITS = {
  MAX_BYTES: 10 * 1024 * 1024,
  MAX_SIDE: 8000,
  MAX_PIXELS: 32000000
};

// ======================================
// 3. 캔버스
// ======================================

export const canvas = document.getElementById("canvas");

export const ctx = canvas.getContext("2d");

// ======================================
// 4. 상태 메시지
// ======================================

export function setStatus(message, error = false) {
  const element = document.getElementById("status");

  element.textContent = message;
  element.classList.toggle("error", error);
}

// ======================================
// 5. 화면비에 따른 크기
// ======================================

export const CANVAS_SIZES = {
  "1:1": [1080, 1080],
  "4:5": [1080, 1350],
  "16:9": [1920, 1080]
};

// ======================================
// 6. 캔버스 크기 변경
// ======================================

export function updateCanvasSize() {
  const [width, height] =
    CANVAS_SIZES[state.aspectRatio] || CANVAS_SIZES["1:1"];

  if (canvas.width !== width) {
    canvas.width = width;
  }

  if (canvas.height !== height) {
    canvas.height = height;
  }

  const stage = document.querySelector(".canvas-stage");

  const availableWidth = Math.max(
    120,
    stage.clientWidth - 32
  );

  const availableHeight = Math.max(
    160,
    Math.min(510, window.innerHeight * 0.58)
  );

  const scale = Math.min(
    availableWidth / width,
    availableHeight / height
  ) * state.zoomLevel;

  const displayWidth = Math.max(1, Math.round(width * scale));
  const displayHeight = Math.max(1, Math.round(height * scale));

  canvas.style.width = `${displayWidth}px`;
  canvas.style.height = `${displayHeight}px`;

  const container = document.getElementById("canvasContainer");

  container.style.width = `${displayWidth}px`;
  container.style.height = `${displayHeight}px`;

  document.getElementById("zoomLabel").textContent =
    `${Math.round(state.zoomLevel * 100)}%`;

  render();
}

// ======================================
// 7. 문구 줄바꿈
// ======================================

function wrapText(text, maxWidth) {
  const lines = [];

  String(text).split("\n").forEach(part => {
    let line = "";

    for (const char of Array.from(part)) {
      if (
        line &&
        ctx.measureText(line + char).width > maxWidth
      ) {
        lines.push(line);
        line = char;
      } else {
        line += char;
      }
    }

    lines.push(line);
  });

  return lines.slice(0, 80);
}

// ======================================
// 8. 이미지 렌더링
// ======================================

function drawBackground() {
  ctx.fillStyle = state.background;

  ctx.fillRect(
    0,
    0,
    canvas.width,
    canvas.height
  );
}

function drawImage() {
  if (!state.image) return;

  const img = state.image;

  const width = canvas.width;
  const height = canvas.height;

  const fit = Math.min(
    width / img.naturalWidth,
    height / img.naturalHeight
  ) * state.imageScale;

  const imageWidth = img.naturalWidth * fit;
  const imageHeight = img.naturalHeight * fit;

  const x =
    width * state.imageX / 100 - imageWidth / 2;

  const y =
    height * state.imageY / 100 - imageHeight / 2;

  ctx.drawImage(
    img,
    x,
    y,
    imageWidth,
    imageHeight
  );
}

// ======================================
// 9. 그리기 렌더링
// ======================================

function drawStrokes() {
  for (const stroke of state.drawings) {
    if (!stroke.points || !stroke.points.length) {
      continue;
    }

    ctx.save();
    ctx.beginPath();

    stroke.points.forEach((point, index) => {
      const x = point.x * canvas.width / 100;
      const y = point.y * canvas.height / 100;

      if (index === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });

    if (stroke.points.length === 1) {
      const point = stroke.points[0];

      ctx.lineTo(
        point.x * canvas.width / 100 + 0.01,
        point.y * canvas.height / 100 + 0.01
      );
    }

    ctx.lineWidth = stroke.size;
    ctx.strokeStyle = stroke.color;

    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    if (stroke.type === "highlighter") {
      ctx.globalAlpha = 0.4;
    }

    if (stroke.type === "neon") {
      ctx.shadowColor = stroke.color;
      ctx.shadowBlur = stroke.size * 2;
    }

    ctx.stroke();
    ctx.restore();
  }
}

// ======================================
// 10. 문구 렌더링
// ======================================

function drawTexts() {
  for (const text of state.texts) {
    ctx.save();

    const size = Math.max(
      12,
      Math.min(120, Number(text.fontSize) || 44)
    );

    const allowedFonts = [
      "sans-serif",
      "serif",
      "monospace"
    ];

    const font = allowedFonts.includes(text.fontFamily)
      ? text.fontFamily
      : "sans-serif";

    ctx.font = `bold ${size}px ${font}`;

    ctx.fillStyle = text.color || "#ffffff";

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    ctx.strokeStyle = "#0008";
    ctx.lineWidth = 3;

    const lines = wrapText(
      text.text,
      Math.max(50, canvas.width - 32)
    );

    const lineHeight = size * 1.25;

    const startY =
      text.y * canvas.height / 100 -
      (lines.length - 1) * lineHeight / 2;

    lines.forEach((line, index) => {
      const x = text.x * canvas.width / 100;
      const y = startY + index * lineHeight;

      ctx.strokeText(line, x, y);
      ctx.fillText(line, x, y);
    });

    ctx.restore();
  }
}

// ======================================
// 11. 전체 렌더링
// ======================================

export function render() {
  ctx.clearRect(
    0,
    0,
    canvas.width,
    canvas.height
  );

  drawBackground();
  drawImage();
  drawStrokes();
  drawTexts();
}