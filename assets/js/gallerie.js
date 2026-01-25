const EXTENSIONS = ["avif", "webp", "jpg", "jpeg", "png", "svg"];
const MAX_IMAGES_PER_SLIDER = 12;
const DEFAULT_INTERVAL_MS = 3400;
const FADE_MS = 260;

function pad2(number) {
  return String(number).padStart(2, "0");
}

function probeImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(url);
    img.onerror = () => reject(new Error("not found"));
    img.src = url;
  });
}

async function findFirstExistingUrl(base, fileStem) {
  for (const ext of EXTENSIONS) {
    const url = `${base}/${fileStem}.${ext}`;
    try {
      return await probeImage(url);
    } catch {
      // try next extension
    }
  }
  return null;
}

async function collectSliderImages(base) {
  const urls = [];
  let consecutiveMissesAfterFirstHit = 0;
  for (let i = 1; i <= MAX_IMAGES_PER_SLIDER; i++) {
    const fileStem = pad2(i);
    const url = await findFirstExistingUrl(base, fileStem);
    if (url) {
      urls.push(url);
      consecutiveMissesAfterFirstHit = 0;
      continue;
    }

    if (urls.length > 0) {
      consecutiveMissesAfterFirstHit++;
      if (consecutiveMissesAfterFirstHit >= 2) break;
    }
  }
  return urls;
}

function prefersReducedMotion() {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false;
}

function createFallbackSvgDataUrl(title) {
  const safe = String(title || "Platzhalter").replace(/[<>&"]/g, "");
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#7c5cff" stop-opacity="0.55"/>
      <stop offset="0.55" stop-color="#2de2e6" stop-opacity="0.35"/>
      <stop offset="1" stop-color="#ff4ecd" stop-opacity="0.35"/>
    </linearGradient>
  </defs>
  <rect width="800" height="600" fill="#0b0f17"/>
  <rect x="32" y="32" width="736" height="536" rx="22" fill="url(#g)" opacity="0.25"/>
  <rect x="60" y="60" width="680" height="480" rx="18" fill="rgba(255,255,255,0.05)" stroke="rgba(255,255,255,0.14)"/>
  <text x="400" y="306" text-anchor="middle" font-family="ui-sans-serif, system-ui" font-size="34" fill="rgba(255,255,255,0.9)">${safe}</text>
  <text x="400" y="356" text-anchor="middle" font-family="ui-sans-serif, system-ui" font-size="18" fill="rgba(255,255,255,0.65)">Lege Bilder als 01.jpg, 02.jpg, … in den Ordner</text>
</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function setupSlider(sliderRoot, imageUrls) {
  const img = sliderRoot.querySelector("[data-slider-img]");
  const badge = sliderRoot.querySelector("[data-slider-index]");
  if (!img) return;

  const reduced = prefersReducedMotion();
  const intervalMs = reduced ? 0 : DEFAULT_INTERVAL_MS;

  let currentIndex = 0;
  let timer = null;

  function setBadge() {
    if (!badge) return;
    badge.textContent = `${currentIndex + 1}/${imageUrls.length}`;
  }

  function setImage(index, withFade) {
    const nextUrl = imageUrls[index];
    if (!nextUrl) return;

    if (!withFade || reduced) {
      img.src = nextUrl;
      setBadge();
      return;
    }

    img.classList.add("is-fading");
    window.setTimeout(() => {
      img.src = nextUrl;
      setBadge();
      img.classList.remove("is-fading");
    }, FADE_MS);
  }

  function preload(index) {
    const url = imageUrls[index];
    if (!url) return;
    const pre = new Image();
    pre.src = url;
  }

  function next() {
    currentIndex = (currentIndex + 1) % imageUrls.length;
    setImage(currentIndex, true);
    preload((currentIndex + 1) % imageUrls.length);
  }

  function start() {
    if (!intervalMs || imageUrls.length <= 1) return;
    stop();
    timer = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      next();
    }, intervalMs);
  }

  function stop() {
    if (timer) window.clearInterval(timer);
    timer = null;
  }

  img.addEventListener("click", () => {
    // Kleine Bedienhilfe: Klick = nächstes Bild
    if (imageUrls.length <= 1) return;
    next();
    start();
  });

  setImage(0, false);
  preload(1);
  start();

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") start();
  });
}

async function initGallery() {
  const sliderRoots = [...document.querySelectorAll("[data-slider]")];
  if (sliderRoots.length === 0) return;

  await Promise.all(
    sliderRoots.map(async (root) => {
      const base = root.getAttribute("data-base");
      const title = root.querySelector("h3")?.textContent?.trim() || "Platzhalter";

      let urls = [];
      if (base) urls = await collectSliderImages(base);

      if (urls.length === 0) {
        urls = [createFallbackSvgDataUrl(title)];
      }

      setupSlider(root, urls);
    }),
  );
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initGallery);
} else {
  initGallery();
}
