import {
  state,
  LIMITS,
  render,
  setStatus
} from "./state.js";

// ======================================
// 1. 파일 형식 확인 (Magic Bytes)
// ======================================

function detectFileType(bytes) {
  const pngSignature = [137, 80, 78, 71, 13, 10, 26, 10];

  const isPNG =
    bytes.length >= 8 &&
    pngSignature.every((value, index) => bytes[index] === value);

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
// 2. 이미지 파일 유효성 검사 (공통 함수)
// ======================================

async function validateImageFile(file) {
  if (!file) return { valid: false, message: "파일이 없습니다." };

  // 빈 파일
  if (file.size === 0) {
    return { valid: false, message: "빈 파일은 업로드할 수 없습니다." };
  }

  // 용량 초과
  if (file.size > LIMITS.MAX_BYTES) {
    return { valid: false, message: "파일 크기는 10MB 이하여야 합니다." };
  }

  // 파일 형식 검사
  try {
    const buffer = await file.slice(0, 12).arrayBuffer();
    const bytes = new Uint8Array(buffer);
    const detectedType = detectFileType(bytes);

    if (!detectedType) {
      return { valid: false, message: "지원하지 않는 파일입니다. PNG 또는 JPEG만 사용할 수 있습니다." };
    }
  } catch {
    return { valid: false, message: "파일을 읽을 수 없습니다." };
  }

  return { valid: true };
}

// ======================================
// 3. 이미지 로드 유틸리티
// ======================================

function loadImageFromURL(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("이미지 로드 실패"));
    img.src = url;
  });
}

// ======================================
// 4. 🟢 이미지 분할 유틸리티 (2등분, 4등분)
// ======================================

/**
 * 이미지를 지정된 행/열로 분할하여 캔버스에 배치합니다.
 * @param {HTMLImageElement} img - 원본 이미지
 * @param {number} rows - 행 수 (1 or 2)
 * @param {number} cols - 열 수 (1 or 2)
 * @returns {HTMLCanvasElement} 분할된 이미지가 배치된 캔버스
 */
function splitImage(img, rows, cols) {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  // 원본 이미지 크기 기준 캔버스 설정
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;

  const pieceW = img.naturalWidth / cols;
  const pieceH = img.naturalHeight / rows;
  const gap = 10; // 분할된 이미지 사이의 간격 (픽셀)

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      // 원본 이미지에서 분할할 영역
      const sx = c * pieceW;
      const sy = r * pieceH;
      const sw = pieceW;
      const sh = pieceH;

      // 분할된 이미지를 캔버스에 배치할 위치 (간격 적용)
      const dx = c * (pieceW + gap);
      const dy = r * (pieceH + gap);

      // 캔버스 크기 보정 (간격만큼 늘어남)
      if (r === 0 && c === 0) {
        canvas.width = img.naturalWidth + gap * (cols - 1);
        canvas.height = img.naturalHeight + gap * (rows - 1);
      }

      ctx.drawImage(img, sx, sy, sw, sh, dx, dy, sw, sh);
    }
  }

  return canvas;
}

// ======================================
// 5. 메인 이미지 업로드 함수
// ======================================

export async function handleFile(file, splitMode = null) {
  // 1. 유효성 검사
  const validation = await validateImageFile(file);
  if (!validation.valid) {
    setStatus(validation.message + " 기존 작업은 유지됩니다.", true);
    return false;
  }

  let objectURL = null;

  try {
    // 2. 이미지 로드
    objectURL = URL.createObjectURL(file);
    let image = await loadImageFromURL(objectURL);

    const width = image.naturalWidth;
    const height = image.naturalHeight;

    // 3. 이미지 크기 검사
    if (
      !width ||
      !height ||
      Math.max(width, height) > LIMITS.MAX_SIDE ||
      width * height > LIMITS.MAX_PIXELS
    ) {
      throw new Error("이미지 크기 제한 초과");
    }

    // ======================================
    // 🟢 4. 사진 분할 처리 (2등분, 4등분)
    // ======================================
    if (splitMode === "2") {
      // 2등분 (세로로 2개)
      const splitCanvas = splitImage(image, 1, 2);
      const splitImageObj = await loadImageFromURL(splitCanvas.toDataURL("image/png"));
      image = splitImageObj;
      setStatus("이미지를 2등분하여 불러왔습니다.");
    } else if (splitMode === "4") {
      // 4등분 (2x2)
      const splitCanvas = splitImage(image, 2, 2);
      const splitImageObj = await loadImageFromURL(splitCanvas.toDataURL("image/png"));
      image = splitImageObj;
      setStatus("이미지를 4등분하여 불러왔습니다.");
    } else {
      setStatus(`${file.name} 이미지를 불러왔습니다.`);
    }

    // 5. 검증된 이미지 적용
    state.image = image;

    // 이미지 위치 및 크기 초기화
    state.imageScale = 1;
    state.imageX = 50;
    state.imageY = 50;

    // 사진 프레임 유지
    if (!state.frameType) {
      state.frameType = "none";
    }

    const frameSelect = document.getElementById("frameType");
    if (frameSelect) {
      frameSelect.value = state.frameType;
    }

    // HTML 설정값 초기화
    document.getElementById("imageScale").value = "100";
    document.getElementById("uploadPlaceholder").style.display = "none";

    // 6. 캔버스 다시 그리기
    render();

    return true;

  } catch (error) {
    console.error("이미지 업로드 오류:", error);
    setStatus("이미지가 손상되었거나 크기 제한을 초과했습니다. 기존 작업은 유지됩니다.", true);
    return false;

  } finally {
    if (objectURL) {
      URL.revokeObjectURL(objectURL);
    }
  }
}