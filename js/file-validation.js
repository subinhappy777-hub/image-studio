import { state, LIMITS, render } from "./state.js";

export function showMsg(text, kind) {
  const el = document.getElementById("fileMsg");
  el.textContent = text || "";
  el.className = "msg" + (kind ? " " + kind : "");
}

async function sniffType(file) {
  const buf = new Uint8Array(await file.slice(0, 8).arrayBuffer());
  const isPng = buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47;
  const isJpg = buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
  if (isPng) return "image/png";
  if (isJpg) return "image/jpeg";
  return null;
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("decode"));
    img.src = url;
  });
}

export async function handleFile(file) {
  if (!file) return;
  if (file.size === 0) { showMsg("거부됨: 빈 파일입니다.", "error"); return; }
  if (file.size > LIMITS.MAX_BYTES) { showMsg(`거부됨: 최대 10MB까지 가능합니다.`, "error"); return; }

  let realType;
  try { realType = await sniffType(file); } catch { showMsg("거부됨: 파일을 읽을 수 없습니다.", "error"); return; }
  if (!realType) { showMsg("거부됨: PNG 또는 JPEG만 지원합니다.", "error"); return; }

  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    if (img.naturalWidth === 0 || img.naturalHeight === 0) throw new Error("empty");
    if (img.naturalWidth > LIMITS.MAX_SIDE || img.naturalHeight > LIMITS.MAX_SIDE) {
      URL.revokeObjectURL(url); showMsg(`거부됨: 해상도가 너무 큽니다.`, "error"); return;
    }

    const maxTargetSize = 1200; 
    if (img.naturalWidth > maxTargetSize || img.naturalHeight > maxTargetSize) {
      const scale = Math.min(maxTargetSize / img.naturalWidth, maxTargetSize / img.naturalHeight);
      const newW = Math.floor(img.naturalWidth * scale);
      const newH = Math.floor(img.naturalHeight * scale);
      const tempCanvas = document.createElement("canvas");
      tempCanvas.width = newW; tempCanvas.height = newH;
      tempCanvas.getContext("2d").drawImage(img, 0, 0, newW, newH);
      state.image = await loadImage(tempCanvas.toDataURL(realType));
    } else {
      state.image = img;
    }

    state.fileName = file.name;
    showMsg(`사진을 불러왔습니다.`, "ok");
    render();
  } catch {
    URL.revokeObjectURL(url);
    showMsg("거부됨: 손상된 파일입니다.", "error");
  }
}