/* Central app configuration.
 *
 * SECURITY NOTE (MVP): the bot token lives in client-side code because the app
 * is hosted on static GitHub Pages without a backend. Anyone can extract it
 * from the page source. Money still flows only to YOUR payment provider
 * account, but the bot could be misused for spam. If that happens, revoke the
 * token in @BotFather (/revoke) and paste the new one here. The proper
 * production fix is a tiny proxy (e.g. Cloudflare Worker) holding the token.
 */

export const BOT_TOKEN = "8894031194:AAF4J5imN_pcpBIeW1viiWrQD0SmUVFrF5Y";
export const BOT_USERNAME = "AURUM_CARD_BOT";

/** PRO price, RUB per month */
export const PRICE_RUB = 299;
export const PRO_DAYS = 30;

/**
 * Payment provider token from @BotFather → Bot Settings → Payments.
 * Empty string = payment runs in demo mode (simulated).
 */
export const PAYMENT_PROVIDER_TOKEN = "";
