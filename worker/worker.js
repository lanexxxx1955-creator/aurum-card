/* AURUM CARD — Cloudflare Worker proxy for Telegram Bot API.
 *
 * Hides the bot token from client-side code. Write endpoints require a valid
 * Telegram WebApp initData signature (HMAC-SHA256), so only real Telegram
 * users can upload videos or create invoices — and only into their own chat.
 *
 * Secrets (set via `wrangler secret put`):
 *   BOT_TOKEN               — from @BotFather
 *   PAYMENT_PROVIDER_TOKEN  — from @BotFather → Payments (optional; without it
 *                             /api/invoice returns 501 and the app stays in demo mode)
 * Vars (wrangler.toml):
 *   ALLOWED_ORIGIN          — comma-separated CORS allowlist, or *
 */

const PRICE_RUB = 299; // used when a payment provider token is configured
const PRICE_STARS = 200; // Telegram Stars fallback (works for individuals, ≈ 299 ₽)

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = resolveOrigin(request, env);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors(origin) });
    }

    try {
      if (url.pathname === "/api/health") {
        return json(origin, { ok: true });
      }
      if (url.pathname === "/api/sendVideo" && request.method === "POST") {
        return await handleSendVideo(request, env, origin);
      }
      if (url.pathname === "/api/invoice" && request.method === "POST") {
        return await handleInvoice(request, env, origin);
      }
      if (url.pathname === "/api/file" && request.method === "GET") {
        return await handleFile(url, request, env, origin);
      }
      return json(origin, { ok: false, error: "not found" }, 404);
    } catch (e) {
      return json(origin, { ok: false, error: String(e && e.message ? e.message : e) }, 500);
    }
  },
};

/* ---------- helpers ---------- */

function resolveOrigin(request, env) {
  const allowed = (env.ALLOWED_ORIGIN || "*").split(",").map((s) => s.trim());
  if (allowed.includes("*")) return "*";
  const reqOrigin = request.headers.get("Origin") || "";
  return allowed.includes(reqOrigin) ? reqOrigin : allowed[0];
}

function cors(origin, extra = {}) {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    ...extra,
  };
}

function json(origin, body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: cors(origin, { "Content-Type": "application/json" }),
  });
}

/** Validates Telegram WebApp initData (https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app) */
async function validateInitData(initData, botToken) {
  if (!initData || !botToken) return null;
  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash) return null;
  params.delete("hash");
  const dataCheckString = [...params.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${k}=${v}`)
    .join("\n");

  const enc = new TextEncoder();
  const webAppKey = await crypto.subtle.importKey(
    "raw",
    enc.encode("WebAppData"),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const secret = await crypto.subtle.sign("HMAC", webAppKey, enc.encode(botToken));
  const dataKey = await crypto.subtle.importKey(
    "raw",
    secret,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", dataKey, enc.encode(dataCheckString));
  const hex = [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
  if (hex !== hash) return null;

  try {
    return JSON.parse(params.get("user") || "null");
  } catch {
    return null;
  }
}

async function tgApi(env, method, body) {
  const isForm = body instanceof FormData;
  const res = await fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/${method}`, {
    method: "POST",
    ...(isForm ? { body } : { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }),
  });
  return res.json();
}

/* ---------- endpoints ---------- */

/** POST /api/sendVideo — multipart: initData + video file. Returns { file_id }. */
async function handleSendVideo(request, env, origin) {
  const form = await request.formData();
  const user = await validateInitData(String(form.get("initData") || ""), env.BOT_TOKEN);
  if (!user || !user.id) return json(origin, { ok: false, error: "invalid initData" }, 401);

  const video = form.get("video");
  if (!(video instanceof File)) return json(origin, { ok: false, error: "video required" }, 400);
  if (video.size > 20 * 1024 * 1024) return json(origin, { ok: false, error: "video too large" }, 413);

  const out = new FormData();
  out.append("chat_id", String(user.id));
  out.append("caption", "✦ Ваше видео-приветствие сохранено в AURUM CARD");
  out.append("supports_streaming", "true");
  out.append("video", video, video.name || "greeting.webm");

  const data = await tgApi(env, "sendVideo", out);
  if (!data.ok) return json(origin, { ok: false, error: data.description || "telegram error" }, 502);
  return json(origin, { ok: true, file_id: data.result.video.file_id });
}

/** GET /api/file?file_id=... — streams the file from Telegram, hiding the token. */
async function handleFile(url, request, env, origin) {
  const fileId = url.searchParams.get("file_id") || "";
  if (!/^[A-Za-z0-9_-]{10,200}$/.test(fileId)) return json(origin, { ok: false, error: "bad file_id" }, 400);

  const meta = await tgApi(env, "getFile", { file_id: fileId });
  if (!meta.ok) return json(origin, { ok: false, error: meta.description || "telegram error" }, 404);

  const headers = {};
  const range = request.headers.get("Range");
  if (range) headers.Range = range;

  const upstream = await fetch(`https://api.telegram.org/file/bot${env.BOT_TOKEN}/${meta.result.file_path}`, {
    headers,
  });
  const respHeaders = cors(origin, {
    "Content-Type": upstream.headers.get("Content-Type") || "video/webm",
    "Cache-Control": "public, max-age=3600",
    "Accept-Ranges": "bytes",
  });
  const len = upstream.headers.get("Content-Length");
  if (len) respHeaders["Content-Length"] = len;
  const rangeHdr = upstream.headers.get("Content-Range");
  if (rangeHdr) respHeaders["Content-Range"] = rangeHdr;

  return new Response(upstream.body, { status: upstream.status, headers: respHeaders });
}

/** POST /api/invoice — JSON { initData }. Returns { url } for WebApp.openInvoice.
 *  With PAYMENT_PROVIDER_TOKEN set → RUB via provider (needs self-employment/IE).
 *  Without it → Telegram Stars (XTR), which works for individuals out of the box. */
async function handleInvoice(request, env, origin) {
  const { initData } = await request.json().catch(() => ({}));
  const user = await validateInitData(String(initData || ""), env.BOT_TOKEN);
  if (!user || !user.id) return json(origin, { ok: false, error: "invalid initData" }, 401);

  const base = {
    title: "AURUM PRO — 1 месяц",
    description:
      "До 3 визиток, видео-приветствие 60 сек, без водяного знака, облачное видео, аналитика просмотров, платиновые темы.",
    payload: `pro_${user.id}_${Date.now()}`,
  };

  const invoice = env.PAYMENT_PROVIDER_TOKEN
    ? {
        ...base,
        provider_token: env.PAYMENT_PROVIDER_TOKEN,
        currency: "RUB",
        prices: [{ label: "AURUM PRO (30 дней)", amount: PRICE_RUB * 100 }],
      }
    : {
        ...base,
        provider_token: "",
        currency: "XTR",
        prices: [{ label: "AURUM PRO (30 дней)", amount: Number(env.PRICE_STARS || PRICE_STARS) }],
      };

  const data = await tgApi(env, "createInvoiceLink", invoice);
  if (!data.ok) return json(origin, { ok: false, error: data.description || "telegram error" }, 502);
  return json(origin, { ok: true, url: data.result });
}
