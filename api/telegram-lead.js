const MAX_TEXT_LENGTH = 3900;

function sendJson(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(body));
}

function parseBody(req) {
  if (!req.body) return {};
  if (typeof req.body === "object") return req.body;
  try {
    return JSON.parse(req.body);
  } catch (_error) {
    return {};
  }
}

function cleanText(value, maxLen) {
  return String(value || "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .replace(/[<>]/g, "")
    .trim()
    .slice(0, maxLen || 250);
}

function formatDateTime(value) {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("uk-UA", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Kiev"
  });
}

function formatTelegramLeadMessage(lead, meta) {
  const parts = [
    "Новий лід",
    `Ім'я: ${cleanText(lead.name, 80) || "-"}`,
    `Телефон: ${cleanText(lead.phone, 32) || "-"}`,
    `Email: ${cleanText(lead.email, 120) || "-"}`,
    `Тип: ${cleanText(lead.type, 40) || "-"}`,
    `Статус: ${cleanText(lead.status, 40) || "Новий"}`,
    `Дата заявки: ${formatDateTime(meta.submittedAt) || formatDateTime()}`,
    `Джерело: ${cleanText(meta.sourceLabel, 80) || "Сайт"}`
  ];

  const intentLabel = cleanText(meta.intentLabel, 80);
  const page = cleanText(meta.page, 180);
  const comment = cleanText(lead.comment, 1000);

  if (intentLabel) parts.push(`Намір: ${intentLabel}`);
  if (page) parts.push(`Сторінка: ${page}`);
  if (comment) parts.push(`Коментар: ${comment}`);

  return parts.join("\n").slice(0, MAX_TEXT_LENGTH);
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return sendJson(res, 405, { ok: false, error: "method_not_allowed" });
  }

  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) {
    return sendJson(res, 200, { ok: false, skipped: true, reason: "telegram_not_configured" });
  }

  const body = parseBody(req);
  const lead = body.lead || {};
  const meta = body.meta || {};
  const phone = cleanText(lead.phone, 32);
  const email = cleanText(lead.email, 120);

  if (!phone && !email) {
    return sendJson(res, 400, { ok: false, error: "missing_contact" });
  }

  const telegramResponse = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: formatTelegramLeadMessage(lead, meta),
      disable_web_page_preview: true
    })
  });

  if (!telegramResponse.ok) {
    return sendJson(res, 502, { ok: false, error: "telegram_send_failed" });
  }

  return sendJson(res, 200, { ok: true });
}
