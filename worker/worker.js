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
      if (url.pathname.startsWith("/c/") && request.method === "GET") {
        return await handleOgPage(url, env, origin, request);
      }
      if (url.pathname === "/api/cardPhoto" && request.method === "GET") {
        return await handleCardPhoto(url, env, origin);
      }
      if (url.pathname === "/api/deleteCard" && request.method === "POST") {
        return await handleDeleteCard(request, env, origin);
      }
      if (url.pathname === "/api/tg" && request.method === "POST") {
        return await handleTelegramWebhook(request, env, origin);
      }
      if (url.pathname === "/api/sendVideo" && request.method === "POST") {
        return await handleSendVideo(request, env, origin);
      }
      if (url.pathname === "/api/card" && request.method === "POST") {
        return await handleSaveCard(request, env, origin);
      }
      if (url.pathname === "/api/card" && request.method === "GET") {
        return await handleGetCard(url, env, origin);
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

/** Parses initData manually. URLSearchParams would turn "+" into a space and
 *  corrupt values (user JSON, Ed25519 signature) → HMAC mismatch. decodeURIComponent
 *  leaves "+" alone, so this is safe for both raw and percent-encoded input. */
function parseInitData(initData) {
  const pairs = [];
  for (const part of String(initData).split("&")) {
    if (!part) continue;
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    try {
      pairs.push([decodeURIComponent(part.slice(0, idx)), decodeURIComponent(part.slice(idx + 1))]);
    } catch {
      pairs.push([part.slice(0, idx), part.slice(idx + 1)]);
    }
  }
  return pairs;
}

/** Validates Telegram WebApp initData (https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app) */
async function validateInitData(initData, botToken) {
  if (!initData || !botToken) return null;
  const pairs = parseInitData(initData);
  const params = new Map(pairs);
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

  /* Telegram serves files as application/octet-stream, which breaks <video>
     playback in several browsers — restore the real MIME from the extension */
  const path = String(meta.result.file_path || "").toLowerCase();
  const mimeByExt = path.endsWith(".mp4")
    ? "video/mp4"
    : path.endsWith(".webm")
      ? "video/webm"
      : path.endsWith(".mov")
        ? "video/quicktime"
        : null;
  const upstreamType = upstream.headers.get("Content-Type") || "";
  const contentType =
    mimeByExt || (upstreamType.startsWith("video/") ? upstreamType : "application/octet-stream");

  const respHeaders = cors(origin, {
    "Content-Type": contentType,
    "Cache-Control": "public, max-age=3600",
    "Accept-Ranges": "bytes",
  });
  const len = upstream.headers.get("Content-Length");
  if (len) respHeaders["Content-Length"] = len;
  const rangeHdr = upstream.headers.get("Content-Range");
  if (rangeHdr) respHeaders["Content-Range"] = rangeHdr;

  return new Response(upstream.body, { status: upstream.status, headers: respHeaders });
}

/** POST /api/card — JSON { initData, card, id? }. Stores the card in KV,
 *  returns a short public id for share links. Owner-validated via initData;
 *  passing an existing id updates the card (edit flow). */
async function handleSaveCard(request, env, origin) {
  const body = await request.json().catch(() => ({}));
  const user = await validateInitData(String(body.initData || ""), env.BOT_TOKEN);
  if (!user || !user.id) return json(origin, { ok: false, error: "invalid initData" }, 401);

  const card = body.card;
  if (!card || typeof card !== "object" || !card.name || !card.tg) {
    return json(origin, { ok: false, error: "bad card" }, 400);
  }
  const raw = JSON.stringify(card);
  if (raw.length > 400 * 1024) return json(origin, { ok: false, error: "card too large" }, 413);

  let id = typeof body.id === "string" && /^[A-Za-z0-9]{10}$/.test(body.id) ? body.id : null;
  if (!id) {
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
    const bytes = crypto.getRandomValues(new Uint8Array(10));
    id = [...bytes].map((b) => alphabet[b % alphabet.length]).join("");
  }
  await env.CARDS.put(`card:${id}`, raw, { metadata: { owner: user.id, updated: Date.now() } });
  return json(origin, { ok: true, id });
}

/** GET /api/card?id=... — public read by unguessable id (that IS the share link). */
async function handleGetCard(url, env, origin) {
  const id = url.searchParams.get("id") || "";
  if (!/^[A-Za-z0-9]{10}$/.test(id)) return json(origin, { ok: false, error: "bad id" }, 400);
  const raw = await env.CARDS.get(`card:${id}`, { cacheTtl: 30 });
  if (!raw) return json(origin, { ok: false, error: "not found" }, 404);
  return new Response(raw, {
    status: 200,
    headers: cors(origin, { "Content-Type": "application/json", "Cache-Control": "public, max-age=60" }),
  });
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

/** GET /c/<id> — Open Graph landing page. Telegram's crawler reads the meta
 *  tags and renders a rich preview (photo + name); humans are redirected to
 *  the Mini App card view. */
async function handleOgPage(url, env, origin, request) {
  const id = url.pathname.slice(3);
  const appBase = (env.APP_URL || "https://lanexxxx1955-creator.github.io/aurum-card/").replace(/\/?$/, "/");
  const appUrl = `${appBase}#c=${id}`;
  const workerBase = `https://${url.host}`;

  let card = null;
  const validId = /^[A-Za-z0-9]{10}$/.test(id);
  if (validId) {
    const raw = await env.CARDS.get(`card:${id}`, { cacheTtl: 30 });
    if (raw) {
      try {
        card = JSON.parse(raw);
      } catch {
        card = null;
      }
    }
  }

  /* Card not visible at this edge yet (KV propagation): tell crawlers to come
     back instead of letting Telegram cache a poor no-image preview */
  if (validId && !card) {
    return new Response("card is still propagating, retry soon", {
      status: 503,
      headers: { "Content-Type": "text/plain", "Retry-After": "20", "Cache-Control": "no-store" },
    });
  }

  const name = card && card.name ? escapeHtml(card.name) : "AURUM CARD";
  const desc = card
    ? escapeHtml(`Видео-визитка · сохрани мои контакты — AURUM CARD`)
    : "Видео-визитка — AURUM CARD";
  const hasPhoto = Boolean(card && typeof card.photo === "string" && card.photo.startsWith("data:image/"));
  const ogImage = hasPhoto ? `<meta property="og:image" content="${workerBase}/api/cardPhoto?id=${id}" />
    <meta property="og:image:type" content="image/jpeg" />
    <meta property="og:image:width" content="320" />
    <meta property="og:image:height" content="320" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:image" content="${workerBase}/api/cardPhoto?id=${id}" />` : "";

  /* Crawlers get a pure OG page with no instant redirect; humans get the
     meta-refresh + JS redirect into the Mini App */
  const ua = request.headers.get("User-Agent") || "";
  const isCrawler = /TelegramBot|Twitterbot|facebookexternalhit|WhatsApp|LinkedInBot|Slackbot/i.test(ua);

  const html = `<!doctype html>
<html lang="ru">
  <head>
    <meta charset="UTF-8" />
    <title>${name} — AURUM CARD</title>
    <meta property="og:title" content="${name}" />
    <meta property="og:description" content="${desc}" />
    <meta property="og:type" content="website" />
    <meta property="og:url" content="${workerBase}/c/${id}" />
    <meta property="og:site_name" content="AURUM CARD" />
    ${ogImage}
    ${isCrawler ? "" : `<meta http-equiv="refresh" content="0;url=${appUrl}" />`}
    <style>
      body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#0a0906;color:#d4af37;font-family:Georgia,serif}
      .ring{width:88px;height:88px;border-radius:50%;border:2px solid #d4af37;display:flex;align-items:center;justify-content:center;font-size:34px;margin:0 auto 16px;box-shadow:0 0 40px -8px rgba(212,175,55,.45)}
      .t{text-align:center;letter-spacing:.28em;text-transform:uppercase;font-size:11px}
      a{color:#f6e7b2}
    </style>
  </head>
  <body>
    <div>
      <div class="ring">✦</div>
      <div class="t">AURUM CARD</div>
      ${isCrawler ? "" : `<div class="t" style="margin-top:14px"><a href="${appUrl}">Открыть визитку</a></div>`}
    </div>
    ${isCrawler ? "" : `<script>location.replace(${JSON.stringify(appUrl)});</script>`}
  </body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: { "Content-Type": "text/html;charset=utf-8", "Cache-Control": "public, max-age=60" },
  });
}

/** GET /api/cardPhoto?id=... — serves the card's photo as image/jpeg (for OG previews). */
async function handleCardPhoto(url, env, origin) {
  const id = url.searchParams.get("id") || "";
  if (!/^[A-Za-z0-9]{10}$/.test(id)) return json(origin, { ok: false, error: "bad id" }, 400);
  const raw = await env.CARDS.get(`card:${id}`, { cacheTtl: 30 });
  if (!raw) return json(origin, { ok: false, error: "not found" }, 404);

  let photo = null;
  try {
    photo = JSON.parse(raw).photo;
  } catch {
    photo = null;
  }
  const m = typeof photo === "string" ? photo.match(/^data:image\/(jpeg|jpg|png);base64,(.+)$/s) : null;
  if (!m) return json(origin, { ok: false, error: "no photo" }, 404);

  const bytes = Uint8Array.from(atob(m[2]), (c) => c.charCodeAt(0));
  return new Response(bytes, {
    status: 200,
    headers: cors(origin, {
      "Content-Type": m[1] === "png" ? "image/png" : "image/jpeg",
      "Cache-Control": "public, max-age=86400",
    }),
  });
}

/** POST /api/deleteCard — JSON { initData, id }. Owner-only (KV metadata check). */
async function handleDeleteCard(request, env, origin) {
  const body = await request.json().catch(() => ({}));
  const user = await validateInitData(String(body.initData || ""), env.BOT_TOKEN);
  if (!user || !user.id) return json(origin, { ok: false, error: "invalid initData" }, 401);

  const id = String(body.id || "");
  if (!/^[A-Za-z0-9]{10}$/.test(id)) return json(origin, { ok: false, error: "bad id" }, 400);

  const { metadata } = await env.CARDS.getWithMetadata(`card:${id}`);
  if (metadata && metadata.owner && metadata.owner !== user.id) {
    return json(origin, { ok: false, error: "not your card" }, 403);
  }
  await env.CARDS.delete(`card:${id}`);
  return json(origin, { ok: true });
}

/** POST /api/tg — Telegram webhook. Handles /start and inline queries.
 *  Inline query → the user's own cards as native PHOTO messages (no URL text),
 *  each with an "Open card" Mini App button. */
async function handleTelegramWebhook(request, env, origin) {
  // Verify the webhook secret when configured
  if (env.TG_WEBHOOK_SECRET) {
    const got = request.headers.get("X-Telegram-Bot-Api-Secret-Token");
    if (got !== env.TG_WEBHOOK_SECRET) return json(origin, { ok: false }, 401);
  }

  const update = await request.json().catch(() => null);
  if (!update) return json(origin, { ok: true });

  const appBase = (env.APP_URL || "https://lanexxxx1955-creator.github.io/aurum-card/").replace(/\/?$/, "/");
  const workerBase = `https://${new URL(request.url).host}`;

  // /start — welcome message with Mini App button
  if (update.message && typeof update.message.text === "string" && update.message.text.startsWith("/start")) {
    await tgApi(env, "sendMessage", {
      chat_id: update.message.chat.id,
      text: "✦ AURUM CARD — создайте роскошную видео-визитку и делитесь ею в один клик.\n\nЧтобы отправить визитку в любой чат, наберите @AURUM_CARD_BOT в поле сообщения.",
      reply_markup: {
        inline_keyboard: [[{ text: "✦ Открыть AURUM CARD", web_app: { url: appBase } }]],
      },
    });
    return json(origin, { ok: true });
  }

  // Inline query — cards of THIS user only (owner check via KV metadata)
  if (update.inline_query) {
    const uid = update.inline_query.from.id;
    const results = [];
    try {
      const list = await env.CARDS.list({ prefix: "card:" });
      for (const k of list.keys) {
        if (results.length >= 10) break;
        if (!k.metadata || k.metadata.owner !== uid) continue;
        const id = k.name.slice(5);
        const raw = await env.CARDS.get(k.name, { cacheTtl: 30 });
        if (!raw) continue;
        let card;
        try {
          card = JSON.parse(raw);
        } catch {
          continue;
        }
        const caption = `✦ ${card.name} — видео-визитка · сохрани мои контакты`;
        const keyboard = {
          inline_keyboard: [[{ text: "✦ Открыть визитку", web_app: { url: `${appBase}#c=${id}` } }]],
        };
        const subtitle = [card.position, card.company].filter(Boolean).join(" · ");
        if (card.photo && typeof card.photo === "string" && card.photo.startsWith("data:image/")) {
          results.push({
            type: "photo",
            id,
            photo_url: `${workerBase}/api/cardPhoto?id=${id}`,
            thumbnail_url: `${workerBase}/api/cardPhoto?id=${id}`,
            title: card.name,
            description: subtitle || "видео-визитка",
            caption,
            reply_markup: keyboard,
          });
        } else {
          results.push({
            type: "article",
            id,
            title: card.name,
            description: subtitle || "видео-визитка",
            input_message_content: { message_text: `${caption}\n${workerBase}/c/${id}` },
            reply_markup: keyboard,
          });
        }
      }
    } catch {
      /* answer with what we have */
    }
    await tgApi(env, "answerInlineQuery", {
      inline_query_id: update.inline_query.id,
      results,
      cache_time: 0,
      is_personal: true,
    });
  }

  return json(origin, { ok: true });
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
