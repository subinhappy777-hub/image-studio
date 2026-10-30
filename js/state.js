export const state = {
  image: null,
  aspectRatio: "1:1",
  zoomLevel: 1.0,
  texts: [], 
  drawings: [], 
  stickers: [] 
};

export const LIMITS = { MAX_BYTES: 10 * 1024 * 1024, MAX_SIDE: 8000 };
export const canvas = document.getElementById("canvas");
export const ctx = canvas.getContext("2d");

// 화면비에 맞춰 캔버스 크기 및 화면 표시 크기 조절
export function updateCanvasSize() {
  let w = 720, h = 720;
  if (state.aspectRatio === "4:5") { w = 720; h = 900; }
  if (state.aspectRatio === "9:16") { w = 720; h = 1280; }
  
  const container = document.getElementById("canvasContainer");
  const maxW = container.parentElement.clientWidth - 40;
  const maxH = container.parentElement.clientHeight - 40;
  
  canvas.width = w;
  canvas.height = h;
  
  const scale = Math.min(maxW / w, maxH / h) * state.zoomLevel;
  canvas.style.width = `${w * scale}px`;
  canvas.style.height = `${h * scale}px`;
  container.style.width = canvas.style.width;
  container.style.height = canvas.style.height;

  render();
}

// 텍스트 줄바꿈 처리
function getLines(text, maxWidth, fontSize) {
  if (!text) return [];
  const lines = [];
  ctx.font = `700 ${fontSize}px system-ui, sans-serif`;
  text.split('\n').forEach(p => {
    let currentLine = '';
    Array.from(p).forEach(char => {
      const testLine = currentLine + char;
      if (ctx.measureText(testLine).width > maxWidth && currentLine) {
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

// 브러시 종류별 그리기
function drawStroke(stroke) {
  if (stroke.points.length < 2) return;
  const { points, color, size, type } = stroke;
  ctx.beginPath();
  ctx.moveTo((points[0].x / 100) * canvas.width, (points[0].y / 100) * canvas.height);
  for (let i = 1; i < points.length; i++) {
    ctx.lineTo((points[i].x / 100) * canvas.width, (points[i].y / 100) * canvas.height);
  }
  ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.strokeStyle = color;

  if (type === "neon") {
    ctx.save(); ctx.shadowBlur = size * 2; ctx.shadowColor = color; ctx.lineWidth = size; ctx.stroke();
    ctx.shadowBlur = size * 4; ctx.lineWidth = size * 0.6; ctx.stroke(); ctx.restore();
  } else if (type === "highlighter") {
    ctx.save(); ctx.globalAlpha = 0.4; ctx.lineWidth = size * 1.5; ctx.stroke(); ctx.restore();
  } else if (type === "glitter") {
    ctx.lineWidth = size; ctx.stroke(); ctx.fillStyle = color;
    points.forEach(pt => {
      if (Math.random() > 0.7) {
        const px = (pt.x / 100) * canvas.width + (Math.random() - 0.5) * size * 3;
        const py = (pt.y / 100) * canvas.height + (Math.random() - 0.5) * size * 3;
        ctx.beginPath(); ctx.arc(px, py, Math.random() * 1.5 + 0.5, 0, Math.PI * 2); ctx.fill();
      }
    });
  } else {
    ctx.lineWidth = size; ctx.stroke();
  }
}

// 전체 화면 렌더링
export function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  // 배경색
  ctx.fillStyle = document.getElementById("bgColor")?.value || "#1e1e24";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // 이미지
  if (state.image) {
    const iw = state.image.naturalWidth, ih = state.image.naturalHeight;
    const scale = Math.min(canvas.width / iw, canvas.height / ih);
    ctx.drawImage(state.image, (canvas.width - iw*scale)/2, (canvas.height - ih*scale)/2, iw*scale, ih*scale);
  }

  // 그림
  state.drawings.forEach(drawStroke);

  // 텍스트
  state.texts.forEach(t => {
    ctx.font = `700 ${t.fontSize}px ${t.fontFamily}`;
    ctx.fillStyle = t.color; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    const lines = getLines(t.text, canvas.width - 40, t.fontSize);
    const lineHeight = t.fontSize * 1.2;
    const startY = ((t.y / 100) * canvas.height) - ((lines.length - 1) * lineHeight / 2);
    const x = (t.x / 100) * canvas.width;
    lines.forEach((line, i) => ctx.fillText(line, x, startY + (i * lineHeight)));
  });
}