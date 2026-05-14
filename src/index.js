

import KwesPayWidget from "./core/kwespayWidget.js";

export { KwesPayWidget };
export default KwesPayWidget;

// Keyed by `${apiKey}::${vendorId}` so a page with multiple vendors/keys
// each get their own widget instance, but a single vendor reuses one.

const _instances = new Map();

function _cacheKey(apiKey, vendorId) {
  return `${apiKey}::${vendorId}`;
}

// kwespay()

/**
 * Open the KwesPay checkout widget and await the result.
 *
 * Handles the full lifecycle — construction, caching, amount updates,
 * open, and cleanup — so callers need nothing else.
 *
 * @param {object} config
 * @param {string}   config.apiKey           Your KwesPay public API key.
 * @param {string}   config.vendorId         Your vendor / merchant UUID.
 * @param {number}   config.amount           Fiat amount to charge (e.g. 49.99).
 * @param {string}  [config.currency]        ISO currency code (default: "USD").
 * @param {string[] | "stablecoins"} [config.acceptedTokens]
 *                                           Restrict accepted crypto tokens.
 *
 * @returns {Promise<PaymentResult>}
 *   Resolves when the payment is confirmed on-chain.
 *   Rejects with an Error whose `.code` is one of:
 *     "USER_CANCELLED"   — user closed the widget without paying
 *     "USER_REJECTED"    — user rejected the wallet transaction
 *     "SESSION_EXPIRED"  — wallet session timed out mid-payment
 *     "WIDGET_DESTROYED" — widget.destroy() was called externally
 *     "UNKNOWN"          — unexpected error (check err.message)
 *
 * @example
 * // Minimal usage — everything else is handled internally
 * try {
 *   const result = await kwespay({
 *     apiKey:   "pk_...",
 *     vendorId: "uuid",
 *     amount:   total,
 *     currency: "USD",
 *   });
 *   console.log("Paid:", result.transactionHash);
 * } catch (err) {
 *   if (err.code !== "USER_CANCELLED") console.error(err);
 * }
 */
export async function kwespay(config) {
  const { apiKey, vendorId, amount, currency, acceptedTokens } = config;

  if (!apiKey) throw new Error("[kwespay] apiKey is required");
  if (!vendorId) throw new Error("[kwespay] vendorId is required");
  if (!amount || parseFloat(amount) <= 0)
    throw new Error("[kwespay] A valid amount is required");

  const key = _cacheKey(apiKey, vendorId);

  // Reuse existing instance or create a fresh one
  let widget = _instances.get(key);

  if (!widget) {
    widget = new KwesPayWidget({
      apiKey,
      vendorId,
      amount,
      currency,
      acceptedTokens,
    });
    _instances.set(key, widget);
  } else {
    // Sync amount/currency in case they changed since last call
    widget.updateAmount(amount, currency);
  }

  try {
    // open() returns a Promise that resolves/rejects when the payment settles.
    const result = await widget.open();
    return result;
  } finally {
    // Always evict after a settled payment or cancellation so the next call
    // starts fresh (new quote, clean state). The DOM is cleaned up by close(),
    // which open() calls internally on success; we just clear our cache ref.
    _instances.delete(key);
  }
}

/**
 * @typedef {object} PaymentResult
 * @property {string} transactionHash       On-chain tx hash.
 * @property {string} transactionReference  KwesPay internal payment reference.
 * @property {string} paymentIdBytes32      On-chain payment ID (bytes32).
 * @property {string} transactionStatus     "completed" | "unconfirmed"
 * @property {number} fiatAmount            Charged fiat amount.
 * @property {string} currency              ISO currency code.
 * @property {string} token                 Crypto token used (e.g. "USDC").
 * @property {string} network               Chain used (e.g. "polygon").
 */
