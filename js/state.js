// ======================================
// 1. 편집 상태
// ======================================

export const state = {
  image: null,
  aspectRatio: "1:1",
  zoomLevel: 1,

  frameType: "none",

  texts: [],
  drawings: [],
  stickers: [],

  selectedTextId: null,
  selectedStickerId: null,

  imageScale: 1,
  imageX: 50,
  imageY: 50,

  background: "#222b42",

  splitLayout: 1,
  splitImages: [null, null, null, null]
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
// 2-1. 자동 배치 설정 (2차 작업)
// ======================================

export const AUTO_LAYOUT = {
  CANVAS_MARGIN: 24,        // 캔버스 가장자리 여백(px)
  MIN_FONT_SIZE: 12,        // 자동 축소 하한
  MAX_SHRINK_STEPS: 24,     // 최대 축소 시도 횟수
  LINE_HEIGHT_RATIO: 1.25,  // 줄 간격 비율
  GAP: 8                    // 텍스트 간 최소 간격(px)
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
  const availableHeight = Math.max(
    160,
    Math.min(510, window.innerHeight * 0.58)
  );

  const scale =
    Math.min(availableWidth / width, availableHeight / height) *
    state.zoomLevel;

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
// 7. 문구 줄바꿈 및 텍스트 측정
// ======================================

/**
 * 문자열을 글자 단위로 분리합니다.
 * 한글의 결합 문자 등이 가능한 한 분리되지 않도록
 * Intl.Segmenter를 우선 사용합니다.
 */
function splitGraphemes(value) {
  const text = String(value);

  if (typeof Intl !== "undefined" && Intl.Segmenter) {
    const segmenter = new Intl.Segmenter("ko", {
      granularity: "grapheme"
    });

    return Array.from(
      segmenter.segment(text),
      item => item.segment
    );
  }

  return Array.from(text);
}

/**
 * 단어 단위로 줄바꿈합니다.
 *
 * 처리 순서:
 * 1. 사용자가 입력한 줄바꿈을 먼저 분리합니다.
 * 2. 공백과 단어를 각각 토큰으로 구분합니다.
 * 3. 단어가 한 줄에 들어가면 그대로 배치합니다.
 * 4. 단어가 너무 길면 글자 단위로 나눕니다.
 */
function wrapText(text, maxWidth) {
  const lines = [];
  const safeWidth = Math.max(1, Number(maxWidth) || 1);

  const explicitLines = String(text ?? "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n");

  function pushLongToken(token) {
    let current = "";

    for (const char of splitGraphemes(token)) {
      const candidate = current + char;

      if (
        current &&
        ctx.measureText(candidate).width > safeWidth
      ) {
        lines.push(current);
        current = char;
      } else {
        current = candidate;
      }
    }

    return current;
  }

  for (const originalLine of explicitLines) {
    // 빈 줄도 사용자가 입력한 줄바꿈이므로 유지
    if (originalLine === "") {
      lines.push("");
      continue;
    }

    // 공백 토큰과 일반 단어 토큰을 분리
    const tokens = originalLine.match(/\s+|[^\s]+/gu) || [];

    let line = "";

    for (const token of tokens) {
      const candidate = line + token;

      // 현재 줄에 토큰을 추가해도 너비가 허용 범위 이내인 경우
      if (ctx.measureText(candidate).width <= safeWidth) {
        line = candidate;
        continue;
      }

      // 공백 토큰인 경우
      if (/^\s+$/u.test(token)) {
        if (line) {
          lines.push(line.trimEnd());
          line = "";
        }
        continue;
      }

      // 기존 줄에 내용이 있다면 먼저 확정
      if (line.trim() !== "") {
        lines.push(line.trimEnd());
        line = "";
      }

      // 단어 자체가 한 줄보다 긴 경우 글자 단위로 분할
      if (ctx.measureText(token).width > safeWidth) {
        line = pushLongToken(token);
      } else {
        line = token;
      }
    }

    lines.push(line);
  }

  // 빈 배열 방지
  return lines.length ? lines : [""];
}

/**
 * 텍스트의 실제 렌더링 크기와 위치를 계산합니다.
 *
 * drawTexts()와 main.js의 pickText()가
 * 동일한 계산 결과를 사용하도록 만든 함수입니다.
 *
 * maxWidth를 지정하지 않으면 캔버스 여백을 고려한
 * 안전 폭을 자동으로 사용합니다. (2차 작업)
 */
export function measureTextLayout(textItem, maxWidth = null) {
  // ★ 캔버스 여백을 고려한 안전 폭
  const safeMaxWidth =
    maxWidth !== null
      ? maxWidth
      : Math.max(
          40,
          canvas.width - AUTO_LAYOUT.CANVAS_MARGIN * 2
        );

  const size = Math.max(
    12,
    Math.min(120, Number(textItem.fontSize) || 44)
  );

  const fontFamily = textItem.fontFamily || "sans-serif";
  const fontWeight = textItem.bold ? "bold" : "normal";

  ctx.save();

  ctx.font = `${fontWeight} ${size}px ${fontFamily}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  const lines = wrapText(textItem.text ?? "", safeMaxWidth);
  const lineHeight = size * AUTO_LAYOUT.LINE_HEIGHT_RATIO;

  const centerX = Number(textItem.x) * canvas.width / 100;
  const centerY = Number(textItem.y) * canvas.height / 100;

  const startY =
    centerY - ((lines.length - 1) * lineHeight) / 2;

  let maxLineWidth = 0;
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  const lineMetrics = lines.map((line, index) => {
    const metrics = ctx.measureText(line);
    const lineWidth = metrics.width;

    maxLineWidth = Math.max(maxLineWidth, lineWidth);

    const ascent =
      Number(metrics.actualBoundingBoxAscent) || size * 0.8;

    const descent =
      Number(metrics.actualBoundingBoxDescent) || size * 0.2;

    // ★ 중앙 정렬이므로 width 기반 대칭 계산 (브라우저 호환성)
    const left = lineWidth / 2;
    const right = lineWidth / 2;

    const x = centerX;
    const y = startY + index * lineHeight;

    minX = Math.min(minX, x - left);
    maxX = Math.max(maxX, x + right);
    minY = Math.min(minY, y - ascent);
    maxY = Math.max(maxY, y + descent);

    return {
      text: line,
      x,
      y,
      width: lineWidth,
      ascent,
      descent
    };
  });

  // 텍스트가 비어 있거나 글자 폭이 없는 경우를 위한 보정
  if (!Number.isFinite(minX)) {
    minX = centerX;
    maxX = centerX;
    minY = centerY - size / 2;
    maxY = centerY + size / 2;
  }

  // 텍스트 외곽선과 선택 영역을 위한 여유 공간
  const strokePadding = 3;

  minX -= strokePadding;
  maxX += strokePadding;
  minY -= strokePadding;
  maxY += strokePadding;

  ctx.restore();

  return {
    lines,
    lineMetrics,
    lineHeight,
    fontSize: size,
    width: maxLineWidth,
    height: maxY - minY,
    centerX,
    centerY,

    // 실제 글자와 외곽선을 포함한 선택 영역
    bounds: {
      left: minX,
      right: maxX,
      top: minY,
      bottom: maxY,
      width: maxX - minX,
      height: maxY - minY
    }
  };
}

// ======================================
// 7-1. 자동 배치 / 자동 축소 (2차 작업)
// ======================================

/**
 * 텍스트가 캔버스 세로/가로 영역을 벗어나면
 * 글자 크기를 자동으로 줄여 영역 안에 맞춥니다.
 *
 * 반환: { fontSize, layout } — 축소된 크기와 최종 레이아웃
 */
export function fitTextToCanvas(textItem) {
  const canvasW = canvas.width;
  const canvasH = canvas.height;
  const margin = AUTO_LAYOUT.CANVAS_MARGIN;

  const maxWidth = Math.max(40, canvasW - margin * 2);
  const maxHeight = Math.max(40, canvasH - margin * 2);

  const originalSize = Math.max(
    12,
    Math.min(120, Number(textItem.fontSize) || 44)
  );

  let fontSize = originalSize;
  let layout = measureTextLayout(
    { ...textItem, fontSize },
    maxWidth
  );

  // ★ 세로/가로 영역을 모두 만족할 때까지 축소
  let step = 0;
  while (
    step < AUTO_LAYOUT.MAX_SHRINK_STEPS &&
    fontSize > AUTO_LAYOUT.MIN_FONT_SIZE &&
    (layout.bounds.height > maxHeight ||
      layout.bounds.width > maxWidth)
  ) {
    fontSize = Math.max(
      AUTO_LAYOUT.MIN_FONT_SIZE,
      Math.floor(fontSize * 0.92)
    );

    layout = measureTextLayout(
      { ...textItem, fontSize },
      maxWidth
    );

    step++;
  }

  // ★ 여전히 넘치면 y 위치를 캔버스 안으로 clamp
  if (
    layout.bounds.top < margin ||
    layout.bounds.bottom > canvasH - margin
  ) {
    const clampedY = Math.max(
      margin + layout.bounds.height / 2,
      Math.min(
        canvasH - margin - layout.bounds.height / 2,
        layout.centerY
      )
    );

    layout = measureTextLayout(
      {
        ...textItem,
        fontSize,
        y: (clampedY / canvasH) * 100
      },
      maxWidth
    );
  }

  return { fontSize, layout };
}

/**
 * 새 텍스트를 캔버스에 겹치지 않게 배치할 위치를 찾습니다.
 * 공간이 부족하면 글자 크기를 자동으로 줄입니다.
 *
 * 반환: { x, y, fontSize } — 퍼센트 좌표와 최종 글자 크기
 */
export function findFreeTextPosition(textItem) {
  const canvasW = canvas.width;
  const canvasH = canvas.height;
  const margin = AUTO_LAYOUT.CANVAS_MARGIN;
  const gap = AUTO_LAYOUT.GAP;

  // 기존 텍스트들의 바운즈 수집
  const existingBounds = state.texts
    .filter(t => t.id !== textItem.id)
    .map(t => measureTextLayout(t).bounds);

  const originalSize = Math.max(
    12,
    Math.min(120, Number(textItem.fontSize) || 44)
  );

  let fontSize = originalSize;

  // ★ 공간이 부족하면 크기를 줄여가며 재시도
  for (
    let step = 0;
    step < AUTO_LAYOUT.MAX_SHRINK_STEPS &&
    fontSize >= AUTO_LAYOUT.MIN_FONT_SIZE;
    step++
  ) {
    const layout = measureTextLayout(
      { ...textItem, fontSize, x: 50, y: 50 },
      canvasW - margin * 2
    );

    const w = layout.bounds.width;
    const h = layout.bounds.height;

    // 위에서 아래로, 왼쪽에서 오른쪽으로 스캔
    const startY = margin + h / 2;

    for (
      let cy = startY;
      cy <= canvasH - margin - h / 2 + 0.5;
      cy += h + gap
    ) {
      for (
        let cx = margin + w / 2;
        cx <= canvasW - margin - w / 2 + 0.5;
        cx += w + gap
      ) {
        const candidate = {
          left: cx - w / 2,
          right: cx + w / 2,
          top: cy - h / 2,
          bottom: cy + h / 2
        };

        const overlaps = existingBounds.some(b =>
          !(
            candidate.right + gap < b.left ||
            candidate.left - gap > b.right ||
            candidate.bottom + gap < b.top ||
            candidate.top - gap > b.bottom
          )
        );

        if (!overlaps) {
          return {
            x: (cx / canvasW) * 100,
            y: (cy / canvasH) * 100,
            fontSize
          };
        }
      }
    }

    // 공간을 못 찾으면 글자 크기 축소 후 재시도
    fontSize = Math.max(
      AUTO_LAYOUT.MIN_FONT_SIZE,
      Math.floor(fontSize * 0.9)
    );
  }

  // ★ 최후: 중앙에 배치 (겹침 허용)
  return {
    x: 50,
    y: 50,
    fontSize: AUTO_LAYOUT.MIN_FONT_SIZE
  };
}

/**
 * 화면비 변경, 템플릿 불러오기 등으로 캔버스 크기가 바뀌었을 때
 * 모든 텍스트를 캔버스 안으로 재배치하고 필요 시 축소합니다.
 *
 * 옵션:
 * - shrink: 글자 크기 자동 축소 허용 (기본 true)
 * - reposition: 겹침 방지 재배치 허용 (기본 false)
 */
export function reflowAllTexts({
  shrink = true,
  reposition = false
} = {}) {
  if (!state.texts.length) return;

  const canvasH = canvas.height;
  const margin = AUTO_LAYOUT.CANVAS_MARGIN;

  for (const text of state.texts) {
    if (shrink) {
      const { fontSize } = fitTextToCanvas(text);
      text.fontSize = fontSize;
    }

    // 캔버스 밖으로 나간 텍스트를 안으로 clamp
    const layout = measureTextLayout(text);

    if (layout.bounds.top < margin) {
      const dy =
        (margin - layout.bounds.top) / canvasH * 100;
      text.y = Math.min(100, text.y + dy);
    } else if (layout.bounds.bottom > canvasH - margin) {
      const dy =
        (layout.bounds.bottom - (canvasH - margin)) /
        canvasH * 100;
      text.y = Math.max(0, text.y - dy);
    }
  }

  if (reposition) {
    // 겹침 제거는 선택적 (사용자가 수동 배치한 걸 덮어쓸 수 있음)
    // 필요 시 구현
  }
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
  const width = canvas.width;
  const height = canvas.height;

  if (state.splitLayout === 2 || state.splitLayout === 4) {
    const cols = 2;
    const rows = state.splitLayout === 2 ? 1 : 2;
    const gap = 10;

    const pieceW = (width - gap * (cols - 1)) / cols;
    const pieceH = (height - gap * (rows - 1)) / rows;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const index = r * cols + c;
        const img = state.splitImages[index];

        const dx = c * (pieceW + gap);
        const dy = r * (pieceH + gap);

        if (!img) continue;

        const imgRatio = img.naturalWidth / img.naturalHeight;
        const boxRatio = pieceW / pieceH;

        let sx, sy, sw, sh;

        if (imgRatio > boxRatio) {
          sh = img.naturalHeight;
          sw = sh * boxRatio;
          sx = (img.naturalWidth - sw) / 2;
          sy = 0;
        } else {
          sw = img.naturalWidth;
          sh = sw / boxRatio;
          sx = 0;
          sy = (img.naturalHeight - sh) / 2;
        }

        ctx.drawImage(
          img,
          sx, sy, sw, sh,
          dx, dy, pieceW, pieceH
        );
      }
    }

    return;
  }

  if (!state.image) return;

  const img = state.image;

  const fit =
    Math.min(
      width / img.naturalWidth,
      height / img.naturalHeight
    ) * state.imageScale;

  const imageWidth = img.naturalWidth * fit;
  const imageHeight = img.naturalHeight * fit;

  const x = width * state.imageX / 100 - imageWidth / 2;
  const y = height * state.imageY / 100 - imageHeight / 2;

  ctx.drawImage(img, x, y, imageWidth, imageHeight);
}

// ======================================
// 10. 그림 렌더링
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
    ctx.lineTo(
      p.x * width / 100 + 0.01,
      p.y * height / 100 + 0.01
    );
  }

  ctx.stroke();
  ctx.shadowBlur = 0;

  const drawSparkle = (x, y, radius, seed) => {
    const angle = glitterRandom(seed + 1) * Math.PI * 2;
    const distance = glitterRandom(seed + 2) * size * 2;

    const sx = x + Math.cos(angle) * distance;
    const sy = y + Math.sin(angle) * distance;

    ctx.fillStyle =
      glitterRandom(seed + 3) > 0.5 ? "#ffffff" : "#fff5b8";

    ctx.beginPath();
    ctx.arc(sx, sy, radius, 0, Math.PI * 2);
    ctx.fill();

    if (glitterRandom(seed + 4) > 0.72) {
      const length = radius * 3;

      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = Math.max(1, radius * 0.45);
      ctx.beginPath();
      ctx.moveTo(sx - length, sy);
      ctx.lineTo(sx + length, sy);
      ctx.moveTo(sx, sy - length);
      ctx.lineTo(sx, sy + length);
      ctx.stroke();
    }
  };

  let previous = null;
  let travelled = 0;

  const spacing = Math.max(4, size * 0.7);
  let particleIndex = 0;

  for (const point of points) {
    const current = {
      x: point.x * width / 100,
      y: point.y * height / 100
    };

    if (!previous) {
      previous = current;
      drawSparkle(
        current.x,
        current.y,
        Math.max(1.5, size * 0.18),
        particleIndex++
      );
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

      const radius =
        Math.max(1.5, size * 0.18) *
        (0.6 + glitterRandom(particleIndex + 10));

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
      ctx.lineTo(
        p.x * canvas.width / 100 + 0.01,
        p.y * canvas.height / 100 + 0.01
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
// 11. 텍스트 렌더링
// 실제 측정된 텍스트 레이아웃 사용
// ======================================

function drawTexts() {
  for (const text of state.texts) {
    ctx.save();

    // 텍스트 크기와 줄바꿈 정보를 한 번에 계산
    const layout = measureTextLayout(text);

    const fontFamily = text.fontFamily || "sans-serif";
    const fontWeight = text.bold ? "bold" : "normal";

    // 측정 함수와 동일한 글꼴 설정
    ctx.font =
      `${fontWeight} ${layout.fontSize}px ${fontFamily}`;

    ctx.fillStyle = text.color || "#ffffff";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    // 글자 외곽선
    ctx.strokeStyle = "#0008";
    ctx.lineWidth = 3;

    // 텍스트의 중심 위치
    const centerX = layout.centerX;

    // ★ lineMetrics의 y를 그대로 사용 (측정=렌더링 일치)
    layout.lines.forEach((line, index) => {
      const y = layout.lineMetrics[index]
        ? layout.lineMetrics[index].y
        : layout.centerY;

      ctx.strokeText(line, centerX, y);
      ctx.fillText(line, centerX, y);
    });

    ctx.restore();
  }
}

// ======================================
// 12. 스티커 렌더링
// ======================================

const stickerImageCache = new Map();

function getStickerImage(src) {
  if (!src) return null;

  if (stickerImageCache.has(src)) {
    return stickerImageCache.get(src);
  }

  const img = new Image();

  img.onload = () => {
    render();
  };

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

    const x = (Number(sticker.x) || 0) * canvas.width / 100;
    const y = (Number(sticker.y) || 0) * canvas.height / 100;
    const size = Number(sticker.size) || 120;

    ctx.translate(x, y);

    const rotation =
      (Number(sticker.rotation) || 0) * Math.PI / 180;

    ctx.rotate(rotation);

    if (
      sticker.kind === "image" ||
      sticker.type === "custom" ||
      sticker.type === "image"
    ) {
      const img = getStickerImage(sticker.src);

      if (img && img.complete && img.naturalWidth > 0) {
        const ratio = Math.min(
          size / img.naturalWidth,
          size / img.naturalHeight
        );

        const width = img.naturalWidth * ratio;
        const height = img.naturalHeight * ratio;

        ctx.drawImage(
          img,
          -width / 2,
          -height / 2,
          width,
          height
        );
      }
    } else if (
      sticker.kind === "speech" ||
      sticker.type === "speech"
    ) {
      const message = sticker.text || sticker.emoji || "💬";

      ctx.font = `bold ${size * 0.2}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      const textWidth = ctx.measureText(message).width;
      const padding = size * 0.2;
      const boxWidth = textWidth + padding * 2;
      const boxHeight = size * 0.65;

      ctx.fillStyle = sticker.color || "#ffffff";

      ctx.beginPath();
      ctx.roundRect(
        -boxWidth / 2,
        -boxHeight / 2,
        boxWidth,
        boxHeight,
        size * 0.15
      );
      ctx.fill();

      ctx.fillStyle = "#333333";
      ctx.fillText(message, 0, 0);
    } else {
      ctx.font =
        `${size}px "Segoe UI Emoji", "Apple Color Emoji", sans-serif`;

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
    ctx.strokeRect(
      margin,
      margin,
      w - margin * 2,
      h - margin * 2
    );

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

    ctx.strokeRect(
      margin,
      margin,
      w - margin * 2,
      h - margin * 2
    );

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

    ctx.strokeRect(
      margin,
      margin,
      w - margin * 2,
      h - margin * 2
    );

    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = unit * 0.008;
    ctx.setLineDash([unit * 0.012, unit * 0.012]);

    ctx.strokeRect(
      margin,
      margin,
      w - margin * 2,
      h - margin * 2
    );

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

    ctx.fillText(
      "my lovely moment ♡",
      w / 2,
      h - bottom / 2
    );
  } else if (type === "y2k") {
    const gradient = ctx.createLinearGradient(0, 0, w, h);

    gradient.addColorStop(0, "#8be9ff");
    gradient.addColorStop(0.5, "#d8a8ff");
    gradient.addColorStop(1, "#ff9acb");

    ctx.strokeStyle = gradient;
    ctx.lineWidth = unit * 0.045;

    ctx.strokeRect(
      margin,
      margin,
      w - margin * 2,
      h - margin * 2
    );

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
  drawStickers();
  drawTexts();
  drawFrame();
}