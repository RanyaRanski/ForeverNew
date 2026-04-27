// =============================================================
// Forever Living — interactive behaviour (vanilla JS)
// =============================================================

(function () {
  // ---- Mobile menu toggle ----
  const header = document.getElementById("siteHeader");
  const toggle = document.getElementById("navToggle");

  if (header && toggle) {
    function syncHeaderScrollState() {
      header.classList.toggle("is-scrolled", window.scrollY > 18);
    }

    function setMenuState(isOpen) {
      header.classList.toggle("is-open", isOpen);
      toggle.setAttribute("aria-expanded", String(isOpen));
    }

    toggle.setAttribute("aria-expanded", "false");
    syncHeaderScrollState();

    window.addEventListener("scroll", syncHeaderScrollState, { passive: true });

    toggle.addEventListener("click", function () {
      setMenuState(!header.classList.contains("is-open"));
    });

    // Close menu when a link inside it is clicked
    header.querySelectorAll(".mobile-menu a").forEach(function (a) {
      a.addEventListener("click", function () {
        setMenuState(false);
      });
    });

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") {
        setMenuState(false);
      }
    });

    window.addEventListener("resize", function () {
      if (window.innerWidth >= 1024 && header.classList.contains("is-open")) {
        setMenuState(false);
      }
    });
  }

  // ---- Toast notifications ----
  function toast(message, type) {
    const root = document.getElementById("toastRoot");
    if (!root) return;
    const el = document.createElement("div");
    el.className = "toast " + (type || "");
    el.textContent = message;
    root.appendChild(el);
    setTimeout(function () {
      el.style.transition = "opacity 0.3s ease, transform 0.3s ease";
      el.style.opacity = "0";
      el.style.transform = "translateY(20px)";
      setTimeout(function () { el.remove(); }, 300);
    }, 3500);
  }

  // ---- Contact form ----
  const form = document.getElementById("contactForm");
  if (form) {
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      toast("Дякуємо! Ми зв'яжемось з вами найближчим часом.", "success");
      form.reset();
    });
  }
})();
