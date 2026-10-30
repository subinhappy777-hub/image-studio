import { state, LIMITS, render } from "./state.js";

export async function handleFile(file) {
  if (!file || file.size === 0) return;
  if (file.size > LIMITS.MAX_BYTES) { alert("파일이 너무 큽니다(최대 10MB)"); return; }
  
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.onload = () => {
    state.image = img;
    document.getElementById("uploadPlaceholder").style.display = "none";
    render();
  };
  img.src = url;
}