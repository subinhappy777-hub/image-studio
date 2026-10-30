export const state = {
  image: null,
  aspectRatio: "1:1",
  zoomLevel: 1.0,
  
  texts: [], // { id, text, x, y, fontSize, fontFamily, color }
  selectedTextId: null,
  
  stickers: [], 
  selectedStickerId: null,
  
  drawings: [], 
};

export const LIMITS = { MAX_BYTES: 10 * 1024 * 1024, MAX_SIDE: 8000 };
export const canvas = document.getElementById("canvas");
export const ctx = canvas.getContext("2d");

export function updateCanvasSize() {
  let w = 720, h = 720;
  if (state.aspectRatio === "4:5") { w = 720; h = 900; }
  if (state.aspectRatio === "9:16") { w = 720; h = 1280; }
  
  const container = document.getElementById("canvasContainer");
  const maxW = container.clientWidth - 40;
  const maxH = container.clientHeight - 40;
  
  // 캔버스 논리 해상도는 고정, CSS로만 보이는 크기 조절
  canvas.width = w;
  canvas.height = h;
  
  const scale = Math.min(maxW / w, maxH / h) * state.zoomLevel;
  canvas.style.width = `${w * scale}px`;
  canvas.style.height = `${h * scale}px`;
  container.style.width = canvas.style.width;
  container.style.height = canvas.style.height;

  render();
}

function getLines(text, maxWidth, fontSize) {
  if (!text) return [];
  const lines = [];
  const paragraphs = text.split('\n');
  
  ctx.font = `700 ${fontSize}px system-ui, sans-serif`;
  paragraphs.forEach(p => {
    let currentLine = '';
    Array.from(p).forEach(char => {
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

function drawStroke(stroke) {
  if (stroke.points.length < 2) return;
  const { points, color, size, type } = stroke;
  
  ctx.beginPath();
  const p0 = points[0];
  ctx.moveTo((p0.x / 100) * canvas.width, (p0.y / 100) * canvas.height);
  for (let i = 1; i < points.length; i++) {
    const p = points[i];
    ctx.lineTo((p.x / 100) * canvas.width, (p.y / 100) * canvas.height);
  }

  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = color;

  if (type === "neon") {
    ctx.save();
    ctx.shadowBlur = size * 2; ctx.shadowColor = color;
    ctx.lineWidth = size; ctx.stroke();
    ctx.shadowBlur = size * 4; ctx.lineWidth = size * 0.6; ctx.stroke();
    ctx.restore();
  } else if (type === "highlighter") {
    ctx.save(); ctx.globalAlpha = 0.4; ctx.lineWidth = size * 1.5; ctx.stroke(); ctx.restore();
  } else if (type === "glitter") {
    ctx.lineWidth = size; ctx.stroke();
    ctx.fillStyle = color;
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

export function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  // 배경
  const bgColor = document.getElementById("bgColor")?.value || "#1e1e24";
  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  if (state.image) {
    const iw = state.image.naturalWidth, ih = state.image.naturalHeight;
    const scale = Math.min(canvas.width / iw, canvas.height / ih);
    const dw = iw * scale, dh = ih * scale;
    const dx = (canvas.width - dw) / 2, dy = (canvas.height - dh) / 2;
    ctx.drawImage(state.image, dx, dy, dw, dh);
  }

  state.drawings.forEach(stroke => drawStroke(stroke));

  // 텍스트 렌더링 (다중 지원)
  state.texts.forEach(t => {
    ctx.font = `700 ${t.fontSize}px ${t.fontFamily}`;
    ctx.fillStyle = t.color;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    
    const maxWidth = canvas.width - 40;
    const lines = getLines(t.text, maxWidth, t.fontSize);
    const lineHeight = t.fontSize * 1.2;
    const totalHeight = (lines.length - 1) * lineHeight;
    const startY = ((t.y / 100) * canvas.height) - (totalHeight / 2);
    const x = (t.x / 100) * canvas.width;

    lines.forEach((line, index) => {
      const y = startY + (index * lineHeight);
      ctx.fillText(line, x, y);
    });

    // 선택된 텍스트 가이드
    if (state.selectedTextId === t.id) {
      ctx.strokeStyle = "#4f8cff";
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      const w = maxWidth * 0.8;
      ctx.strokeRect(x - w/2, startY - lineHeight/2, w, totalHeight + lineHeight);
      ctx.setLineDash([]);
    }
  });

  // 스티커 렌더링
  state.stickers.forEach(s => {
    const px = (s.x / 100) * canvas.width;
    const py = (s.y / 100) * canvas.height;
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(s.rotation || 0);
    ctx.font = `${s.size}px "Apple Color Emoji", "Segoe UI Emoji", sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(s.emoji, 0, 0);

    if (state.selectedStickerId === s.id) {
      const w = s.size * 0.8;
      const h = s.size * 0.8;
      ctx.strokeStyle = "#4f8cff";
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.strokeRect(-w/2, -h/2, w, h);
      ctx.setLineDash([]);
      const handleX = w/2;
      const handleY = -h/2;
      ctx.beginPath(); ctx.arc(handleX, handleY, 6, 0, Math.PI * 2);
      ctx.fillStyle = "#4f8cff"; ctx.fill();
      ctx.strokeStyle = "#fff"; ctx.lineWidth = 2; ctx.stroke();
    }
    ctx.restore();
  });
}