// Video Merch — reliable demo frontend
// - Upload image OR upload video and capture frame
// - Draw selection box on canvas
// - "Search" shows mocked results (plug in backend later)

const imageInput = document.getElementById("imageInput");
const videoInput = document.getElementById("videoInput");
const videoEl = document.getElementById("video");
const captureBtn = document.getElementById("captureBtn");
const videoStatus = document.getElementById("videoStatus");

const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
const canvasHint = document.getElementById("canvasHint");

const clearSelectionBtn = document.getElementById("clearSelectionBtn");
const searchBtn = document.getElementById("searchBtn");
const selectionReadout = document.getElementById("selectionReadout");
const resultsGrid = document.getElementById("resultsGrid");
const sortSelect = document.getElementById("sortSelect");

let sourceImage = null;     // HTMLImageElement or ImageBitmap
let drawing = false;
let selection = null;       // {x,y,w,h} in canvas pixels
let startPt = null;

let lastResults = null;

// ---------- Helpers ----------
function resetResultsUI(message = "Upload and select an item to see results.") {
  resultsGrid.innerHTML = `<div class="empty">${escapeHtml(message)}</div>`;
  sortSelect.disabled = true;
  lastResults = null;
}

function updateSelectionReadout() {
  if (!selection) {
    selectionReadout.innerHTML = `Selection: <span class="muted">none</span>`;
    return;
  }
  const { x, y, w, h } = selection;
  selectionReadout.innerHTML =
    `Selection: <span class="muted">x=${Math.round(x)}, y=${Math.round(y)}, w=${Math.round(w)}, h=${Math.round(h)}</span>`;
}

function setCanvasSizeForImage() {
  if (!sourceImage) return;

  const wrap = canvas.parentElement;
  const wrapW = wrap.clientWidth;

  const maxH = 520;

  const aspect = sourceImage.width / sourceImage.height;
  let targetW = wrapW;
  let targetH = targetW / aspect;

  if (targetH > maxH) {
    targetH = maxH;
    targetW = targetH * aspect;
  }

  canvas.width = Math.floor(targetW * window.devicePixelRatio);
  canvas.height = Math.floor(targetH * window.devicePixelRatio);
}

function getDrawRectForSource() {
  const sw = sourceImage.width;
  const sh = sourceImage.height;
  const cw = canvas.width;
  const ch = canvas.height;

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

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (!sourceImage) return;

  const { dx, dy, dw, dh } = getDrawRectForSource();
  ctx.drawImage(sourceImage, dx, dy, dw, dh);

  // Safer overlay that does NOT erase image
  if (selection) {
    ctx.save();

    // Dim outside selection using even-odd fill
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.beginPath();
    ctx.rect(0, 0, canvas.width, canvas.height);
    ctx.rect(selection.x, selection.y, selection.w, selection.h);
    ctx.fill("evenodd");

    // Outline
    ctx.strokeStyle = "rgba(94,234,212,0.95)";
    ctx.lineWidth = Math.max(2, 2 * window.devicePixelRatio);
    ctx.setLineDash([8 * window.devicePixelRatio, 6 * window.devicePixelRatio]);
    ctx.strokeRect(selection.x, selection.y, selection.w, selection.h);

    ctx.restore();
  }
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, s => ({
    "&":"&amp;",
    "<":"&lt;",
    ">":"&gt;",
    '"':"&quot;",
    "'":"&#039;"
  }[s]));
}

// ---------- Canvas selection events ----------
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

  const minSize = 10 * window.devicePixelRatio;

  if (selection && selection.w > minSize && selection.h > minSize) {
    clearSelectionBtn.disabled = false;
    searchBtn.disabled = false;
    resetResultsUI("Selection ready. Click “Search lowest price”.");
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
  resetResultsUI("Selection cleared. Draw a new box to search again.");
});

// ---------- Image Upload ----------
imageInput.addEventListener("change", async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;

  // Reset video
  videoInput.value = "";
  videoEl.removeAttribute("src");
  videoEl.load();
  captureBtn.disabled = true;
  videoStatus.textContent = "Upload a video to enable capture.";

  selection = null;
  clearSelectionBtn.disabled = true;
  searchBtn.disabled = true;
  updateSelectionReadout();

  const url = URL.createObjectURL(file);
  const img = new Image();

  img.onload = () => {
    sourceImage = img;

    canvasHint.style.display = "none";
    setCanvasSizeForImage();
    draw();

    resetResultsUI("Image loaded. Draw a box around the item you want.");
  };

  img.onerror = () => {
    resetResultsUI("Image failed to load. Try PNG/JPG (avoid HEIC).");
  };

  img.src = url;
});

// ---------- Video Upload (FIXED: waits for metadata) ----------
videoInput.addEventListener("change", (e) => {
  const file = e.target.files?.[0];
  if (!file) return;

  // Reset image
  imageInput.value = "";
  sourceImage = null;
  selection = null;
  clearSelectionBtn.disabled = true;
  searchBtn.disabled = true;
  updateSelectionReadout();
  resetResultsUI("Video loaded. Pause on a frame and click “Capture current frame”.");

  const url = URL.createObjectURL(file);
  videoEl.src = url;

  captureBtn.disabled = true;
  videoStatus.textContent = "Loading video… please wait.";
  canvasHint.style.display = "block";
  canvasHint.textContent = "Loading video… (wait 1–2 seconds)";

  videoEl.onloadedmetadata = () => {
    captureBtn.disabled = false;
    videoStatus.textContent = "Pause on the frame you want, then click Capture.";
    canvasHint.textContent = "Pause the video on the frame you want, then click “Capture current frame”.";
  };

  videoEl.onerror = () => {
    captureBtn.disabled = true;
    videoStatus.textContent = "Video failed to load. Try MP4 (H.264) or WEBM.";
    canvasHint.textContent = "Video failed to load. Try MP4 (H.264) or WEBM.";
  };
});

// ---------- Capture Frame ----------
captureBtn.addEventListener("click", async () => {
  if (!videoEl.src) return;

  // Guard: avoid blank captures
  if (!videoEl.videoWidth || !videoEl.videoHeight) {
    alert("Video not ready yet. Wait 1–2 seconds, then try again.");
    return;
  }

  const vw = videoEl.videoWidth;
  const vh = videoEl.videoHeight;

  const off = document.createElement("canvas");
  off.width = vw;
  off.height = vh;
  const offCtx = off.getContext("2d");

  offCtx.drawImage(videoEl, 0, 0, vw, vh);

  try {
    sourceImage = await createImageBitmap(off);
  } catch {
    const dataUrl = off.toDataURL("image/png");
    const img = new Image();
    img.src = dataUrl;
    await img.decode();
    sourceImage = img;
  }

  selection = null;
  clearSelectionBtn.disabled = true;
  searchBtn.disabled = true;
  updateSelectionReadout();

  canvasHint.style.display = "none";
  setCanvasSizeForImage();
  draw();

  resetResultsUI("Frame captured. Draw a box around the item you want.");
});

// Resize handling
window.addEventListener("resize", () => {
  if (!sourceImage) return;
  setCanvasSizeForImage();
  draw();
});

// ---------- Search + Results ----------
searchBtn.addEventListener("click", () => {
  if (!sourceImage || !selection) return;

  const results = mockSearchResults();
  sortSelect.disabled = false;
  sortSelect.value = "price";

  renderResults(results, sortSelect.value);
});

sortSelect.addEventListener("change", () => {
  if (!lastResults) return;
  renderResults(lastResults, sortSelect.value);
});

function renderResults(results, sortKey) {
  lastResults = results;

  const sorted = [...results].sort((a, b) => {
    if (sortKey === "price") return a.totalPrice - b.totalPrice;
    if (sortKey === "rating") return b.rating - a.rating;
    if (sortKey === "match") return b.matchScore - a.matchScore;
    return 0;
  });

  resultsGrid.innerHTML = "";

  for (const r of sorted) {
    const card = document.createElement("div");
    card.className = "card";

    card.innerHTML = `
      <div style="font-weight:900">${escapeHtml(r.title)}</div>
      <div class="meta">${escapeHtml(r.marketplace)} • ${escapeHtml(r.condition)} • ${r.shipping === 0 ? "Free shipping" : "$" + r.shipping.toFixed(2) + " shipping"}</div>
      <div class="price">$${r.totalPrice.toFixed(2)} <span class="muted" style="font-size:12px;font-weight:700">total</span></div>
      <div class="badges">
        <div class="badge">Match ${Math.round(r.matchScore * 100)}%</div>
        <div class="badge">★ ${r.rating.toFixed(1)}</div>
      </div>
      <a href="#" onclick="return false;">Open listing</a>
    `;
    resultsGrid.appendChild(card);
  }
}

function mockSearchResults() {
  const base = [
    { marketplace: "Amazon",  title: "Retro 2-Slice Toaster (Similar style)", condition: "New",  shipping: 0,    itemPrice: 34.99, matchScore: 0.86, rating: 4.5 },
    { marketplace: "eBay",    title: "Vintage-Style Toaster — Stainless (Closest color)", condition: "New", shipping: 6.95, itemPrice: 28.50, matchScore: 0.82, rating: 4.2 },
    { marketplace: "Alibaba", title: "Custom Color Toaster OEM (Bulk)", condition: "New", shipping: 18.00, itemPrice: 19.99, matchScore: 0.73, rating: 4.0 },
    { marketplace: "eBay",    title: "Retro Toaster — Used (Good condition)", condition: "Used", shipping: 9.25, itemPrice: 14.99, matchScore: 0.66, rating: 4.1 },
    { marketplace: "Amazon",  title: "Modern Toaster 4-Slice (Similar shape)", condition: "New", shipping: 0, itemPrice: 44.00, matchScore: 0.62, rating: 4.6 },
    { marketplace: "Alibaba", title: "Retro Toaster Factory Direct (Sample)", condition: "New", shipping: 22.00, itemPrice: 16.50, matchScore: 0.70, rating: 3.9 }
  ];

  return base.map(x => ({ ...x, totalPrice: x.itemPrice + x.shipping }));
}

// Initial state
resetResultsUI();
updateSelectionReadout();
