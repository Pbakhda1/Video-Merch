/* Video Merch — demo frontend
   - Upload image OR upload video and capture frame
   - Draw selection box on canvas
   - "Search" returns mocked results (ready to replace with real API call)
*/

const imageInput = document.getElementById("imageInput");
const videoInput = document.getElementById("videoInput");
const videoEl = document.getElementById("video");
const captureBtn = document.getElementById("captureBtn");

const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
const canvasHint = document.getElementById("canvasHint");

const clearSelectionBtn = document.getElementById("clearSelectionBtn");
const searchBtn = document.getElementById("searchBtn");
const selectionReadout = document.getElementById("selectionReadout");
const resultsGrid = document.getElementById("resultsGrid");
const sortSelect = document.getElementById("sortSelect");

let sourceImage = null;        // HTMLImageElement or ImageBitmap
let drawing = false;
let selection = null;          // {x,y,w,h} in canvas pixel coords
let startPt = null;

function setCanvasSizeToFit(maxW = 980, maxH = 560) {
  // Canvas should match displayed area but keep enough resolution.
  // We'll resize canvas to the panel width while keeping aspect ratio of the image.
  const wrap = canvas.parentElement;
  const wrapW = wrap.clientWidth;
  const w = Math.min(wrapW, maxW);
  canvas.width = Math.floor(w * window.devicePixelRatio);
  canvas.height = Math.floor(Math.min(maxH, 520) * window.devicePixelRatio);
}

function clearUIState() {
  resultsGrid.innerHTML = `<div class="empty">Upload and select an item to see results.</div>`;
  sortSelect.disabled = true;
  selection = null;
  updateSelectionReadout();
  clearSelectionBtn.disabled = true;
  searchBtn.disabled = true;
}

function updateSelectionReadout() {
  if (!selection) {
    selectionReadout.innerHTML = `Selection: <span class="muted">none</span>`;
    return;
  }
  const { x, y, w, h } = selection;
  selectionReadout.innerHTML = `Selection: <span class="muted">x=${Math.round(x)}, y=${Math.round(y)}, w=${Math.round(w)}, h=${Math.round(h)}</span>`;
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (!sourceImage) return;

  // Draw image fitted to canvas while preserving aspect ratio
  const { dx, dy, dw, dh } = getDrawRectForSource();
  ctx.drawImage(sourceImage, dx, dy, dw, dh);

  // Dim outside selection
  if (selection) {
    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Clear inside selection (clipped to image area)
    ctx.globalCompositeOperation = "destination-out";
    ctx.fillRect(selection.x, selection.y, selection.w, selection.h);

    ctx.restore();

    // Selection outline
    ctx.save();
    ctx.strokeStyle = "rgba(94,234,212,0.95)";
    ctx.lineWidth = Math.max(2, 2 * window.devicePixelRatio);
    ctx.setLineDash([8 * window.devicePixelRatio, 6 * window.devicePixelRatio]);
    ctx.strokeRect(selection.x, selection.y, selection.w, selection.h);
    ctx.restore();
  }
}

function getDrawRectForSource() {
  const sw = sourceImage.width;
  const sh = sourceImage.height;

  const cw = canvas.width;
  const ch = canvas.height;

  // Fit image inside canvas
  const sAspect = sw / sh;
  const cAspect = cw / ch;

  let dw, dh, dx, dy;
  if (sAspect > cAspect) {
    dw = cw;
    dh = cw / sAspect;
    dx = 0;
    dy = (ch - dh) / 2;
  } else {
    dh = ch;
    dw = ch * sAspect;
    dy = 0;
    dx = (cw - dw) / 2;
  }
  return { dx, dy, dw, dh };
}

function clampSelectionToImage(sel) {
  const { dx, dy, dw, dh } = getDrawRectForSource();

  // Clamp box to the drawn image rectangle
  const x1 = Math.max(dx, Math.min(dx + dw, sel.x));
  const y1 = Math.max(dy, Math.min(dy + dh, sel.y));
  const x2 = Math.max(dx, Math.min(dx + dw, sel.x + sel.w));
  const y2 = Math.max(dy, Math.min(dy + dh, sel.y + sel.h));

  const w = Math.max(1, x2 - x1);
  const h = Math.max(1, y2 - y1);

  return { x: x1, y: y1, w, h };
}

function getCanvasPoint(e) {
  const rect = canvas.getBoundingClientRect();
  const x = (e.clientX - rect.left) * window.devicePixelRatio;
  const y = (e.clientY - rect.top) * window.devicePixelRatio;
  return { x, y };
}

function normalizeRect(a, b) {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  const w = Math.abs(a.x - b.x);
  const h = Math.abs(a.y - b.y);
  return { x, y, w, h };
}

canvas.addEventListener("mousedown", (e) => {
  if (!sourceImage) return;
  drawing = true;
  startPt = getCanvasPoint(e);
  selection = null;
  updateSelectionReadout();
  draw();
});

canvas.addEventListener("mousemove", (e) => {
  if (!drawing || !sourceImage) return;
  const pt = getCanvasPoint(e);
  const rect = normalizeRect(startPt, pt);
  selection = clampSelectionToImage(rect);
  updateSelectionReadout();
  draw();
});

window.addEventListener("mouseup", () => {
  if (!drawing) return;
  drawing = false;

  if (selection && selection.w > 8 * window.devicePixelRatio && selection.h > 8 * window.devicePixelRatio) {
    clearSelectionBtn.disabled = false;
    searchBtn.disabled = false;
  } else {
    selection = null;
    clearSelectionBtn.disabled = true;
    searchBtn.disabled = true;
  }
  updateSelectionReadout();
  draw();
});

clearSelectionBtn.addEventListener("click", () => {
  selection = null;
  clearSelectionBtn.disabled = true;
  searchBtn.disabled = true;
  updateSelectionReadout();
  draw();
  clearUIState();
  if (sourceImage) {
    // Keep the image visible but clear results
    resultsGrid.innerHTML = `<div class="empty">Selection cleared. Draw a new box to search again.</div>`;
  }
});

imageInput.addEventListener("change", async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;

  // Reset video
  videoEl.removeAttribute("src");
  videoEl.load();
  captureBtn.disabled = true;

  const url = URL.createObjectURL(file);
  const img = new Image();
  img.onload = async () => {
    sourceImage = img;
    canvasHint.style.display = "none";
    clearUIState();
    setCanvasSizeForImage();
    draw();
  };
  img.src = url;
});

videoInput.addEventListener("change", (e) => {
  const file = e.target.files?.[0];
  if (!file) return;

  // Reset image
  imageInput.value = "";
  sourceImage = null;
  selection = null;
  clearUIState();
  draw();

  const url = URL.createObjectURL(file);
  videoEl.src = url;
  captureBtn.disabled = false;

  canvasHint.style.display = "block";
  canvasHint.textContent = "Pause the video on the frame you want, then click “Capture current frame”.";
});

captureBtn.addEventListener("click", async () => {
  if (!videoEl.src) return;

  // Create an offscreen canvas at the video's native resolution (or close)
  const vw = Math.max(2, Math.floor(videoEl.videoWidth || 1280));
  const vh = Math.max(2, Math.floor(videoEl.videoHeight || 720));

  const off = document.createElement("canvas");
  off.width = vw;
  off.height = vh;
  const offCtx = off.getContext("2d");

  of
