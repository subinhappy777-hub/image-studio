import { state, render, updateCanvasSize, canvas } from "./state.js";
import { handleFile } from "./file-validation.js";
import { 
  createTemplate, 
  renderTemplateList, 
  exportTemplates, 
  importTemplates 
} from "./template.js";

// 슬라이더 연결
function bindRange(id, key) {
  const el = document.getElementById(id);
  const val = document.getElementById(id + "Val");
  el.addEventListener("input", () => {
    state[key] = Number(el.value);
    if (val) val.textContent = el.value;
    render();
  });
}

// 화면비 변경
document.getElementById("aspectRatio").addEventListener("change", (e) => {
  state.aspectRatio = e.target.value;
  updateCanvasSize();
  render();
});

// 문구 입력
document.getElementById("textInput").addEventListener("input", (e) => {
  state.text = e.target.value;
  render();
});

// 슬라이더 (X, Y, 크기)
bindRange("posX", "posX");
bindRange("posY", "posY");
bindRange("fontSize", "fontSize");

// 색상
document.getElementById("colorInput").addEventListener("input", (e) => {
  state.color = e.target.value;
  render();
});

// 파일 선택
document.getElementById("fileInput").addEventListener("change", (e) => {
  handleFile(e.target.files && e.target.files[0]);
  e.target.value = "";
});

// 드래그 앤 드롭
const drop = document.getElementById("dropZone");
["dragenter", "dragover"].forEach((ev) =>
  drop.addEventListener(ev, (e) => { e.preventDefault(); drop.style.borderColor = "var(--accent)"; })
);
["dragleave", "drop"].forEach((ev) =>
  drop.addEventListener(ev, (e) => { e.preventDefault(); drop.style.borderColor = ""; })
);
drop.addEventListener("drop", (e) => {
  const f = e.dataTransfer.files && e.dataTransfer.files[0];
  handleFile(f);
});

// 다운로드 버튼 (기기별 해상도 일관성 보장)
document.getElementById("downloadBtn").addEventListener("click", () => {
  // 화면에 보이는 크기와 상관없이 항상 설정된 논리 해상도(720x... )로 렌더링
  render();
  
  // 캔버스의 내부 픽셀 데이터를 그대로 추출 (DPR 영향 없음)
  const dataURL = canvas.toDataURL("image/png");
  
  const link = document.createElement("a");
  const ratioName = state.aspectRatio.replace(":", "x");
  
  // 파일명에 해상도를 포함하여 어떤 기기에서 받았는지 명확히 함
  link.download = `card-studio_${ratioName}_${canvas.width}x${canvas.height}.png`;
  link.href = dataURL;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
});

// 템플릿 저장
document.getElementById("saveTemplateBtn").addEventListener("click", () => {
  createTemplate();
});

// JSON 내보내기/가져오기 이벤트
document.getElementById("exportJsonBtn").addEventListener("click", exportTemplates);

document.getElementById("importJsonBtn").addEventListener("click", () => {
  document.getElementById("jsonFileInput").click();
});

document.getElementById("jsonFileInput").addEventListener("change", (e) => {
  const file = e.target.files && e.target.files[0];
  importTemplates(file);
  e.target.value = "";
});

// 초기화
updateCanvasSize();
render();
renderTemplateList();