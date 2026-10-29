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

function updateMeta() {
  const el = document.getElementById("metaInfo");
  if (state.image) {
    const canvas = document.getElementById("canvas");
    el.textContent = `${state.image.naturalWidth}×${state.image.naturalHeight}px · 미리보기 ${canvas.width}×${canvas.height}`;
  } else {
    el.textContent = "이미지를 불러오면 정보가 표시됩니다";
  }
}

export async function handleFile(file) {
  if (!file) return;

  if (file.size === 0) {
    showMsg("거부됨: 빈 파일(0바이트)입니다.", "error");
    return;
  }
  if (file.size > LIMITS.MAX_BYTES) {
    showMsg(`거부됨: 파일이 너무 큽니다(최대 ${LIMITS.MAX_BYTES / 1024 / 1024}MB).`, "error");
    return;
  }

  let realType;
  try {
    realType = await sniffType(file);
  } catch {
    showMsg("거부됨: 파일을 읽을 수 없습니다.", "error");
    return;
  }
  if (!realType) {
    showMsg("거부됨: PNG 또는 JPEG 파일만 지원합니다.", "error");
    return;
  }

  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);

    if (img.naturalWidth === 0 || img.naturalHeight === 0) throw new Error("empty");
    if (img.naturalWidth > LIMITS.MAX_SIDE || img.naturalHeight > LIMITS.MAX_SIDE) {
      URL.revokeObjectURL(url);
      showMsg(`거부됨: 해상도가 너무 큽니다(변당 최대 ${LIMITS.MAX_SIDE}px).`, "error");
      return;
    }

    state.image = img;
    state.fileName = file.name;
    showMsg(`불러옴: ${file.name} (${realType === "image/png" ? "PNG" : "JPEG"})`, "ok");
    updateMeta();
    render();
  } catch {
    URL.revokeObjectURL(url);
    showMsg("거부됨: 손상되었거나 이미지가 아닌 파일입니다.", "error");
  }
}