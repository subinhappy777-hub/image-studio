
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
// 2. 이미지 파일 유효성 검사
// ======================================

async function validateImageFile(file) {
  if (!file) {
    return { valid: false, message: "파일이 없습니다." };
  }

  if (file.size === 0) {
    return { valid: false, message: "빈 파일은 업로드할 수 없습니다." };
  }

  if (file.size > LIMITS.MAX_BYTES) {
    return { valid: false, message: "파일 크기는 10MB 이하여야 합니다." };
  }

  try {
    const buffer = await file.slice(0, 12).arrayBuffer();
    const bytes = new Uint8Array(buffer);
    const detectedType = detectFileType(bytes);

    if (!detectedType) {
      return {
        valid: false,
        message: "PNG 또는 JPEG 파일만 사용할 수 있습니다."
      };
    }
  } catch {
    return {
      valid: false,
      message: "파일을 읽을 수 없습니다."
    };
  }

  return { valid: true };
}

// ======================================
// 3. 이미지 로드
// ======================================

function loadImageFromURL(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();

    img.onload = () => resolve(img);

    img.onerror = () => {
      reject(new Error("이미지를 불러오지 못했습니다."));
    };

    img.src = url;
  });
}

// ======================================
// 4. 이미지 분할
// ======================================

function splitImage(img, rows, cols) {
  const gap = 10;

  const pieceW = img.naturalWidth / cols;
  const pieceH = img.naturalHeight / rows;

  const canvas = document.createElement("canvas");

  canvas.width = img.naturalWidth + gap * (cols - 1);
  canvas.height = img.naturalHeight + gap * (rows - 1);

  // 캔버스 크기 설정 후 context 생성
  const ctx = canvas.getContext("2d");

  if (!ctx) {
    throw new Error("캔버스를 생성할 수 없습니다.");
  }

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const sx = c * pieceW;
      const sy = r * pieceH;

      const dx = c * (pieceW + gap);
      const dy = r * (pieceH + gap);

      ctx.drawImage(
        img,
        sx,
        sy,
        pieceW,
        pieceH,
        dx,
        dy,
        pieceW,
        pieceH
      );
    }
  }

  return canvas;
}

// ======================================
// 5. 메인 이미지 업로드
// ======================================

export async function handleFile(file, splitMode = null) {
  const validation = await validateImageFile(file);

  if (!validation.valid) {
    setStatus(validation.message + " 기존 작업은 유지됩니다.", true);
    return false;
  }

  let objectURL = null;

  try {
    // 이미지 읽기
    objectURL = URL.createObjectURL(file);

    let image = await loadImageFromURL(objectURL);

    const width = image.naturalWidth;
    const height = image.naturalHeight;

    // 이미지 크기 검사
    if (
      !width ||
      !height ||
      Math.max(width, height) > LIMITS.MAX_SIDE ||
      width * height > LIMITS.MAX_PIXELS
    ) {
      throw new Error("이미지 크기 제한을 초과했습니다.");
    }

    // ======================================
    // 이미지 분할
    // ======================================

    if (splitMode === "2") {
      const splitCanvas = splitImage(image, 1, 2);

      image = await loadImageFromURL(
        splitCanvas.toDataURL("image/png")
      );

    } else if (splitMode === "4") {
      const splitCanvas = splitImage(image, 2, 2);

      image = await loadImageFromURL(
        splitCanvas.toDataURL("image/png")
      );
    }

    // ======================================
    // 이미지 상태 적용
    // ======================================

    state.image = image;

    state.imageScale = 1;
    state.imageX = 50;
    state.imageY = 50;

    if (!state.frameType) {
      state.frameType = "none";
    }

    // 프레임 선택값 동기화
    const frameSelect = document.getElementById("frameType");

    if (frameSelect) {
      frameSelect.value = state.frameType;
    }

    // 이미지 크기 조절값 초기화
    const imageScaleInput = document.getElementById("imageScale");

    if (imageScaleInput) {
      imageScaleInput.value = "100";
    }

    // 이미지 업로드 안내창 숨기기
    const uploadPlaceholder =
      document.getElementById("uploadPlaceholder");

    if (uploadPlaceholder) {
      uploadPlaceholder.style.display = "none";
    }

    // 캔버스 다시 그리기
    render();

    if (splitMode === "2") {
      setStatus("이미지를 2등분하여 불러왔습니다.");
    } else if (splitMode === "4") {
      setStatus("이미지를 4등분하여 불러왔습니다.");
    } else {
      setStatus(`${file.name} 이미지를 불러왔습니다.`);
    }

    return true;

  } catch (error) {
    console.error("이미지 업로드 오류:", error);

    setStatus(
      error.message || "이미지를 불러오지 못했습니다.",
      true
    );

    return false;

  } finally {
    if (objectURL) {
      URL.revokeObjectURL(objectURL);
    }
  }
}
