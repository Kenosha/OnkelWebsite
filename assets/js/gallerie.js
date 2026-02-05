const DEFAULT_INTERVAL_MS = 3400;
const FADE_MS = 260;
const ACTIVE_COLLECTION_PATH = "assets/gallery/_active_collection.txt";
const DEFAULT_COLLECTION = "2026_01_28";
const PROCESSED_INDEX_PATH = (collection) =>
  `assets/gallery/${collection}/processed/index.json`;
const DEFAULT_HOLD = 4;
const MAX_IMAGES_PER_SET = 60;
const MAX_CONSECUTIVE_MISSES_AFTER_HIT = 2;
const MANUAL_GRACE_MS = 10_000;
const SLIDER_CONTROLLER_KEY = "__onkelSliderController";

// Debug/Smoke-Test: zeigt, ob das Script überhaupt geladen wurde.
window.__onkelGalleryLoaded = true;

let cachedActiveCollection = null;
let lightboxState = null;

function singularizeClassTitle(classId, pluralTitle) {
  const id = String(classId || "").trim();
  const title = String(pluralTitle || "").trim();

  const overrides = {
    leuchtbilder: "Leuchtbild",
    leuchtuhren: "Leuchtuhr",
    ketten: "Kettenskulptur",
    unmoegliche_objekte: "Paradoxes Gebilde",
    blumenvasen: "Blumenvase",
    kerzenhalter: "Kerzenhalter",
    ornamente: "Ornament",
    teelicht_karousel: "Teelicht-Karousell",
    windlichter: "Windlicht",
    flaschenhalter: "Flaschenhalter",
    gabeln: "Serviettenhalter",
    korken: "Korken",
    anhaenger: "Anhänger",
    spieluhren: "Spieluhr",
    verpackung: "Verpackung",
  };
  if (overrides[id]) return overrides[id];

  // Fallback: simple heuristic (best effort).
  if (title.endsWith("en") && title.length > 3) return title.slice(0, -2);
  if (title.endsWith("e") && title.length > 3) return title.slice(0, -1);
  if (title.endsWith("s") && title.length > 3) return title.slice(0, -1);
  return title;
}

function getQueryParam(name) {
  try {
    return new URLSearchParams(window.location.search).get(name) || "";
  } catch {
    return "";
  }
}

function normalizeUrlForMatch(url) {
  const s = String(url || "").trim();
  if (!s) return "";
  return s
    .replace(/^https?:\/\/[^/]+\//i, "")
    .replace(/^\//, "")
    .replace(/#.*$/, "")
    .replace(/\?.*$/, "");
}

function ensureLightbox() {
  if (lightboxState) return lightboxState;

  const overlay = document.createElement("div");
  overlay.className = "lightbox";
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.setAttribute("aria-label", "Bildvorschau");
  overlay.innerHTML = `
	    <div class="lightbox-inner" role="document">
	      <header class="lightbox-head">
	        <p class="lightbox-title">
	          <span data-lightbox-kind></span>
	          <span class="lightbox-name" data-lightbox-name></span>
	        </p>
	        <button type="button" class="lightbox-close" aria-label="Schließen" data-lightbox-close>
	          <span aria-hidden="true">×</span>
	        </button>
	      </header>
	      <div class="lightbox-viewport" data-lightbox-viewport>
	        <img class="lightbox-img" data-lightbox-img alt="" />
	        <button type="button" class="slider-nav prev" aria-label="Vorheriges Bild" data-lightbox-prev>
	          <span aria-hidden="true">‹</span>
	        </button>
	        <button type="button" class="slider-nav next" aria-label="Nächstes Bild" data-lightbox-next>
	          <span aria-hidden="true">›</span>
	        </button>
	      </div>
	      <p class="lightbox-caption small">
	        <span class="muted" data-lightbox-caption></span>
	      </p>
	    </div>
	  `;

  document.body.appendChild(overlay);

  const img = overlay.querySelector("[data-lightbox-img]");
  const caption = overlay.querySelector("[data-lightbox-caption]");
  const nameEl = overlay.querySelector("[data-lightbox-name]");
  const kindEl = overlay.querySelector("[data-lightbox-kind]");
  const closeBtn = overlay.querySelector("[data-lightbox-close]");
  const prevBtn = overlay.querySelector("[data-lightbox-prev]");
  const nextBtn = overlay.querySelector("[data-lightbox-next]");
  const viewport = overlay.querySelector("[data-lightbox-viewport]");

  function isOpen() {
    return overlay.classList.contains("is-open");
  }

  function setOpen(open) {
    overlay.classList.toggle("is-open", Boolean(open));
    document.body.classList.toggle("is-modal-open", Boolean(open));
  }

  function close() {
    if (!isOpen()) return;
    const controller = lightboxState?.controller || null;
    setOpen(false);
    if (controller?.startAuto) {
      controller.pause?.(MANUAL_GRACE_MS);
      controller.startAuto();
    }
    lightboxState.controller = null;
  }

  function syncFromController() {
    const controller = lightboxState?.controller || null;
    if (!controller || !img) return;
    const current = controller.getCurrent?.() || null;
    if (!current) return;
    img.src = current.url || "";
    img.alt = current.alt || "";
    if (kindEl) kindEl.textContent = current.kind || current.title || "";
    if (nameEl) {
      const t = String(current.imageTitle || "").trim();
      nameEl.textContent = t ? ` "${t}"` : "";
    }
    if (caption) caption.textContent = current.caption || "";
  }

  function stepPrev() {
    const controller = lightboxState?.controller || null;
    if (!controller) return;
    controller.prev?.();
    syncFromController();
  }

  function stepNext() {
    const controller = lightboxState?.controller || null;
    if (!controller) return;
    controller.next?.();
    syncFromController();
  }

  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) close();
  });

  closeBtn?.addEventListener("click", close);
  prevBtn?.addEventListener("click", stepPrev);
  nextBtn?.addEventListener("click", stepNext);

  viewport?.addEventListener("click", (e) => {
    // Klick auf das Bild selbst schließt nicht; nur außerhalb (Overlay).
    if (e.target.closest?.(".slider-nav")) return;
  });

  document.addEventListener("keydown", (e) => {
    if (!isOpen()) return;
    if (e.key === "Escape") {
      e.preventDefault();
      close();
      return;
    }
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      stepPrev();
      return;
    }
    if (e.key === "ArrowRight") {
      e.preventDefault();
      stepNext();
      return;
    }
  });

  lightboxState = {
    overlay,
    controller: null,
    open(controller) {
      if (!controller) return;
      lightboxState.controller = controller;
      controller.stopAuto?.();
      setOpen(true);
      syncFromController();
      closeBtn?.focus?.();
    },
  };

  return lightboxState;
}

async function getActiveCollection() {
  if (cachedActiveCollection !== null) return cachedActiveCollection;
  const override = getQueryParam("collection").trim();
  if (override) {
    cachedActiveCollection = override;
    return cachedActiveCollection;
  }
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

function pad3(number) {
  return String(number).padStart(3, "0");
}

async function urlExists(url) {
  try {
    const res = await fetch(url, { method: "HEAD", cache: "no-cache" });
    return res.ok;
  } catch {
    return false;
  }
}

async function collectNumberedJpgs(base) {
  const urls = [];
  let consecutiveMissesAfterHit = 0;
  for (let i = 1; i <= MAX_IMAGES_PER_SET; i++) {
    const url = `${base}/${pad3(i)}.jpg`;
    // HEAD ist günstig (lädt nicht das ganze Bild); funktioniert lokal (python http.server) und auf CDNs.
    const exists = await urlExists(url);
    if (exists) {
      urls.push(url);
      consecutiveMissesAfterHit = 0;
      continue;
    }

    if (urls.length > 0) {
      consecutiveMissesAfterHit++;
      if (consecutiveMissesAfterHit >= MAX_CONSECUTIVE_MISSES_AFTER_HIT) break;
    }
  }
  return urls;
}

function deriveBaseFromImages(images) {
  if (!Array.isArray(images) || images.length === 0) return "";
  const first = String(images[0] || "");
  // Erwartet .../001.jpg
  return first.replace(/\/001\.jpg$/i, "");
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

function setupGroupedSliderWithResolvedSets(sliderRoot, sets) {
  const img = sliderRoot.querySelector("[data-slider-img]");
  const captionEl = sliderRoot.querySelector("[data-slider-caption]");
  const btnPrev = sliderRoot.querySelector("[data-slider-prev]");
  const btnNext = sliderRoot.querySelector("[data-slider-next]");
  const viewport = sliderRoot.querySelector("[data-slider-viewport]");
  if (!img) return;

  const title = sliderRoot.querySelector("h3")?.textContent?.trim() || "Platzhalter";
  const classId = sliderRoot.getAttribute("data-gallery-class") || "";
  const kind = singularizeClassTitle(classId, title);
  const fallback = createFallbackSvgDataUrl(title);

  const normalizedSets = (sets || [])
    .map((s) => ({
      caption: String(s?.caption || ""),
      hold: Number.isFinite(Number(s?.hold)) ? Number(s.hold) : DEFAULT_HOLD,
      images: Array.isArray(s?.images) ? s.images.map(String).filter(Boolean) : [],
      titles: Array.isArray(s?.titles) ? s.titles.map((t) => String(t ?? "")) : [],
    }))
    .filter((s) => s.images.length > 0);

  for (const s of normalizedSets) {
    s.titles = (s.titles || []).slice(0, s.images.length);
    while (s.titles.length < s.images.length) s.titles.push("");
  }

  if (normalizedSets.length === 0) {
    img.src = fallback;
    if (captionEl) captionEl.textContent = "";
    if (btnPrev) btnPrev.disabled = true;
    if (btnNext) btnNext.disabled = true;
    return;
  }

  const reduced = prefersReducedMotion();
  const intervalMs = reduced ? 0 : DEFAULT_INTERVAL_MS;

  let currentSetIndex = 0;
  let currentImageIndex = 0;
  let holdCounter = 0;
  let timer = null;
  let resumeTimeout = null;
  let pausedUntil = 0;

  function currentUrl() {
    const set = normalizedSets[currentSetIndex];
    return set?.images?.[currentImageIndex] || fallback;
  }

  function setCaption() {
    if (!captionEl) return;
    const set = normalizedSets[currentSetIndex];
    captionEl.textContent = set.caption || "";
  }

  function setImage(withFade) {
    const set = normalizedSets[currentSetIndex];
    const nextUrl = set.images[currentImageIndex] || fallback;
    if (!nextUrl) return;

    if (!withFade || reduced) {
      img.src = nextUrl;
      setCaption();
      return;
    }

    img.classList.add("is-fading");
    window.setTimeout(() => {
      img.src = nextUrl;
      setCaption();
      img.classList.remove("is-fading");
    }, FADE_MS);
  }

  function preload(url) {
    if (!url) return;
    const pre = new Image();
    pre.src = url;
  }

  function totalImages() {
    return normalizedSets.reduce((acc, s) => acc + s.images.length, 0);
  }

  function updateControlsEnabled() {
    const enabled = totalImages() > 1;
    if (btnPrev) btnPrev.disabled = !enabled;
    if (btnNext) btnNext.disabled = !enabled;
  }

  function nextAuto() {
    const set = normalizedSets[currentSetIndex];
    const hold = Math.max(1, Number.isFinite(set.hold) ? set.hold : DEFAULT_HOLD);

    holdCounter++;
    if (holdCounter >= hold) {
      holdCounter = 0;
      currentSetIndex = (currentSetIndex + 1) % normalizedSets.length;
      currentImageIndex = 0;
    } else {
      currentImageIndex = (currentImageIndex + 1) % set.images.length;
    }

    const newSet = normalizedSets[currentSetIndex];
    const nextUrl = newSet.images[(currentImageIndex + 1) % newSet.images.length];
    setImage(true);
    preload(nextUrl);
  }

  function nextManual() {
    const set = normalizedSets[currentSetIndex];
    holdCounter = 0;

    if (currentImageIndex + 1 < set.images.length) {
      currentImageIndex++;
    } else {
      currentSetIndex = (currentSetIndex + 1) % normalizedSets.length;
      currentImageIndex = 0;
    }

    const nextSet = normalizedSets[currentSetIndex];
    const nextUrl = nextSet.images[(currentImageIndex + 1) % nextSet.images.length];
    setImage(true);
    preload(nextUrl);
  }

  function prevManual() {
    const set = normalizedSets[currentSetIndex];
    holdCounter = 0;

    if (currentImageIndex - 1 >= 0) {
      currentImageIndex--;
    } else {
      currentSetIndex = (currentSetIndex - 1 + normalizedSets.length) % normalizedSets.length;
      const prevSet = normalizedSets[currentSetIndex];
      currentImageIndex = Math.max(0, prevSet.images.length - 1);
    }

    const currentSet = normalizedSets[currentSetIndex];
    const prevIndex = (currentImageIndex - 1 + currentSet.images.length) % currentSet.images.length;
    preload(currentSet.images[prevIndex]);
    setImage(true);
  }

  function pauseAutoFor(ms) {
    if (!ms || reduced) return;
    pausedUntil = Date.now() + ms;
    if (resumeTimeout) window.clearTimeout(resumeTimeout);
    resumeTimeout = window.setTimeout(() => {
      if (Date.now() >= pausedUntil) pausedUntil = 0;
      resumeTimeout = null;
    }, ms);
  }

  function start() {
    if (!intervalMs) return;
    if (totalImages() <= 1) return;
    stop();
    timer = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      if (pausedUntil && Date.now() < pausedUntil) return;
      nextAuto();
    }, intervalMs);
  }

  function stop() {
    if (timer) window.clearInterval(timer);
    timer = null;
  }

  function setCurrentByUrl(url) {
    const target = normalizeUrlForMatch(url);
    if (!target) return false;
    for (let si = 0; si < normalizedSets.length; si++) {
      const s = normalizedSets[si];
      for (let ii = 0; ii < s.images.length; ii++) {
        const candidate = normalizeUrlForMatch(s.images[ii]);
        if (candidate && candidate === target) {
          currentSetIndex = si;
          currentImageIndex = ii;
          holdCounter = 0;
          setImage(false);
          updateControlsEnabled();
          return true;
        }
      }
    }
    return false;
  }

  const controller = {
    next: nextManual,
    prev: prevManual,
    stopAuto: stop,
    startAuto: start,
    pause: pauseAutoFor,
    setCurrentByUrl,
    getCurrent() {
      const set = normalizedSets[currentSetIndex];
      return {
        url: currentUrl(),
        caption: set?.caption || "",
        imageTitle: (set?.titles || [])[currentImageIndex] || "",
        kind,
        title,
        alt: `${title} – Bildvorschau`,
      };
    },
  };
  sliderRoot[SLIDER_CONTROLLER_KEY] = controller;

  img.addEventListener("error", () => {
    // Wenn die lokalen JPGs noch nicht generiert wurden, vermeiden wir das "broken image" Icon.
    stop();
    img.src = fallback;
  });

  viewport?.addEventListener("click", (e) => {
    if (e.target.closest?.(".slider-nav")) return;
    const lb = ensureLightbox();
    lb.open(controller);
  });

  if (btnPrev) {
    btnPrev.addEventListener("click", () => {
      if (totalImages() <= 1) return;
      prevManual();
      pauseAutoFor(MANUAL_GRACE_MS);
    });
  }

  if (btnNext) {
    btnNext.addEventListener("click", () => {
      if (totalImages() <= 1) return;
      nextManual();
      pauseAutoFor(MANUAL_GRACE_MS);
    });
  }

  setImage(false);
  preload(normalizedSets[0].images[1] || null);
  updateControlsEnabled();
  start();

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") start();
  });
}

async function setupGroupedSlider(sliderRoot, sets) {
  // Sets können entweder:
  // - bereits `images` enthalten (schnell), oder
  // - nur `base` enthalten (dann probieren wir 001.jpg, 002.jpg, ... direkt aus processed/).
  const resolved = [];
  for (const s of sets || []) {
    const caption = String(s?.caption || "");
    const hold = Number.isFinite(Number(s?.hold)) ? Number(s.hold) : DEFAULT_HOLD;
    const explicitImages = Array.isArray(s?.images) ? s.images.map(String).filter(Boolean) : [];
    const explicitTitles = Array.isArray(s?.titles) ? s.titles.map((t) => String(t ?? "")) : [];
    const base = String(s?.base || deriveBaseFromImages(explicitImages) || "");

    let images = explicitImages;
    let titles = explicitTitles;
    if (base && images.length === 0) {
      const probed = await collectNumberedJpgs(base);
      if (probed.length > 0) images = probed;
      titles = [];
    }

    if (images.length > 0) {
      titles = titles.slice(0, images.length);
      while (titles.length < images.length) titles.push("");
      resolved.push({ caption, hold, images, titles });
    }
  }

  setupGroupedSliderWithResolvedSets(sliderRoot, resolved);
}

function renderGallery(root, manifest) {
  if (!root) return;
  root.innerHTML = "";

  const categories = Array.isArray(manifest?.categories) ? manifest.categories : [];
  if (categories.length === 0) {
    const section = document.createElement("section");
    section.className = "section";
    section.innerHTML = `
      <div class="container">
        <div class="card">
          <h2>Galerie wird vorbereitet</h2>
          <p class="muted">
            Es wurden noch keine Galerie-Daten gefunden. Erzeuge sie lokal aus dem Ordner
            <code>assets/gallery/&lt;YYYY_MM_DD&gt;/original/</code>.
          </p>
          <p class="muted small">Befehl: <code>python3 scripts/build_gallery_processed.py</code></p>
        </div>
      </div>
    `;
    root.appendChild(section);
    return;
  }
  for (const cat of categories) {
    const section = document.createElement("section");
    section.className = "section";
    if (cat?.id) section.setAttribute("data-gallery-cat", String(cat.id));

    const container = document.createElement("div");
    container.className = "container";

    const head = document.createElement("header");
    head.className = "section-head";

    const h2 = document.createElement("h2");
    h2.textContent = String(cat?.title || "");
    head.appendChild(h2);

    container.appendChild(head);

    const grid = document.createElement("div");
    grid.className = "gallery-grid";

    const classes = Array.isArray(cat?.classes) ? cat.classes : [];
    for (const cls of classes) {
      const article = document.createElement("article");
      article.className = "gallery-view";
      article.setAttribute("data-slider", "");
      if (cls?.id) article.setAttribute("data-gallery-class", String(cls.id));

      const viewTop = document.createElement("div");
      viewTop.className = "view-top";

      const h3 = document.createElement("h3");
      h3.textContent = String(cls?.title || "");
      viewTop.appendChild(h3);

      const subtitle = String(cls?.subtitle || "");
      if (subtitle) {
        const p = document.createElement("p");
        p.className = "muted";
        p.textContent = subtitle;
        viewTop.appendChild(p);
      }

      const caption = document.createElement("p");
      caption.className = "muted small";
      caption.setAttribute("data-slider-caption", "");
      viewTop.appendChild(caption);

      const slider = document.createElement("div");
      slider.className = "slider";
      slider.setAttribute("data-slider-viewport", "");

      const img = document.createElement("img");
      img.className = "slider-img";
      img.setAttribute("data-slider-img", "");
      img.alt = `${String(cls?.title || "Galerie")} – Beispiele`;
      img.loading = "lazy";
      slider.appendChild(img);

      const prev = document.createElement("button");
      prev.type = "button";
      prev.className = "slider-nav prev";
      prev.setAttribute("data-slider-prev", "");
      prev.setAttribute("aria-label", "Vorheriges Bild");
      prev.innerHTML = "<span aria-hidden=\"true\">‹</span>";
      slider.appendChild(prev);

      const next = document.createElement("button");
      next.type = "button";
      next.className = "slider-nav next";
      next.setAttribute("data-slider-next", "");
      next.setAttribute("aria-label", "Nächstes Bild");
      next.innerHTML = "<span aria-hidden=\"true\">›</span>";
      slider.appendChild(next);

      article.appendChild(viewTop);
      article.appendChild(slider);

      grid.appendChild(article);

      // async: lädt ggf. die nummerierten Bilder aus processed/ nach
      void setupGroupedSlider(article, cls?.sets || []);
    }

    container.appendChild(grid);
    section.appendChild(container);
    root.appendChild(section);
  }
}

function findGalleryArticle(root, classId) {
  if (!root || !classId) return null;
  const wanted = String(classId);
  const articles = root.querySelectorAll("[data-gallery-class]");
  for (const el of articles) {
    if (String(el.getAttribute("data-gallery-class") || "") === wanted) return el;
  }
  return null;
}

function waitForSliderController(sliderRoot, timeoutMs = 6000) {
  return new Promise((resolve) => {
    const start = Date.now();
    const tick = () => {
      const c = sliderRoot?.[SLIDER_CONTROLLER_KEY] || null;
      if (c) return resolve(c);
      if (Date.now() - start >= timeoutMs) return resolve(null);
      window.requestAnimationFrame(tick);
    };
    tick();
  });
}

async function applyDeepLink(root) {
  const cls = getQueryParam("cls").trim();
  const img = getQueryParam("img").trim();
  if (!cls) return;

  const article = findGalleryArticle(root, cls);
  if (!article) return;

  article.scrollIntoView({ behavior: "smooth", block: "center" });
  const controller = await waitForSliderController(article);
  if (!controller) return;

  if (img && controller.setCurrentByUrl) controller.setCurrentByUrl(img);
  ensureLightbox().open(controller);

  // Avoid re-opening on refresh/back.
  try {
    const u = new URL(window.location.href);
    u.searchParams.delete("cat");
    u.searchParams.delete("cls");
    u.searchParams.delete("img");
    window.history.replaceState({}, "", u.toString());
  } catch {
    // ignore
  }
}

async function initGallery() {
  const root = document.querySelector("[data-gallery-root]");
  if (!root) return;

  try {
    const collection = await getActiveCollection();
    const indexPath = PROCESSED_INDEX_PATH(collection);

    root.innerHTML = `
      <section class="section">
        <div class="container">
          <div class="card">
            <h2>Galerie lädt…</h2>
            <p class="muted small">
              Collection: <code>${collection}</code> · Index: <code>${indexPath}</code>
            </p>
          </div>
        </div>
      </section>
    `;

    if (location.protocol === "file:") {
      root.innerHTML = `
        <section class="section">
          <div class="container">
            <div class="card">
              <h2>Lokal testen</h2>
              <p class="muted">
                Öffne die Seite bitte über einen lokalen Server (nicht <code>file://</code>), sonst
                dürfen Browser keine JSON-Dateien laden.
              </p>
              <p class="muted small">
                Starte z.B. <code>python3 -m http.server 8000</code> und öffne dann
                <code>http://localhost:8000/gallerie.html</code>.
              </p>
            </div>
          </div>
        </section>
      `;
      return;
    }

    const manifest = await fetchJson(indexPath);
    renderGallery(root, manifest);
    void applyDeepLink(root);
  } catch (err) {
    const msg = String(err?.message || err || "Unbekannter Fehler");
    root.innerHTML = `
      <section class="section">
        <div class="container">
          <div class="card">
            <h2>Galerie-Fehler</h2>
            <p class="muted small"><code>${msg}</code></p>
            <p class="muted small">Tipp: <code>python3 scripts/build_gallery_processed.py</code></p>
          </div>
        </div>
      </section>
    `;
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initGallery);
} else {
  initGallery();
}
