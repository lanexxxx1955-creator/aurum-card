/* Telegram WebApp integration with graceful browser fallback */

export interface TelegramWebApp {
  ready: () => void;
  expand: () => void;
  close: () => void;
  setHeaderColor?: (c: string) => void;
  setBackgroundColor?: (c: string) => void;
  openTelegramLink?: (url: string) => void;
  openLink?: (url: string) => void;
  openInvoice?: (url: string, cb?: (status: string) => void) => void;
  showAlert?: (msg: string) => void;
  HapticFeedback?: { impactOccurred: (s: string) => void; notificationOccurred: (s: string) => void };
  initDataUnsafe?: { user?: { id: number; first_name?: string; username?: string; language_code?: string }; start_param?: string };
}

export function getTG(): TelegramWebApp | null {
  const w = window as unknown as { Telegram?: { WebApp?: TelegramWebApp } };
  return w.Telegram?.WebApp ?? null;
}

export function isTelegram(): boolean {
  const tg = getTG();
  return !!tg && (!!tg.initDataUnsafe?.user || window.location.hash.includes("tgWebAppData"));
}

export function initTelegram(): void {
  const tg = getTG();
  if (!tg) return;
  try {
    tg.ready();
    tg.expand();
    tg.setHeaderColor?.("#0a0906");
    tg.setBackgroundColor?.("#0a0906");
  } catch {
    /* older clients */
  }
}

/** Prefill profile from Telegram user data when running inside Telegram */
export function tgUserDefaults(): { name?: string; tg?: string } {
  const u = getTG()?.initDataUnsafe?.user;
  if (!u) return {};
  return { name: u.first_name ?? undefined, tg: u.username ?? undefined };
}

export function haptic(kind: "light" | "medium" | "success" = "light"): void {
  const tg = getTG();
  try {
    if (kind === "success") tg?.HapticFeedback?.notificationOccurred("success");
    else tg?.HapticFeedback?.impactOccurred(kind);
  } catch {
    /* noop */
  }
}

/** Open a t.me share dialog; falls back to a new tab outside Telegram */
export function shareViaTelegram(url: string, text: string): void {
  const share = `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`;
  const tg = getTG();
  if (tg?.openTelegramLink) tg.openTelegramLink(share);
  else window.open(share, "_blank", "noopener");
}

export function openLink(url: string): void {
  const tg = getTG();
  if (tg?.openLink) tg.openLink(url);
  else window.open(url, "_blank", "noopener");
}

/**
 * Pay with Telegram Stars. In production `invoiceUrl` is created by the bot
 * backend (Bot API createInvoiceLink, currency XTR). In the demo build there
 * is no backend, so the payment is simulated.
 */
export async function payWithStars(invoiceUrl?: string): Promise<"paid" | "demo" | "cancelled"> {
  const tg = getTG();
  if (invoiceUrl && tg?.openInvoice) {
    return new Promise((resolve) => {
      tg.openInvoice!(invoiceUrl, (status) => {
        resolve(status === "paid" ? "paid" : "cancelled");
      });
    });
  }
  // Demo fallback
  return "demo";
}
