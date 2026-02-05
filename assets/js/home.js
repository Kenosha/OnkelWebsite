const ACTIVE_COLLECTION_PATH = "assets/gallery/_active_collection.txt";
const DEFAULT_COLLECTION = "2026_01_28";
const PROCESSED_INDEX_PATH = (collection) =>
  `assets/gallery/${collection}/processed/index.json`;

let cachedActiveCollection = null;

function prefersReducedMotion() {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false;
}

async function getActiveCollection() {
  if (cachedActiveCollection !== null) return cachedActiveCollection;
  try {
    const res = await fetch(ACTIVE_COLLECTION_PATH, { cache: "no-cache" });
    if (!res.ok) throw new Error("not ok");
    const text = (await res.text()).trim();
    cachedActiveCollection = text || DEFAULT_COLLECTION;
  } catch {
    cachedActiveCollection = DEFAULT_COLLECTION;
  }
  return cachedActiveCollection;
}

async function fetchJson(path) {
  const res = await fetch(path, { cache: "no-cache" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return await res.json();
}

function shuffleInPlace(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

function createFallbackSvgDataUrl() {
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 600">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#7c5cff" stop-opacity="0.35"/>
      <stop offset="0.55" stop-color="#2de2e6" stop-opacity="0.22"/>
      <stop offset="1" stop-color="#ff4ecd" stop-opacity="0.22"/>
    </linearGradient>
  </defs>
  <rect width="900" height="600" fill="#0b0f17"/>
  <rect x="36" y="36" width="828" height="528" rx="24" fill="url(#g)" opacity="0.35"/>
  <rect x="70" y="70" width="760" height="460" rx="18" fill="rgba(255,255,255,0.05)" stroke="rgba(255,255,255,0.14)"/>
  <text x="450" y="318" text-anchor="middle" font-family="ui-sans-serif, system-ui" font-size="30" fill="rgba(255,255,255,0.9)">Galerie-Vorschau</text>
</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function collectImagePool(manifest) {
  const pool = [];
  const categories = Array.isArray(manifest?.categories) ? manifest.categories : [];
  for (const cat of categories) {
    const classes = Array.isArray(cat?.classes) ? cat.classes : [];
    for (const cls of classes) {
      const sets = Array.isArray(cls?.sets) ? cls.sets : [];
      for (const s of sets) {
        const images = Array.isArray(s?.images) ? s.images : [];
        for (const url of images) {
          const u = String(url || "").trim();
          if (!u) continue;
          pool.push(u);
        }
      }
    }
  }
  return pool;
}

function setupHomePreview(root, pool) {
  const viewport = root.querySelector(".home-preview-viewport");
  const track = root.querySelector("[data-home-preview-track]");
  if (!viewport || !track) return;

  const reduced = prefersReducedMotion();
  const fallback = createFallbackSvgDataUrl();

  const items = Array.from(track.querySelectorAll("[data-home-preview-item]"));
  const imgs = items.map((el) => el.querySelector("img"));
  if (items.length !== 5 || imgs.some((i) => !i)) return;

  const uniquePool = Array.from(new Set(pool));
  if (uniquePool.length === 0) {
    for (const img of imgs) img.src = fallback;
    return;
  }

  const queue = shuffleInPlace(uniquePool.slice());

  function nextUrl(avoid) {
    if (queue.length === 0) queue.push(...shuffleInPlace(uniquePool.slice()));
    let u = queue.pop() || fallback;
    if (avoid && u === avoid) {
      if (queue.length === 0) queue.push(...shuffleInPlace(uniquePool.slice()));
      u = queue.pop() || u;
    }
    return u;
  }

  function setItemImage(index, url) {
    const img = imgs[index];
    img.src = url || fallback;
  }

  for (let i = 0; i < imgs.length; i++) setItemImage(i, nextUrl());

  function preload(url) {
    if (!url) return;
    const pre = new Image();
    pre.src = url;
  }

  let itemWidthPx = 0;
  let offsetPx = 0;
  let speedPxPerMs = 0;
  let rafId = 0;
  let lastT = 0;

  function computeLayout() {
    const first = items[0];
    if (!first) return;
    itemWidthPx = first.getBoundingClientRect().width;
    // 1 Item pro ~7 Sekunden (entspannt, konstant)
    speedPxPerMs = itemWidthPx / 7000;
  }

  function updateFocus() {
    const v = viewport.getBoundingClientRect();
    const centerX = v.left + v.width / 2;
    const maxD = v.width / 2;
    for (const el of items) {
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const d = Math.min(maxD, Math.abs(cx - centerX));
      const focus = Math.max(0, 1 - d / maxD);
      el.style.setProperty("--focus", focus.toFixed(3));
    }
  }

  function pickNextUrl() {
    const used = new Set(imgs.map((i) => i.getAttribute("src") || ""));
    let u = nextUrl();
    let attempts = 0;
    while (used.has(u) && attempts < 8) {
      u = nextUrl(u);
      attempts++;
    }
    return u;
  }

  function recycleOne() {
    const first = items.shift();
    const firstImg = imgs.shift();
    if (!first || !firstImg) return;

    const u = pickNextUrl();
    firstImg.src = u || fallback;

    items.push(first);
    imgs.push(firstImg);
    track.appendChild(first);
    preload(queue[queue.length - 1] || null);
  }

  function frame(t) {
    if (document.visibilityState !== "visible") {
      rafId = window.requestAnimationFrame(frame);
      return;
    }
    if (!lastT) lastT = t;
    const dt = Math.min(40, t - lastT);
    lastT = t;

    offsetPx -= speedPxPerMs * dt;

    if (itemWidthPx > 0 && offsetPx <= -itemWidthPx) {
      offsetPx += itemWidthPx;
      recycleOne();
    }

    track.style.transform = `translate3d(${offsetPx}px, 0, 0)`;
    updateFocus();
    rafId = window.requestAnimationFrame(frame);
  }

  computeLayout();
  updateFocus();

  if (!reduced) {
    rafId = window.requestAnimationFrame(frame);
    window.addEventListener(
      "resize",
      () => {
        computeLayout();
        updateFocus();
      },
      { passive: true }
    );
  }

  root.addEventListener("click", () => {
    // Kleine Interaktion: Klick springt zur Galerie.
    window.location.href = "gallerie.html";
  });
}

async function initHomePreview() {
  const root = document.querySelector("[data-home-preview]");
  if (!root) return;

  try {
    const collection = await getActiveCollection();
    const manifest = await fetchJson(PROCESSED_INDEX_PATH(collection));
    const pool = collectImagePool(manifest);
    setupHomePreview(root, pool);
  } catch {
    // Falls lokal ohne Server oder ohne Galerie-Index: wir lassen die Platzhalter stehen.
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initHomePreview);
} else {
  initHomePreview();
}
