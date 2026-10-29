import { state, render, updateCanvasSize, canvas } from "./state.js";
import { handleFile } from "./file-validation.js";
import { createTemplate, renderTemplateList, exportTemplates, importTemplates } from "./template.js";

// ---------- 탭 전환 ----------
document.querySelectorAll(".tab-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
    document.querySelectorAll(".tab-content").forEach(c => c.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById(btn.dataset.tab).classList.add("active");
  });
});

// ---------- 슬라이더/입력 연결 ----------
function bindRange(id, key) {
  const el = document.getElementById(id);
  const val = document.getElementById(id + "Val");
  el