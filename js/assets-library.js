import { setStatus } from "./state.js";

// ======================================
// 1. 저장소 설정
// ======================================
const STICKER_KEY = "zzal_custom_stickers_v1";
const FONT_KEY = "zzal_custom_fonts_v1";

const $ = id => document.getElementById(id);

// 로컬 스토리지 읽기 (안전한 파싱)
const read = key => {
  try {
    const result = JSON.parse(localStorage.getItem(key) || "[]");
    return Array.isArray(result) ? result : [];
  } catch {
    return [];
  }
};

// 로컬 스토리지 저장
function store(key, items) {
  try {
    localStorage.setItem(key, JSON.stringify(items));
    return true;
  } catch (error) {
    console.error(error);
    setStatus("브라우저 저장 공간이 부족합니다. 등록 파일을 줄여 주세요.", true);
    return false;
  }
}

// ======================================
// 2. 🟢 커스텀 스티커 기능
// ======================================

export function getCustomStickers() {
  return read(STICKER_KEY);
}

// 🟢 기존 코드에 있던 삭제 함수 (이미 완벽하게 구현되어 있습니다)
export function deleteCustomSticker(id) {
  return store(
    STICKER_KEY,
    getCustomStickers().filter(item => item.id !== id)
  );
}

export async function addCustomSticker(file) {
  // 용량 및 형식 검증
  if (
    !file ||
    !["image/png", "image/jpeg", "image/webp"].includes(file.type) ||
    file.size > 5 * 1024 * 1024
  ) {
    throw new Error("PNG·JPEG·WebP 이미지(5MB 이하)만 추가할 수 있습니다.");
  }

  const url = URL.createObjectURL(file);

  try {
    const img = new Image();

    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
      img.src = url;
    });

    if (!img.naturalWidth || !img.naturalHeight || img.naturalWidth * img.naturalHeight > 32000000) {
      throw new Error("이미지 크기가 너무 큽니다.");
    }

    // 🟢 스티커용 이미지 리사이징 (최대 600px)
    const c = document.createElement("canvas");
    const scale = Math.min(1, 600 / Math.max(img.naturalWidth, img.naturalHeight));
    c.width = Math.max(1, Math.round(img.naturalWidth * scale));
    c.height = Math.max(1, Math.round(img.naturalHeight * scale));
    c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);

    const src = c.toDataURL("image/png");
    const items = getCustomStickers();

    // 최대 12개 제한
    if (items.length >= 12) {
      throw new Error("사용자 스티커는 최대 12개까지 저장할 수 있습니다.");
    }

    const item = {
      id: crypto.randomUUID(),
      kind: "image", // 🟢 커스텀 이미지 타입 명시
      name: file.name.slice(0, 60),
      src: src,
      category: "custom" // 🟢 카테고리 분류 (custom)
    };

    if (!store(STICKER_KEY, [...items, item])) {
      throw new Error("스티커 저장에 실패했습니다.");
    }

    return item;
  } finally {
    URL.revokeObjectURL(url);
  }
}

// ======================================
// 3. 🟢 말풍선 스티커 생성 (유행어 추가)
// ======================================

export function createSpeechBubbleSticker(text, color = "#ffffff") {
  // 캔버스를 이용해 말풍선 이미지를 생성하여 커스텀 스티커로 저장
  const c = document.createElement("canvas");
  const ctx = c.getContext("2d");
  const fontSize = 32;
  const padding = 20;

  ctx.font = `bold ${fontSize}px sans-serif`;
  const textWidth = ctx.measureText(text).width;
  
  c.width = textWidth + padding * 2;
  c.height = fontSize + padding * 2;

  // 말풍선 배경 그리기
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(0, 0, c.width, c.height, 20); // 둥근 사각형
  ctx.fill();

  // 텍스트 그리기
  ctx.fillStyle = "#000000";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, c.width / 2, c.height / 2);

  const src = c.toDataURL("image/png");
  const items = getCustomStickers();

  if (items.length >= 12) {
    throw new Error("사용자 스티커는 최대 12개까지 저장할 수 있습니다.");
  }

  const item = {
    id: crypto.randomUUID(),
    kind: "image",
    name: text.slice(0, 20),
    src: src,
    category: "speech" // 🟢 말풍선 타입 명시
  };

  if (!store(STICKER_KEY, [...items, item])) {
    throw new Error("말풍선 저장에 실패했습니다.");
  }

  return item;
}

// ======================================
// 4. 🟢 커스텀 폰트 기능
// ======================================

export function getCustomFonts() {
  return read(FONT_KEY);
}

async function installFont(item) {
  const font = new FontFace(item.id, `url("${item.data}")`);
  await font.load();
  document.fonts.add(font);
  return font;
}

function appendFontOption(item) {
  const select = $("fontFamily");
  if (!select || [...select.options].some(option => option.value === item.id)) {
    return;
  }

  const option = document.createElement("option");
  option.value = item.id; // 🟢 폰트 ID를 value로 사용
  option.textContent = `📁 ${item.name}`;
  select.appendChild(option);
}

export async function restoreCustomFonts() {
  for (const item of getCustomFonts()) {
    try {
      await installFont(item);
      appendFontOption(item);
    } catch (error) {
      console.warn("글꼴 복원 실패:", item.name, error);
    }
  }
}

export async function addCustomFont(file) {
  const ext = file?.name.split(".").pop()?.toLowerCase();

  if (!file || !["ttf", "otf", "woff", "woff2"].includes(ext) || file.size > 1024 * 1024) {
    throw new Error("TTF·OTF·WOFF·WOFF2 글꼴(1MB 이하)만 추가할 수 있습니다.");
  }

  if (getCustomFonts().length >= 6) {
    throw new Error("사용자 글꼴은 최대 6개까지 저장할 수 있습니다.");
  }

  const data = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  const item = {
    id: `custom-font-${crypto.randomUUID().replaceAll("-", "")}`,
    name: file.name.slice(0, 60),
    data
  };

  await installFont(item);

  if (!store(FONT_KEY, [...getCustomFonts(), item])) {
    throw new Error("글꼴 저장에 실패했습니다.");
  }

  appendFontOption(item);
  return item;
}