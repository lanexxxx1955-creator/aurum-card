/* Central app configuration.
 *
 * The bot token is NOT here anymore — it lives as a secret in the Cloudflare
 * Worker proxy (see worker/). The Mini App talks only to the proxy, which
 * validates the Telegram initData signature before touching the Bot API.
 */

/** Cloudflare Worker proxy URL. Replace YOUR-SUBDOMAIN after `wrangler deploy`. */
export const API_BASE = "https://aurum-card-proxy.YOUR-SUBDOMAIN.workers.dev";

export const BOT_USERNAME = "AURUM_CARD_BOT";

/** PRO price, RUB per month (display only; charging happens in the worker) */
export const PRICE_RUB = 299;
export const PRO_DAYS = 30;

/** True once the worker proxy is deployed and API_BASE points to it */
export function proxyConfigured(): boolean {
  return !API_BASE.includes("YOUR-SUBDOMAIN");
}
