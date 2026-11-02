// ======================================
// 1. 편집 상태
// ======================================

export const state = {
  image: null,
  aspectRatio: "1:1",
  zoomLevel: 1,

  // 사진 프레임
  frameType: "none",

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

  if (canvas.width !== width) canvas.width = width;
  if (canvas.height !== height) canvas.height = height;

  const stage = document.querySelector(".canvas-stage");

  const availableWidth = Math.max(120, stage.clientWidth - 32);
  const availableHeight = Math.max(160, Math.min(510, window.innerHeight * 0.58));

  const scale = Math.min(availableWidth / width, availableHeight / height) * state.zoomLevel;

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
      if (line && ctx.measureText(line + char).width > maxWidth) {
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
// 8. 배경 그리기
// ======================================

function drawBackground() {
  ctx.fillStyle = state.background;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

// ======================================
// 9. 이미지 그리기
// ======================================

function drawImage() {
  if (!state.image) return;

  const img = state.image;
  const width = canvas.width;
  const height = canvas.height;

  const fit = Math.min(width / img.naturalWidth, height / img.naturalHeight) * state.imageScale;
  const imageWidth = img.naturalWidth * fit;
  const imageHeight = img.naturalHeight * fit;

  const x = width * state.imageX / 100 - imageWidth / 2;
  const y = height * state.imageY / 100 - imageHeight / 2;

  ctx.drawImage(img, x, y, imageWidth, imageHeight);
}

// ======================================
// 10. 그림 (글리터, 네온 등) 렌더링
// ======================================

function glitterRandom(seed) {
  const value = Math.sin(seed * 127.1) * 43758.5453;
  return value - Math.floor(value);
}

function drawGlitterStroke(stroke) {
  const points = stroke.points || [];
  if (points.length === 0) return;

  const width = canvas.width;
  const height = canvas.height;
  const size = Math.max(2, Number(stroke.size) || 6);

  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = stroke.color;
  ctx.lineWidth = size * 0.65;
  ctx.shadowColor = stroke.color;
  ctx.shadowBlur = size * 2;
  ctx.beginPath();

  points.forEach((point, index) => {
    const x = point.x * width / 100;
    const y = point.y * height / 100;
    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });

  if (points.length === 1) {
    const p = points[0];
    ctx.lineTo(p.x * width / 100 + 0.01, p.y * height / 100 + 0.01);
  }
  ctx.stroke();

  // 반짝이 입자
  ctx.shadowBlur = 0;
  const drawSparkle = (x, y, radius, seed) => {
    const angle = glitterRandom(seed + 1) * Math.PI * 2;
    const distance = glitterRandom(seed + 2) * size * 2;
    const sx = x + Math.cos(angle) * distance;
    const sy = y + Math.sin(angle) * distance;

    ctx.fillStyle = glitterRandom(seed + 3) > 0.5 ? "#ffffff" : "#fff5b8";
    ctx.beginPath();
    ctx.arc(sx, sy, radius, 0, Math.PI * 2);
    ctx.fill();

    if (glitterRandom(seed + 4) > 0.72) {
      const length = radius * 3;
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = Math.max(1, radius * 0.45);
      ctx.beginPath();
      ctx.moveTo(sx - length, sy); ctx.lineTo(sx + length, sy);
      ctx.moveTo(sx, sy - length); ctx.lineTo(sx, sy + length);
      ctx.stroke();
    }
  };

  let previous = null;
  let travelled = 0;
  const spacing = Math.max(4, size * 0.7);
  let particleIndex = 0;

  for (const point of points) {
    const current = { x: point.x * width / 100, y: point.y * height / 100 };
    if (!previous) {
      previous = current;
      drawSparkle(current.x, current.y, Math.max(1.5, size * 0.18), particleIndex++);
      continue;
    }
    const dx = current.x - previous.x;
    const dy = current.y - previous.y;
    const length = Math.hypot(dx, dy);
    if (length === 0) continue;
    let distance = spacing - travelled;
    while (distance <= length) {
      const ratio = distance / length;
      const x = previous.x + dx * ratio;
      const y = previous.y + dy * ratio;
      const radius = Math.max(1.5, size * 0.18) * (0.6 + glitterRandom(particleIndex + 10));
      drawSparkle(x, y, radius, particleIndex * 7 + 3);
      particleIndex++;
      distance += spacing;
    }
    travelled = (travelled + length) % spacing;
    previous = current;
  }
  ctx.restore();
}

function drawStrokes() {
  for (const stroke of state.drawings) {
    if (!stroke.points || stroke.points.length === 0) continue;

    if (stroke.type === "glitter") {
      drawGlitterStroke(stroke);
      continue;
    }

    ctx.save();
    ctx.beginPath();

    stroke.points.forEach((point, index) => {
      const x = point.x * canvas.width / 100;
      const y = point.y * canvas.height / 100;
      if (index === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });

    if (stroke.points.length === 1) {
      const p = stroke.points[0];
      ctx.lineTo(p.x * canvas.width / 100 + 0.01, p.y * canvas.height / 100 + 0.01);
    }

    ctx.lineWidth = stroke.size;
    ctx.strokeStyle = stroke.color;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    if (stroke.type === "highlighter") ctx.globalAlpha = 0.4;
    if (stroke.type === "neon") {
      ctx.shadowColor = stroke.color;
      ctx.shadowBlur = stroke.size * 2;
    }

    ctx.stroke();
    ctx.restore();
  }
}

// ======================================
// 11. ★ 텍스트 렌더링 (볼드 & 커스텀 폰트 추가)
// ======================================

function drawTexts() {
  for (const text of state.texts) {
    ctx.save();

    const size = Math.max(12, Math.min(120, Number(text.fontSize) || 44));

    // 🟢 커스텀 폰트 적용 (HTML에 추가된 구글 폰트 포함)
    const fontFamily = text.fontFamily || "sans-serif";
    
    // 🟢 볼드(Bold) 여부에 따라 폰트 굵기 설정
    const fontWeight = text.bold ? "bold" : "normal";
    
    ctx.font = `${fontWeight} ${size}px ${fontFamily}`;

    ctx.fillStyle = text.color || "#ffffff";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.strokeStyle = "#0008";
    ctx.lineWidth = 3;

    const lines = wrapText(text.text, Math.max(50, canvas.width - 32));
    const lineHeight = size * 1.25;

    const startY = text.y * canvas.height / 100 - (lines.length - 1) * lineHeight / 2;

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
// 12. 스티커 렌더링 (이미지 로딩 캐시 적용)
// ======================================

const stickerImageCache = new Map();

function getStickerImage(src) {
  if (!src) return null;

  if (stickerImageCache.has(src)) {
    return stickerImageCache.get(src);
  }

  const img = new Image();

  // 로딩이 완료되면 다시 캔버스를 그립니다.
  img.onload = () => render();

  img.onerror = () => {
    console.error("스티커 이미지 로드 실패:", src);
  };

  stickerImageCache.set(src, img);
  img.src = src;

  return img;
}

function drawStickers() {
  for (const sticker of state.stickers) {
    if (!sticker) continue;

    ctx.save();

    const x = (Number(sticker.x) || 50) * canvas.width / 100;
    const y = (Number(sticker.y) || 50) * canvas.height / 100;
    const size = Number(sticker.size) || 120;

    ctx.translate(x, y);

    const rotation =
      (Number(sticker.rotation) || 0) * Math.PI / 180;

    ctx.rotate(rotation);

    // 커스텀 이미지 스티커
    if (sticker.type === "custom" && sticker.src) {
      const img = getStickerImage(sticker.src);

      if (img && img.complete && img.naturalWidth > 0) {
        ctx.drawImage(
          img,
          -size / 2,
          -size / 2,
          size,
          size
        );
      }
    }

    // 말풍선 스티커
    else if (sticker.type === "speech") {
      ctx.font = `bold ${size * 0.4}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      const emoji = sticker.emoji || "💬";
      const textWidth = ctx.measureText(emoji).width;
      const padding = size * 0.3;

      ctx.fillStyle = sticker.color || "#ffffff";

      ctx.beginPath();
      ctx.roundRect(
        -textWidth / 2 - padding,
        -size / 2,
        textWidth + padding * 2,
        size,
        size * 0.3
      );
      ctx.fill();

      ctx.fillStyle = "#000000";
      ctx.fillText(emoji, 0, 0);
    }

    // 기본 이모지 스티커
    else {
      ctx.font = `${size}px "Segoe UI Emoji", "Apple Color Emoji", sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(sticker.emoji || "⭐", 0, 0);
    }

    ctx.restore();
  }
}


// ======================================
// 13. 사진 프레임 그리기
// ======================================

function drawFrame() {
  const type = state.frameType;
  if (!type || type === "none") return;

  const w = canvas.width;
  const h = canvas.height;
  const unit = Math.min(w, h);
  const margin = unit * 0.035;

  ctx.save();

  if (type === "heart") {
    ctx.strokeStyle = "#ff7eb6";
    ctx.lineWidth = unit * 0.025;
    ctx.strokeRect(margin, margin, w - margin * 2, h - margin * 2);
    ctx.font = `${unit * 0.055}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const hearts = ["💗", "💕", "💖", "💗"];
    for (let i = 0; i < 8; i++) {
      const x = (i + 0.5) * w / 8;
      ctx.fillText(hearts[i % hearts.length], x, margin);
      ctx.fillText(hearts[i % hearts.length], x, h - margin);
    }
  } else if (type === "sparkle") {
    ctx.strokeStyle = "#ffe58f";
    ctx.lineWidth = unit * 0.018;
    ctx.shadowColor = "#fff1a8";
    ctx.shadowBlur = unit * 0.025;
    ctx.strokeRect(margin, margin, w - margin * 2, h - margin * 2);
    ctx.shadowBlur = 0;
    ctx.font = `${unit * 0.055}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (let i = 0; i < 9; i++) {
      const x = i * w / 8;
      ctx.fillText("✨", x, margin);
      ctx.fillText("✨", x, h - margin);
    }
  } else if (type === "lace") {
    ctx.strokeStyle = "#ffb6d5";
    ctx.lineWidth = unit * 0.035;
    ctx.strokeRect(margin, margin, w - margin * 2, h - margin * 2);
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = unit * 0.008;
    ctx.setLineDash([unit * 0.012, unit * 0.012]);
    ctx.strokeRect(margin, margin, w - margin * 2, h - margin * 2);
    ctx.setLineDash([]);
    ctx.font = `${unit * 0.07}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("🎀", margin, margin);
    ctx.fillText("🎀", w - margin, margin);
    ctx.fillText("🎀", margin, h - margin);
    ctx.fillText("🎀", w - margin, h - margin);
  } else if (type === "polaroid") {
    const side = unit * 0.06;
    const bottom = unit * 0.16;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, side, h);
    ctx.fillRect(w - side, 0, side, h);
    ctx.fillRect(0, 0, w, side);
    ctx.fillRect(0, h - bottom, w, bottom);
    ctx.fillStyle = "#777777";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `italic ${unit * 0.035}px cursive`;
    ctx.fillText("my lovely moment ♡", w / 2, h - bottom / 2);
  } else if (type === "y2k") {
    const gradient = ctx.createLinearGradient(0, 0, w, h);
    gradient.addColorStop(0, "#8be9ff");
    gradient.addColorStop(0.5, "#d8a8ff");
    gradient.addColorStop(1, "#ff9acb");
    ctx.strokeStyle = gradient;
    ctx.lineWidth = unit * 0.045;
    ctx.strokeRect(margin, margin, w - margin * 2, h - margin * 2);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `${unit * 0.06}px sans-serif`;
    ctx.fillText("💿", margin, margin);
    ctx.fillText("⭐", w - margin, margin);
    ctx.fillText("💖", margin, h - margin);
    ctx.fillText("🦋", w - margin, h - margin);
  }

  ctx.restore();
}

// ======================================
// 14. 전체 렌더링
// ======================================

export function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  drawBackground();
  drawImage();
  drawStrokes();
  drawStickers(); // 🟢 스티커 렌더링 (회전 등 적용됨)
  drawTexts();    // 🟢 텍스트 렌더링 (볼드 등 적용됨)
  drawFrame();
}