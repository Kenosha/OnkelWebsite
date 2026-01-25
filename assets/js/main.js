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

setActiveNavLink();
setYear();

