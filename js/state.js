export const state = {
  image: null,
  fileName: "",
  aspectRatio: "1:1", // "1:1", "4:5", "9:16"
  text: "가장자리 테스트 🎉\n줄바꿈과 이모지 😊 혼합",
  posX: 50,
  posY: 50,
  fontSize: 48,
  fontFamily: "system-ui, 'Malgun Gothic', sans-serif",
  color: "#ffffff",
  
  // 새로 추가된 기능들
  stickers: [], // { id, emoji, x (%), y (%), size (px) }
  drawings: [], // { points: [{x, y}], color, size }
};

export const LIMITS = {
  MAX_BYTES: 10 * 1024 * 1024,
  MAX_SIDE: 8000,
};

export const canvas = document.getElementById("canvas");
export const ctx = canvas.getContext("2d");

export function updateCanvasSize() {
  let w = 720, h = 720;
  if (state.aspectRatio === "4:5") { w = 720; h = 900; }
  if (state.aspectRatio === "9:16") { w = 720; h = 1280; }
  
  // 🟢 기기 맞춤형: 이미지가 캔버스 해상도보다 작으면 늘리고, 크면 줄임
  canvas.width = w;
  canvas.height = h;
}

// 텍스트 줄바꿈
function getLines(text, maxWidth) {
  if (!text) return [""];
  const paragraphs = text.split('\n');
  const lines = [];
  paragraphs.forEach(p => {
    const chars = Array.from(p);
    let currentLine = '';
    chars.forEach(char => {
      const testLine = currentLine + char;
      const metrics = ctx.measureText(testLine);
      if (metrics.width > maxWidth && currentLine) {
        lines.push(currentLine);
        currentLine = char;
      } else {
        currentLine = testLine;
      }
    });
    if (currentLine) lines.push(currentLine);
  });
  return lines;
}

export function render() {
  // 1. 배경 및 이미지
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#111417";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  if (state.image) {
    const iw = state.image.naturalWidth;
    const ih = state.image.naturalHeight;
    const scale = Math.min(canvas.width / iw, canvas.height / ih);
    const dw = iw * scale;
    const dh = ih * scale;
    const dx = (canvas.width - dw) / 2;
    const dy = (canvas.height - dh) / 2;
    ctx.drawImage(state.image, dx, dy, dw, dh);
  }

  // 2. 그리기 레이어 (배경 이미지 위, 텍스트 아래)
  state.drawings.forEach(stroke => {
    if (stroke.points.length < 2) return;
    ctx.beginPath();
    ctx.strokeStyle = stroke.color;
    ctx.lineWidth = stroke.size;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    
    stroke.points.forEach((pt, i) => {
      const px = (pt.x / 100) * canvas.width;
      const py = (pt.y / 100) * canvas.height;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    });
    ctx.stroke();
  });

  // 3. 텍스트 레이어
  ctx.font = `700 ${state.fontSize}px ${state.fontFamily}`;
  ctx.fillStyle = state.color;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  const maxWidth = canvas.width - 80; 
  const lines = getLines(state.text, maxWidth);
  const lineHeight = state.fontSize * 1.3;
  const totalHeight = (lines.length - 1) * lineHeight;
  const startY = ((state.posY / 100) * canvas.height) - (totalHeight / 2);
  const x = (state.posX / 100) * canvas.width;

  lines.forEach((line, index) => {
    const y = startY + (index * lineHeight);
    ctx.fillText(line, x, y);
  });

  // 4. 스티커 레이어
  state.stickers.forEach(s => {
    ctx.font = `${s.size}px "Apple Color Emoji", "Segoe UI Emoji", sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const px = (s.x / 100) * canvas.width;
    const py = (s.y / 100) * canvas.height;
    ctx.fillText(s.emoji, px, py);
  });

  updateBadge();
}

export function updateBadge() {
  const badge = document.getElementById("stateBadge");
  if (state.image) {
    badge.textContent = `편집 중 · ${state.fileName}`;
    badge.style.color = "var(--ok)";
    badge.style.borderColor = "var(--ok)";
  } else {
    badge.textContent = "작업 없음 (배경 이미지 미선택)";
    badge.style.color = "var(--muted)";
    badge.style.borderColor = "var(--line)";
  }
}