import type { Profile } from "./types";

/* ---------- Profile <-> shareable URL hash ---------- */

function toBase64Url(s: string): string {
  return btoa(unescape(encodeURIComponent(s))).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}
function fromBase64Url(s: string): string {
  const b64 = s.replaceAll("-", "+").replaceAll("_", "/");
  return decodeURIComponent(escape(atob(b64)));
}

export function encodeCard(p: Profile): string {
  const { name, tg, phone, company, field, position, lang, photo, hasVideo, videoFileId } = p;
  return toBase64Url(
    JSON.stringify({ name, tg, phone, company, field, position, lang, photo, hasVideo, videoFileId }),
  );
}

export function decodeCard(hash: string): Profile | null {
  try {
    const m = hash.match(/card=([A-Za-z0-9\-_]+)/);
    if (!m) return null;
    const obj = JSON.parse(fromBase64Url(m[1]));
    if (!obj.name || !obj.tg) return null;
    return { ...obj, createdAt: Date.now() } as Profile;
  } catch {
    return null;
  }
}

export function buildCardUrl(p: Profile): string {
  const base = `${location.origin}${location.pathname}`;
  return `${base}#card=${encodeCard(p)}`;
}

/* ---------- vCard ---------- */

export function buildVCard(p: Profile): string {
  const lines = [
    "BEGIN:VCARD",
    "VERSION:3.0",
    `FN:${p.name}`,
    p.phone ? `TEL;TYPE=CELL:${p.phone}` : "",
    p.company ? `ORG:${p.company}` : "",
    p.position ? `TITLE:${p.position}` : "",
    `URL:https://t.me/${p.tg.replace(/^@/, "")}`,
    p.field ? `NOTE:${p.field}` : "",
    "END:VCARD",
  ].filter(Boolean);
  return lines.join("\r\n");
}

export function downloadVCard(p: Profile): void {
  const blob = new Blob([buildVCard(p)], { type: "text/vcard;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${p.name.replace(/\s+/g, "_")}.vcf`;
  a.click();
  URL.revokeObjectURL(url);
}

/* ---------- Photo compression (keeps shared URLs short) ---------- */

export function compressPhoto(file: File, size = 320): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const min = Math.min(img.width, img.height);
      const sx = (img.width - min) / 2;
      const sy = (img.height - min) / 2;
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      canvas.getContext("2d")!.drawImage(img, sx, sy, min, min, 0, 0, size, size);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/jpeg", 0.72));
    };
    img.onerror = reject;
    img.src = url;
  });
}

/* ---------- Simple QR code (canvas, no dependency) ---------- */

export async function drawQr(canvas: HTMLCanvasElement, text: string): Promise<void> {
  // Use the well-known free QR image API only if online; else draw placeholder text
  const size = 220;
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#0d0b07";
  ctx.fillRect(0, 0, size, size);
  try {
    const img = new Image();
    img.crossOrigin = "anonymous";
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("qr offline"));
      img.src = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&bgcolor=0d0b07&color=d4af37&data=${encodeURIComponent(text)}`;
    });
    ctx.drawImage(img, 0, 0, size, size);
  } catch {
    ctx.fillStyle = "#d4af37";
    ctx.font = "12px Manrope, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("QR offline", size / 2, size / 2);
  }
}

/* ---------- Local persistence ---------- */

const LS_KEY = "aurum-card-profile";

export function saveProfile(p: Profile): void {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(p));
  } catch {
    /* quota */
  }
}

export function loadProfile(): Profile | null {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as Profile;
    return p.name && p.tg ? p : null;
  } catch {
    return null;
  }
}

export function clearProfile(): void {
  localStorage.removeItem(LS_KEY);
}
