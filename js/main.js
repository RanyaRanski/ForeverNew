// =============================================================
// Forever Living — interactive behaviour (vanilla JS)
// =============================================================

(function () {
  const LEADS_ENDPOINT = "https://formsubmit.co/ajax/hello@forever.ua";
  const LEAD_RATE_LIMIT_MS = 20000;
  const MIN_FILL_TIME_MS = 1200;
  const FORM_LOAD_TS = Date.now();
  const PHONE_RE = /^\+?[0-9()\-\s]{8,22}$/;
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

  window.showToast = window.showToast || toast;

  function cleanText(value, maxLen) {
    const str = String(value || "")
      .replace(/\s+/g, " ")
      .replace(/[<>]/g, "")
      .trim();
    return str.slice(0, maxLen || 250);
  }

  function isRateLimited() {
    try {
      const lastAt = Number(localStorage.getItem("forever_lead_last_at") || 0);
      return Date.now() - lastAt < LEAD_RATE_LIMIT_MS;
    } catch (_err) {
      return false;
    }
  }

  function markSubmitTime() {
    try {
      localStorage.setItem("forever_lead_last_at", String(Date.now()));
    } catch (_err) {
      // ignore storage errors
    }
  }

  function validateLead(lead) {
    const phone = cleanText(lead.phone, 32);
    const name = cleanText(lead.name, 80);
    const email = cleanText(lead.email, 120);

    if (!lead.consent) return "Потрібна згода на обробку персональних даних.";
    if (!phone) return "Введіть номер телефону.";
    if (!PHONE_RE.test(phone)) return "Перевірте формат номера телефону.";
    if (lead.requireName && name.length < 2) return "Введіть ваше ім'я.";
    if (email && !EMAIL_RE.test(email)) return "Перевірте формат email.";
    return "";
  }

  async function sendLead(lead) {
    const payload = new FormData();
    payload.append("name", cleanText(lead.name, 80) || "Без імені");
    payload.append("phone", cleanText(lead.phone, 32));
    if (lead.email) payload.append("email", cleanText(lead.email, 120));
    payload.append("intent", cleanText(lead.intent, 40) || "general");
    payload.append("source", cleanText(lead.source, 40) || "site");
    payload.append("page", window.location.href);
    payload.append(
      "message",
      [
        "Нова заявка з сайту Forever Living",
        "Джерело: " + (cleanText(lead.source, 40) || "site"),
        "Намір: " + (cleanText(lead.intent, 40) || "general"),
      ].join("\n")
    );

    // FormSubmit reserved fields (free and no backend required)
    payload.append("_subject", "Forever Living: нова заявка");
    payload.append("_template", "table");
    payload.append("_honey", cleanText(lead.honey, 80));

    const response = await fetch(LEADS_ENDPOINT, {
      method: "POST",
      headers: {
        Accept: "application/json",
      },
      body: payload,
    });

    if (!response.ok) {
      throw new Error("submission_failed");
    }
  }

  async function submitLead(lead) {
    const fillTime = Date.now() - FORM_LOAD_TS;
    if (fillTime < MIN_FILL_TIME_MS) {
      toast("Спробуйте ще раз через секунду.", "error");
      return false;
    }

    if (cleanText(lead.honey, 80)) {
      // honeypot is filled -> likely bot
      return false;
    }

    if (isRateLimited()) {
      toast("Заявку вже відправлено. Спробуйте ще раз за 20 секунд.", "error");
      return false;
    }

    const validationError = validateLead(lead);
    if (validationError) {
      toast(validationError, "error");
      return false;
    }

    try {
      await sendLead(lead);
      markSubmitTime();
      toast("✅ Дякуємо! Заявку отримано. Зв'яжемось найближчим часом.", "success");
      return true;
    } catch (_err) {
      toast("Не вдалося відправити заявку. Напишіть нам у WhatsApp або Telegram.", "error");
      return false;
    }
  }

  window.ForeverLeads = {
    submitLead: submitLead,
  };

  // ---- Contact form ----
  const form = document.getElementById("contactForm");
  if (form) {
    form.addEventListener("submit", async function (e) {
      e.preventDefault();
      const intentEl = form.querySelector("#intentField");
      const nameEl = form.querySelector("input[name='name']");
      const phoneEl = form.querySelector("input[name='phone']");
      const emailEl = form.querySelector("input[name='email']");
      const honeyEl = form.querySelector("input[name='_honey']");
      const consentEl = form.querySelector("input[name='consent']");

      const ok = await submitLead({
        source: "contact_form",
        intent: intentEl ? intentEl.value : "general",
        name: nameEl ? nameEl.value : "",
        phone: phoneEl ? phoneEl.value : "",
        email: emailEl ? emailEl.value : "",
        consent: !!(consentEl && consentEl.checked),
        requireName: true,
        honey: honeyEl ? honeyEl.value : "",
      });

      if (ok) form.reset();
    });
  }
})();
