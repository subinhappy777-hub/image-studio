import {
  state,
  LIMITS,
  render,
  setStatus,
  reflowAllTexts
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

/**
 * 이미지 파일을 검증하고 state.image에 적용합니다.
 *
 * @param {File} file - 업로드된 파일
 * @param {Function|null} onBeforeApply - state 변경 직전에 호출될 콜백
 *                                        (main.js에서 remember()를 넘김)
 * @returns {Promise<boolean>} 성공 여부
 */
export async function handleFile(file, onBeforeApply = null) {
  if (!file) return false;

  // ======================================
  // 2-1. 빈 파일 검사
  // ======================================

  if (file.size === 0) {
    setStatus(
      "빈 파일은 업로드할 수 없습니다. 기존 작업은 유지됩니다.",
      true
    );

    return false;
  }

  // ======================================
  // 2-2. 파일 용량 검사
  // ======================================

  if (file.size > LIMITS.MAX_BYTES) {
    setStatus(
      "파일 크기는 10MB 이하여야 합니다. 기존 작업은 유지됩니다.",
      true
    );

    return false;
  }

  let objectURL = null;

  try {
    // ======================================
    // 2-3. 파일 형식 검사
    // ======================================

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

    // ======================================
    // 2-4. 이미지 읽기
    // ======================================

    objectURL = URL.createObjectURL(file);

    const image = new Image();

    await new Promise((resolve, reject) => {
      image.onload = resolve;
      image.onerror = reject;
      image.src = objectURL;
    });

    const width = image.naturalWidth;
    const height = image.naturalHeight;

    // ======================================
    // 2-5. 이미지 크기 검사
    // ======================================

    if (
      !width ||
      !height ||
      Math.max(width, height) > LIMITS.MAX_SIDE ||
      width * height > LIMITS.MAX_PIXELS
    ) {
      throw new Error("이미지 크기 제한 초과");
    }

    // ======================================
    // 2-6. 검증된 이미지 적용
    // ======================================

    // ★ state 변경 직전에 Undo 기록 (변경 전 상태 저장)
    //   - 검증이 모두 통과한 뒤에만 호출되므로,
    //     로딩 실패/용량 초과 등으로는 Undo 기록이 쌓이지 않음.
    if (typeof onBeforeApply === "function") {
      onBeforeApply();
    }

    state.image = image;

    // 이미지 위치 및 크기 초기화
    state.imageScale = 1;
    state.imageX = 50;
    state.imageY = 50;

    // ======================================
    // ★ 사진 프레임 유지
    // ======================================

    if (!state.frameType) {
      state.frameType = "none";
    }

    // 프레임 선택창과 상태 동기화
    const frameSelect = document.getElementById("frameType");

    if (frameSelect) {
      frameSelect.value = state.frameType;
    }

    // ======================================
    // 2-7. HTML 설정값 초기화
    // ======================================

    const imageScaleInput = document.getElementById("imageScale");
    if (imageScaleInput) {
      imageScaleInput.value = "100";
    }

    const uploadPlaceholder = document.getElementById("uploadPlaceholder");
    if (uploadPlaceholder) {
      uploadPlaceholder.style.display = "none";
    }

    // ======================================
    // 2-8. 텍스트 재배치 + 캔버스 다시 그리기
    // ======================================

    // ★ 이미지 적용 후 텍스트가 캔버스를 벗어나지 않도록 재배치
    reflowAllTexts({ shrink: true });

    render();

    // ======================================
    // 2-9. 완료 메시지
    // ======================================

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
    // ======================================
    // 2-10. 임시 URL 정리
    // ======================================

    if (objectURL) {
      URL.revokeObjectURL(objectURL);
    }
  }
}