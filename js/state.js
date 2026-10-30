export const state = {
  image: null,
  fileName: "",
  aspectRatio: "1:1",
  text: "여기에 문구를 입력하세요 🎉",
  posX: 50,
  posY: 50,
  fontSize: 48,
  fontFamily: "system-ui, sans-serif",
  color: "#ffffff",
  stickers: [], 
  selectedStickerId: null,
  drawings: [], 
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
  canvas.width = w;
  canvas.height = h;
}

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
  ctx.fillStyle = "#1e1e24";
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

  state.drawings.forEach(stroke => drawStroke(stroke));

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