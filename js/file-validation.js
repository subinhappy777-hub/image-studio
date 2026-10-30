import {
  state,
  LIMITS,
  render,
  setStatus
} from "./state.js";

// ======================================
// 1. 파일 형식 확인
// ======================================

function detectFileType(bytes) {
  const pngSignature = [
    137, 80, 78, 71, 13, 10, 26, 10
  ];

  const isPNG =
    bytes.length >= 8 &&
    pngSignature.every(
      (value, index) => bytes[index] === value
    );

  const isJPEG =
    bytes.length >= 3 &&
    bytes[0] === 255 &&
    bytes[1] === 216 &&
    bytes[2] === 255;

  if (isPNG) return "image/png";
  if (isJPEG) return "image/jpeg";

  return null;
}

// ======================================
// 2. 이미지 업로드
// ======================================

export async function handleFile(file) {
  if (!file) return false;

  // 빈 파일
  if (file.size === 0) {
    setStatus(
      "빈 파일은 업로드할 수 없습니다. 기존 작업은 유지됩니다.",
      true
    );
    return false;
  }

  // 파일 용량
  if (file.size > LIMITS.MAX_BYTES) {
    setStatus(
      "파일 크기는 10MB 이하여야 합니다. 기존 작업은 유지됩니다.",
      true
    );
    return false;
  }

  let objectURL = null;

  try {
    // 파일 시작 바이트 확인
    const buffer = await file.slice(0, 12).arrayBuffer();

    const bytes = new Uint8Array(buffer);

    const detectedType = detectFileType(bytes);

    if (!detectedType) {
      setStatus(
        "지원하지 않는 파일입니다. PNG 또는 JPEG만 사용할 수 있습니다.",
        true
      );
      return false;
    }

    // 이미지 읽기
    objectURL = URL.createObjectURL(file);

    const image = new Image();

    await new Promise((resolve, reject) => {
      image.onload = resolve;
      image.onerror = reject;
      image.src = objectURL;
    });

    const width = image.naturalWidth;
    const height = image.naturalHeight;

    // 이미지 크기 검증
    if (
      !width ||
      !height ||
      Math.max(width, height) > LIMITS.MAX_SIDE ||
      width * height > LIMITS.MAX_PIXELS
    ) {
      throw new Error("이미지 크기 제한 초과");
    }

    // 검증된 이미지만 기존 이미지와 교체
    state.image = image;

    state.imageScale = 1;
    state.imageX = 50;
    state.imageY = 50;

    document.getElementById("imageScale").value = "100";

    document.getElementById(
      "uploadPlaceholder"
    ).style.display = "none";

    render();

    setStatus(
      `${file.name} 이미지를 불러왔습니다.`
    );

    return true;

  } catch (error) {
    console.error("이미지 업로드 오류:", error);

    setStatus(
      "이미지가 손상되었거나 크기 제한을 초과했습니다. 기존 작업은 유지됩니다.",
      true
    );

    return false;

  } finally {
    if (objectURL) {
      URL.revokeObjectURL(objectURL);
    }
  }
}