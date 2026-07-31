/* Client for the Cloudflare Worker proxy (worker/). The bot token never
 * reaches the browser; the proxy validates Telegram initData on every call. */

import { API_BASE } from "./config";

export class BotApiError extends Error {
  code: number;

  constructor(code: number, message: string) {
    super(message);
    this.code = code;
  }
}

/**
 * Uploads the greeting video via the proxy into the user's own chat with the
 * bot (chat_id is derived from validated initData server-side). Returns the
 * Telegram file_id that can be embedded into shared cards.
 */
export async function uploadGreetingVideo(initData: string, blob: Blob): Promise<string> {
  const fd = new FormData();
  fd.append("initData", initData);
  const ext = blob.type.includes("mp4") ? "mp4" : "webm";
  fd.append("video", new File([blob], `greeting.${ext}`, { type: blob.type || "video/webm" }));

  const res = await fetch(`${API_BASE}/api/sendVideo`, { method: "POST", body: fd });
  const data = await res.json().catch(() => ({}));
  if (!data.ok) throw new BotApiError(data.error_code ?? res.status, data.error ?? "upload failed");
  return data.file_id as string;
}

/** Proxy URL that streams a Telegram file by file_id (token stays server-side) */
export function telegramVideoUrl(fileId: string): string {
  return `${API_BASE}/api/file?file_id=${encodeURIComponent(fileId)}`;
}

/** Creates a Telegram Payments invoice link for 1 month of AURUM PRO via the proxy */
export async function createProInvoiceLink(initData: string): Promise<string> {
  const res = await fetch(`${API_BASE}/api/invoice`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ initData }),
  });
  const data = await res.json().catch(() => ({}));
  if (!data.ok) throw new BotApiError(data.error_code ?? res.status, data.error ?? "invoice failed");
  return data.url as string;
}

/** Saves the card to KV via the proxy; returns the short public id for share links */
export async function saveCard(initData: string, card: unknown, id?: string): Promise<string> {
  const res = await fetch(`${API_BASE}/api/card`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ initData, card, id }),
  });
  const data = await res.json().catch(() => ({}));
  if (!data.ok) throw new BotApiError(data.error_code ?? res.status, data.error ?? "save failed");
  return data.id as string;
}

/** Loads a shared card by short id */
export async function fetchCard(id: string): Promise<Record<string, unknown> | null> {
  try {
    const res = await fetch(`${API_BASE}/api/card?id=${encodeURIComponent(id)}`);
    const data = await res.json();
    return data && data.name && data.tg ? (data as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/** Deletes a card from KV (owner-validated server-side) */
export async function deleteCardRemote(initData: string, id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/deleteCard`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ initData, id }),
  });
  const data = await res.json().catch(() => ({}));
  if (!data.ok) throw new BotApiError(data.error_code ?? res.status, data.error ?? "delete failed");
}

/**
 * Share link for Telegram messages: points at the worker's OG page, so the
 * message renders a rich preview (photo + name) and stays short/clean.
 */
export function cardShareLink(id: string): string {
  return `${API_BASE}/c/${id}`;
}
