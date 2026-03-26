function setActiveNavLink() {
  const current = (location.pathname.split("/").pop() || "index.html").toLowerCase();
  for (const link of document.querySelectorAll(".nav-link")) {
    const href = (link.getAttribute("href") || "").toLowerCase();
    if (href === current) link.setAttribute("aria-current", "page");
  }
}

function setYear() {
  const year = String(new Date().getFullYear());
  for (const el of document.querySelectorAll("[data-year]")) el.textContent = year;
}

function setupMobileNav() {
  const toggle = document.querySelector("[data-nav-toggle]");
  const nav = document.querySelector("[data-nav]");
  if (!toggle || !nav) return;

  function setOpen(open) {
    const isOpen = Boolean(open);
    toggle.setAttribute("aria-expanded", isOpen ? "true" : "false");
    toggle.setAttribute("aria-label", isOpen ? "Navigation schließen" : "Navigation öffnen");
    nav.classList.toggle("is-open", isOpen);
    document.body.classList.toggle("is-nav-open", isOpen);
  }

  toggle.addEventListener("click", () => {
    const isOpen = toggle.getAttribute("aria-expanded") === "true";
    setOpen(!isOpen);
  });

  for (const link of nav.querySelectorAll(".nav-link")) {
    link.addEventListener("click", () => setOpen(false));
  }

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") setOpen(false);
  });

  window.addEventListener(
    "resize",
    () => {
      if (window.innerWidth > 720) setOpen(false);
    },
    { passive: true }
  );
}

setActiveNavLink();
setYear();
setupMobileNav();
