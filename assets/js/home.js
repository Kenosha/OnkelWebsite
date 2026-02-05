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
      <stop offset="0" stop-color="#c9973a" stop-opacity="0.25"/>
      <stop offset="0.55" stop-color="#3d9aa3" stop-opacity="0.18"/>
      <stop offset="1" stop-color="#b15a7f" stop-opacity="0.18"/>
    </linearGradient>
  </defs>
  <rect width="900" height="600" fill="#0f0d0a"/>
  <rect x="36" y="36" width="828" height="528" rx="24" fill="url(#g)" opacity="0.55"/>
  <rect x="70" y="70" width="760" height="460" rx="18" fill="rgba(255,246,220,0.05)" stroke="rgba(255,230,160,0.18)"/>
  <text x="450" y="318" text-anchor="middle" font-family="Georgia, serif" font-size="30" fill="rgba(255,250,242,0.9)">Galerie-Vorschau</text>
</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function collectImageEntries(manifest) {
  const out = [];
  const categories = Array.isArray(manifest?.categories) ? manifest.categories : [];
  for (const cat of categories) {
    const catId = String(cat?.id || "");
    const classes = Array.isArray(cat?.classes) ? cat.classes : [];
    for (const cls of classes) {
      const clsId = String(cls?.id || "");
      const sets = Array.isArray(cls?.sets) ? cls.sets : [];
      for (const s of sets) {
        const images = Array.isArray(s?.images) ? s.images : [];
        for (const url of images) {
          const u = String(url || "").trim();
          if (!u) continue;
          out.push({ url: u, catId, clsId });
        }
      }
    }
  }
  // de-dupe by url (first occurrence wins)
  const byUrl = new Map();
  for (const e of out) if (e?.url && !byUrl.has(e.url)) byUrl.set(e.url, e);
  return Array.from(byUrl.values());
}

function setupHomePreview(root, entries, { collection }) {
  const viewport = root.querySelector(".home-preview-viewport");
  const track = root.querySelector("[data-home-preview-track]");
  if (!viewport || !track) return;

  const reduced = prefersReducedMotion();
  const fallback = createFallbackSvgDataUrl();

  const items = Array.from(track.querySelectorAll("[data-home-preview-item]"));
  const imgs = items.map((el) => el.querySelector("img"));
  if (items.length !== 5 || imgs.some((i) => !i)) return;

  const list = Array.isArray(entries) ? entries.filter((e) => e?.url) : [];
  if (list.length === 0) {
    for (const img of imgs) img.src = fallback;
    return;
  }

  const queue = shuffleInPlace(list.slice());

  function nextEntry(avoidUrl) {
    if (queue.length === 0) queue.push(...shuffleInPlace(list.slice()));
    let e = queue.pop() || null;
    if (avoidUrl && e?.url === avoidUrl) {
      if (queue.length === 0) queue.push(...shuffleInPlace(list.slice()));
      e = queue.pop() || e;
    }
    return e;
  }

  function setImgEntry(img, entry) {
    const url = String(entry?.url || "");
    img.src = url || fallback;
    img.dataset.galleryCollection = String(collection || "");
    img.dataset.galleryCat = String(entry?.catId || "");
    img.dataset.galleryClass = String(entry?.clsId || "");
    img.dataset.galleryImg = url;
  }

  // Initial: 5 distinct-ish entries
  for (let i = 0; i < imgs.length; i++) {
    const e = nextEntry();
    setImgEntry(imgs[i], e);
  }

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
    // 1 tile per ~7 seconds (slow/steady)
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

  function pickNextEntry() {
    const used = new Set(imgs.map((i) => i.dataset.galleryImg || i.getAttribute("src") || ""));
    let e = nextEntry();
    let attempts = 0;
    while (used.has(e?.url || "") && attempts < 10) {
      e = nextEntry(e?.url || "");
      attempts++;
    }
    return e;
  }

  function recycleOne() {
    const first = items.shift();
    const firstImg = imgs.shift();
    if (!first || !firstImg) return;

    const e = pickNextEntry();
    setImgEntry(firstImg, e);

    items.push(first);
    imgs.push(firstImg);
    track.appendChild(first);
    preload(queue[queue.length - 1]?.url || null);
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

  root.addEventListener("click", (e) => {
    const img = e.target?.closest?.("img");
    if (img && root.contains(img)) {
      const imgUrl = String(img.dataset.galleryImg || "");
      const cat = String(img.dataset.galleryCat || "");
      const cls = String(img.dataset.galleryClass || "");
      const coll = String(img.dataset.galleryCollection || "");
      const params = new URLSearchParams();
      if (coll) params.set("collection", coll);
      if (cat) params.set("cat", cat);
      if (cls) params.set("cls", cls);
      if (imgUrl) params.set("img", imgUrl);
      const qs = params.toString();
      window.location.href = qs ? `gallerie.html?${qs}` : "gallerie.html";
      return;
    }
    window.location.href = "gallerie.html";
  });
}

async function initHomePreview() {
  const root = document.querySelector("[data-home-preview]");
  if (!root) return;

  try {
    const collection = await getActiveCollection();
    const manifest = await fetchJson(PROCESSED_INDEX_PATH(collection));
    const entries = collectImageEntries(manifest);
    setupHomePreview(root, entries, { collection });
  } catch {
    // Falls lokal ohne Server oder ohne Galerie-Index: wir lassen die Platzhalter stehen.
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initHomePreview);
} else {
  initHomePreview();
}

