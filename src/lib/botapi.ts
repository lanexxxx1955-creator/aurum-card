/* Telegram Bot API client (called directly from the Mini App; api.telegram.org allows CORS) */

import { BOT_TOKEN, PRICE_RUB } from "./config";

const API = `https://api.telegram.org/bot${BOT_TOKEN}`;

export class BotApiError extends Error {
  code: number;

  constructor(code: number, message: string) {
    super(message);
    this.code = code;
  }
}

async function call<T>(method: string, body: FormData | Record<string, unknown>): Promise<T> {
  const isForm = body instanceof FormData;
  const res = await fetch(`${API}/${method}`, {
    method: "POST",
    ...(isForm
      ? { body }
      : { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }),
  });
  const data = await res.json();
  if (!data.ok) throw new BotApiError(data.error_code ?? 0, data.description ?? "Telegram API error");
  return data.result as T;
}

/**
 * Uploads the greeting video to the user's own chat with the bot and returns
 * the Telegram file_id. The file then lives in Telegram's cloud forever and
 * can be embedded into shared cards. Requires the user to have pressed Start
 * in the bot chat (Bot API cannot initiate conversations).
 */
export async function uploadGreetingVideo(chatId: number, blob: Blob): Promise<string> {
  const fd = new FormData();
  fd.append("chat_id", String(chatId));
  fd.append("caption", "✦ Ваше видео-приветствие сохранено в AURUM CARD");
  fd.append("supports_streaming", "true");
  const ext = blob.type.includes("mp4") ? "mp4" : "webm";
  fd.append("video", new File([blob], `greeting.${ext}`, { type: blob.type || "video/webm" }));
  const result = await call<{ video: { file_id: string } }>("sendVideo", fd);
  return result.video.file_id;
}

/** Resolves a file_id to a temporary download URL (valid ~1h; refetch on demand) */
export async function getTelegramFileUrl(fileId: string): Promise<string> {
  const f = await call<{ file_path: string }>("getFile", { file_id: fileId });
  return `https://api.telegram.org/file/bot${BOT_TOKEN}/${f.file_path}`;
}

/** Creates a Telegram Payments invoice link for 1 month of AURUM PRO */
export async function createProInvoiceLink(userId: number, providerToken: string): Promise<string> {
  return call<string>("createInvoiceLink", {
    title: "AURUM PRO — 1 месяц",
    description:
      "До 3 визиток, видео-приветствие 60 сек, без водяного знака, облачное видео, аналитика просмотров, платиновые темы.",
    payload: `pro_${userId}_${Date.now()}`,
    provider_token: providerToken,
    currency: "RUB",
    prices: [{ label: "AURUM PRO (30 дней)", amount: PRICE_RUB * 100 }],
  });
}
