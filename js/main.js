// =============================================================
// Forever Living — interactive behaviour (vanilla JS)
// =============================================================

(function () {
  const SUPABASE_URL = "https://evqmticivailwbocynub.supabase.co";
  const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_XHjHSPdrUvKw3MO0jlSi8w_I0z90XJF";
  const LEAD_RATE_LIMIT_MS = 20000;
  const MIN_FILL_TIME_MS = 1200;
  const FORM_LOAD_TS = Date.now();
  const PHONE_RE = /^\+?[0-9()\-\s]{8,22}$/;
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  let supabaseClient = null;
  const INTENT_LABELS = {
    products: "Хочу продукти",
    business: "Цікавить бізнес",
    nutrition: "Консультація",
    call: "Дзвінок з сайту",
    general: "Загальна заявка"
  };
  const SOURCE_LABELS = {
    contact_form: "Контактна форма",
    hero_form: "Форма у першому екрані",
    nutrition_form: "Форма консультації",
    business_form: "Форма бізнесу",
    phone_click: "Клік по номеру телефону",
    whatsapp_click: "Клік по WhatsApp",
    viber_click: "Клік по Viber",
    telegram_click: "Клік по Telegram",
    site: "Сайт"
  };
  const ALLOWED_INTENTS = Object.keys(INTENT_LABELS);
  const ALLOWED_SOURCES = Object.keys(SOURCE_LABELS);

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

  // ---- Responsive hero video source ----
  (function setupResponsiveHeroVideo() {
    const video = document.querySelector(".site-video-bg video");
    if (!video) return;

    const source = video.querySelector("source");
    if (!source) return;

    const desktopSrc = video.getAttribute("data-desktop-src") || source.getAttribute("src");
    const mobileSrc = video.getAttribute("data-mobile-src") || desktopSrc;
    if (!desktopSrc || !mobileSrc) return;

    const mq = window.matchMedia("(max-width: 430px)");

    function applySource() {
      const nextSrc = mq.matches ? mobileSrc : desktopSrc;
      if (video.getAttribute("data-active-src") === nextSrc) return;

      source.setAttribute("src", nextSrc);
      video.setAttribute("data-active-src", nextSrc);
      video.load();
      const playPromise = video.play();
      if (playPromise && typeof playPromise.catch === "function") {
        playPromise.catch(function () {
          // autoplay can be blocked; ignore silently
        });
      }
    }

    applySource();

    if (typeof mq.addEventListener === "function") {
      mq.addEventListener("change", applySource);
    } else if (typeof mq.addListener === "function") {
      mq.addListener(applySource);
    }
  })();

  // ---- Toast notifications ----
  function getToastRoot(anchorEl) {
    if (anchorEl) {
      let inlineRoot = anchorEl.querySelector(".inline-toast-root");
      if (!inlineRoot) {
        inlineRoot = document.createElement("div");
        inlineRoot.className = "toast-root inline-toast-root";
        inlineRoot.setAttribute("aria-live", "polite");
        anchorEl.appendChild(inlineRoot);
      }
      return inlineRoot;
    }
    return document.getElementById("toastRoot");
  }

  function toast(message, type, anchorEl) {
    const root = getToastRoot(anchorEl);
    if (!root) {
      if (type === "error") alert(message);
      return;
    }
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
  const contactFeedbackEl = document.getElementById("contactFeedback");

  function setContactFeedback(message, type) {
    if (!contactFeedbackEl) return;
    if (!message) {
      contactFeedbackEl.textContent = "";
      contactFeedbackEl.className = "form-feedback";
      return;
    }
    contactFeedbackEl.textContent = message;
    contactFeedbackEl.className = "form-feedback is-visible " + (type === "success" ? "success" : "error");
  }

  function cleanText(value, maxLen) {
    const str = String(value || "")
      .replace(/[\u0000-\u001f\u007f]/g, " ")
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

  function getSupabaseClient() {
    if (supabaseClient) return supabaseClient;
    if (!window.supabase || typeof window.supabase.createClient !== "function") return null;

    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false
      }
    });
    return supabaseClient;
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

  function labelFromMap(map, value) {
    const key = cleanText(value, 80);
    return map[key] || key || "Не вказано";
  }

  function normalizeChoice(value, allowedValues, fallback) {
    const key = cleanText(value, 40);
    return allowedValues.indexOf(key) >= 0 ? key : fallback;
  }

  function getSafePageUrl() {
    try {
      const url = new URL(window.location.href);
      return url.origin + url.pathname;
    } catch (_err) {
      return cleanText(window.location.pathname || "", 180);
    }
  }

  function formatLeadDate(date) {
    return date.toLocaleString("uk-UA", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  }

  async function notifyTelegramLead(lead, meta) {
    try {
      const response = await fetch("/api/telegram-lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        keepalive: true,
        body: JSON.stringify({ lead: lead, meta: meta || {} })
      });
      if (!response.ok) {
        console.warn("Telegram-сповіщення не було прийняте endpoint", response.status);
      }
    } catch (error) {
      console.warn("Не вдалося відправити Telegram-сповіщення", error);
    }
  }

  async function sendLead(lead) {
    const leadIntent = normalizeChoice(lead.intent, ALLOWED_INTENTS, "general");
    const leadType = leadIntent === "business" ? "бізнес" : (leadIntent === "call" ? "дзвінок" : "консультація");
    const source = normalizeChoice(lead.source, ALLOWED_SOURCES, "site");
    const intentLabel = labelFromMap(INTENT_LABELS, leadIntent);
    const sourceLabel = labelFromMap(SOURCE_LABELS, source);
    const page = getSafePageUrl();
    const submittedAt = formatLeadDate(new Date());
    const leadTitle = source === "phone_click"
      ? "Клік по номеру телефону на сайті Forever Living"
      : (source === "whatsapp_click" || source === "viber_click" || source === "telegram_click")
      ? "Клік по месенджеру на сайті Forever Living"
      : "Нова заявка з сайту Forever Living";
    const comment = [
      leadTitle,
      "Дата заявки: " + submittedAt,
      "Джерело: " + sourceLabel,
      "Намір: " + intentLabel,
      "Сторінка: " + page
    ].join("\n");

    const payload = {
      name: cleanText(lead.name, 80) || "Без імені",
      phone: cleanText(lead.phone, 32),
      email: cleanText(lead.email, 120) || null,
      type: leadType,
      status: "Новий",
      comment: cleanText(comment, 1000)
    };

    const client = getSupabaseClient();
    if (!client) throw new Error("supabase_sdk_missing");

    const { error } = await client.from("leads").insert(payload);
    if (error) throw new Error(error.message || "submission_failed");

    notifyTelegramLead(payload, {
      sourceLabel: sourceLabel,
      intentLabel: intentLabel,
      page: page,
      submittedAt: new Date().toISOString()
    });
  }

  async function submitLead(lead) {
    const isContactForm = !!lead && lead.source === "contact_form";
    const toastAnchor = isContactForm
      ? (document.querySelector(".contact-form-wrap") || document.body)
      : (
        document.querySelector(".hero-lead-form") ||
        document.querySelector(".nutrition-lead") ||
        document.body
      );
    const fillTime = Date.now() - FORM_LOAD_TS;
    if (fillTime < MIN_FILL_TIME_MS) {
      const text = "Спробуйте ще раз через секунду.";
      toast(text, "error", toastAnchor);
      if (isContactForm) setContactFeedback(text, "error");
      return false;
    }

    if (cleanText(lead.honey, 80)) {
      // honeypot is filled -> likely bot
      return false;
    }

    if (isRateLimited()) {
      const text = "Заявку вже відправлено. Спробуйте ще раз за 20 секунд.";
      toast(text, "error", toastAnchor);
      if (isContactForm) setContactFeedback(text, "error");
      return false;
    }

    const validationError = validateLead(lead);
    if (validationError) {
      toast(validationError, "error", toastAnchor);
      if (isContactForm) setContactFeedback(validationError, "error");
      return false;
    }

    try {
      await sendLead(lead);
      markSubmitTime();
      const text = "✅ Дякуємо! Заявку отримано. Зв'яжемось найближчим часом.";
      toast(text, "success", toastAnchor);
      if (isContactForm) setContactFeedback(text, "success");
      return true;
    } catch (err) {
      const message = err && err.message ? err.message : "submission_failed";
      const isRls = message.toLowerCase().indexOf("row-level security") >= 0;
      const isSdkMissing = message === "supabase_sdk_missing";
      const humanMessage = isSdkMissing
        ? "Не вдалося відправити заявку: модуль Supabase не завантажився. Оновіть сторінку Ctrl+F5."
        : isRls
        ? "Не вдалося відправити заявку: у Supabase не дозволено публічний insert (RLS). Додайте policy для anon."
        : ("Не вдалося відправити заявку: " + message);
      toast(humanMessage, "error", toastAnchor);
      if (isContactForm) setContactFeedback(humanMessage, "error");
      return false;
    }
  }

  window.ForeverLeads = {
    submitLead: submitLead,
  };

  function getFormValue(form, selector) {
    const el = form.querySelector(selector);
    return el && typeof el.value === "string" ? el.value : "";
  }

  function getFormChecked(form, selector) {
    const el = form.querySelector(selector);
    return !!(el && el.checked);
  }

  function bindConfiguredLeadForms() {
    document.querySelectorAll("[data-lead-form]").forEach(function (form) {
      form.addEventListener("submit", async function (event) {
        event.preventDefault();
        if (!window.ForeverLeads || typeof window.ForeverLeads.submitLead !== "function") {
          toast("Сервіс заявок тимчасово недоступний.", "error", form);
          return;
        }

        const ok = await window.ForeverLeads.submitLead({
          source: form.getAttribute("data-lead-source") || "site",
          intent: form.getAttribute("data-lead-intent") || "general",
          name: getFormValue(form, "input[name='name']"),
          phone: getFormValue(form, "input[name='phone']"),
          email: getFormValue(form, "input[name='email']"),
          consent: getFormChecked(form, "input[name='consent']"),
          requireName: form.getAttribute("data-require-name") === "true",
          honey: getFormValue(form, "input[name='_honey']")
        });

        if (ok && typeof form.reset === "function") {
          form.reset();
        }
      });
    });
  }

  function bindIntentTabs() {
    document.querySelectorAll("[data-intent-value]").forEach(function (button) {
      button.addEventListener("click", function () {
        const value = normalizeChoice(button.getAttribute("data-intent-value"), ALLOWED_INTENTS, "products");
        document.querySelectorAll(".intent-tab").forEach(function (tab) {
          tab.classList.remove("active");
        });
        button.classList.add("active");

        const intentField = document.getElementById("intentField");
        if (intentField) intentField.value = value;
      });
    });
  }

  bindConfiguredLeadForms();
  bindIntentTabs();

  function normalizePhoneForCrm(phone) {
    return cleanText(phone, 80).replace(/^tel:/i, "");
  }

  function extractContactPhone(link) {
    const href = link.getAttribute("href") || "";
    try {
      const url = new URL(href, window.location.href);
      const host = url.hostname.toLowerCase();
      const path = decodeURIComponent(url.pathname || "");

      if (host.indexOf("wa.me") >= 0) return "+" + path.replace(/[^\d]/g, "");
      if (host.indexOf("t.me") >= 0) return path.replace(/[^\d+]/g, "");
      if (url.protocol === "viber:") return url.searchParams.get("number") || "";
    } catch (_err) {
      // fall back to text/href parsing below
    }

    const numberMatch = decodeURIComponent(href).match(/\+?\d[\d\s().-]{7,}/);
    return numberMatch ? numberMatch[0] : link.textContent || "";
  }

  function getMessengerSource(link) {
    const href = (link.getAttribute("href") || "").toLowerCase();
    const label = (link.getAttribute("aria-label") || link.textContent || "").toLowerCase();
    const value = href + " " + label;

    if (value.indexOf("wa.me") >= 0 || value.indexOf("whatsapp") >= 0) return "whatsapp_click";
    if (value.indexOf("viber") >= 0) return "viber_click";
    if (value.indexOf("t.me") >= 0 || value.indexOf("telegram") >= 0 || value.indexOf("tg:") >= 0) return "telegram_click";
    return "";
  }

  function messengerLeadName(source) {
    if (source === "whatsapp_click") return "WhatsApp з сайту";
    if (source === "viber_click") return "Viber з сайту";
    if (source === "telegram_click") return "Telegram з сайту";
    return "Клік з сайту";
  }

  async function registerPhoneClick(link) {
    const now = Date.now();
    const lastAt = Number(link.dataset.lastLeadflowCallAt || 0);
    if (now - lastAt < 10000) return;
    link.dataset.lastLeadflowCallAt = String(now);

    const phone = normalizePhoneForCrm(link.getAttribute("href") || link.textContent || "");
    try {
      await sendLead({
        source: "phone_click",
        intent: "call",
        name: "Дзвінок з сайту",
        phone: phone,
        email: ""
      });
    } catch (error) {
      console.warn("Не вдалося зареєструвати клік по телефону", error);
    }
  }

  document.querySelectorAll('a[href^="tel:"]').forEach(function (link) {
    link.addEventListener("click", function () {
      registerPhoneClick(link);
    });
  });

  async function registerMessengerClick(link) {
    const source = getMessengerSource(link);
    if (!source) return;

    const now = Date.now();
    const lastAt = Number(link.dataset.lastLeadflowMessengerAt || 0);
    if (now - lastAt < 10000) return;
    link.dataset.lastLeadflowMessengerAt = String(now);

    try {
      await sendLead({
        source: source,
        intent: "call",
        name: messengerLeadName(source),
        phone: normalizePhoneForCrm(extractContactPhone(link)),
        email: ""
      });
    } catch (error) {
      console.warn("Не вдалося зареєструвати клік по месенджеру", error);
    }
  }

  document.querySelectorAll('a[href*="wa.me"], a[href*="whatsapp"], a[href^="viber:"], a[href*="t.me"], a[href^="tg:"]').forEach(function (link) {
    link.addEventListener("click", function () {
      registerMessengerClick(link);
    });
  });

  // ---- Contact form ----
  const form = document.getElementById("contactForm");
  if (form) {
    form.addEventListener("input", function () {
      setContactFeedback("", "error");
    });

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
