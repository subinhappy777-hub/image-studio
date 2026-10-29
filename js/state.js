export const state = {
  image: null,
  fileName: "",
  aspectRatio: "1:1",
  text: "가장자리 테스트 🎉\n줄바꿈과 이모지 😊 혼합",
  posX: 50,
  posY: 50,
  fontSize: 48,
  color: "#ffffff",
};

export const LIMITS = {
  MAX_BYTES: 10 * 1024 * 1024,
  MAX_SIDE: 8000,
};

export const canvas = document.getElementById("canvas");
export const ctx = canvas.getContext("2d");

// 화면비에 따른 캔버스 해상도 설정 (기기와 무관하게 고정된 해상도 사용)
export function updateCanvasSize() {
  let w = 720, h = 720;
  if (state.aspectRatio === "4:5") { w = 720; h = 900; }
  if (state.aspectRatio === "9:16") { w = 720; h = 1280; }
  
  canvas.width = w;
  canvas.height = h;
}

// 텍스트 줄바꿈 처리 함수
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
  // 캔버스 논리 크기(해상도) 기준으로 그리기 (화면에 보이는 크기와 무관)
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

  ctx.font = `700 ${state.fontSize}px system-ui, "Malgun Gothic", "Apple Color Emoji", "Segoe UI Emoji", sans-serif`;
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