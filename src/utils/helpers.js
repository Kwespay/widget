export function isMobileDevice() {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );
}

export function isIOSDevice() {
  return /iPhone|iPad|iPod/i.test(navigator.userAgent);
}

export function dispatchWidgetEvent(eventName, detail = {}) {
  const event = new CustomEvent(`kwespay:${eventName}`, {
    detail,
    bubbles: true,
    cancelable: true,
  });
  window.dispatchEvent(event);
}

export function validateAmount(amount) {
  const num = parseFloat(amount);
  return !isNaN(num) && num > 0;
}

export function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function safeJSONParse(str, fallback = null) {
  try {
    return JSON.parse(str);
  } catch {
    return fallback;
  }
}

export function truncateAddress(address, startChars = 6, endChars = 4) {
  if (!address) return "";
  return `${address.slice(0, startChars)}...${address.slice(-endChars)}`;
}

export function truncateHash(hash, startChars = 10, endChars = 8) {
  if (!hash) return "";
  return `${hash.slice(0, startChars)}...${hash.slice(-endChars)}`;
}

export function formatFiatAmount(amount, currency) {
  const num = parseFloat(amount);
  if (isNaN(num)) return `0 ${currency}`;
  return `${num.toFixed(2)} ${currency}`;
}

export function formatCryptoAmount(amount, symbol = "") {
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  if (isNaN(num) || num === 0) return symbol ? `0 ${symbol}` : "0";

  const magnitude = Math.floor(Math.log10(Math.abs(num)));
  const decimalPlaces = Math.max(0, 5 - magnitude);
  const capped = Math.min(decimalPlaces, 8);
  const formatted = num.toFixed(capped).replace(/\.?0+$/, "");

  return symbol ? `${formatted} ${symbol}` : formatted;
}

export function getErrorType(error) {
  const raw = `${error?.message ?? ""} ${error?.reason ?? ""}`;
  const msg = raw.toLowerCase();

  if (
    error?.code === 4001 ||
    error?.code === "ACTION_REJECTED" ||
    error?.code === "USER_CANCELLED" ||
    error?.code === "WALLET_REJECTED" ||
    msg.includes("rejected") ||
    msg.includes("denied") ||
    msg.includes("cancelled") ||
    msg.includes("canceled") ||
    msg.includes("user closed")
  )
    return "USER_REJECTED";

  if (msg.includes("trustline") || msg.includes("trust line"))
    return "MISSING_TRUSTLINE";

  if (
    error?.code === "SESSION_EXPIRED" ||
    msg.includes("no matching key") ||
    msg.includes("session topic doesn't exist") ||
    msg.includes("missing or invalid. request()") ||
    msg.includes("session expired") ||
    msg.includes("session request expired")
  )
    return "SESSION_EXPIRED";

  if (
    msg.includes("failed to open new window") ||
    msg.includes("popup") ||
    msg.includes("user closed the wallet window")
  )
    return msg.includes("closed") ? "USER_REJECTED" : "POPUP_BLOCKED";

  if (
    error?.code === "QUOTE_EXPIRED" ||
    (msg.includes("deadline") && msg.includes("expired")) ||
    msg.includes("quote expired") ||
    msg.includes("quote has expired")
  )
    return "EXPIRED";

  if (
    msg.includes("insufficient") ||
    msg.includes("not enough") ||
    msg.includes("exceeds balance")
  )
    return "INSUFFICIENT_BALANCE";

  if (
    msg.includes("user closed modal") ||
    msg.includes("connection request reset") ||
    msg.includes("pairing")
  )
    return "CONNECTION_REJECTED";

  if (msg.includes("timeout") || msg.includes("timed out")) return "TIMEOUT";

  if (
    msg.includes("hosterror") ||
    msg.includes("error(contract") ||
    msg.includes("would fail") ||
    msg.includes("reverted") ||
    msg.includes("revert") ||
    msg.includes("vm trap") ||
    msg.includes("simulation failed") ||
    msg.includes("execution reverted") ||
    error?.code === "CONTRACT_ERROR" ||
    error?.code === "CALL_EXCEPTION"
  )
    return "CONTRACT_FAILURE";

  if (
    msg.includes("network error") ||
    msg.includes("failed to fetch") ||
    msg.includes("fetch failed") ||
    msg.includes("rpc") ||
    error?.code === "NETWORK_ERROR"
  )
    return "NETWORK";

  return "UNKNOWN";
}

export function getErrorMessage(error, context = {}) {
  const type = getErrorType(error);
  const token = context.token || "this token";

  switch (type) {
    case "USER_REJECTED":
      return "You cancelled the transaction in your wallet.";
    case "MISSING_TRUSTLINE":
      return `Your wallet can't hold ${token} yet. Open your wallet, add a trustline for ${token}, then try the payment again.`;
    case "SESSION_EXPIRED":
      return "Your wallet connection expired. Please reconnect your wallet and try again.";
    case "POPUP_BLOCKED":
      return "Your browser blocked the wallet window. Please try again — and allow pop-ups for this site if it keeps happening.";
    case "EXPIRED":
      return "This payment quote expired. Please go back and start again to get a fresh rate.";
    case "INSUFFICIENT_BALANCE":
      return `You don't have enough ${token} to complete this payment.`;
    case "CONNECTION_REJECTED":
      return "Wallet connection was cancelled. Please try connecting again.";
    case "TIMEOUT":
      return "The request timed out. Please check your connection and try again.";
    case "CONTRACT_FAILURE":
      return "The payment couldn't be completed on-chain. Please try again, or contact support if this keeps happening.";
    case "NETWORK":
      return "Network error. Please check your connection and try again.";
    default:
      return "Something went wrong. Please try again.";
  }
}

export function parseApiTimestamp(value) {
  if (value == null) return NaN;
  if (typeof value === "number") return value;
  const text = String(value).trim();
  const hasZone = /([zZ]|[+-]\d{2}:?\d{2})$/.test(text);
  return new Date(hasZone ? text : `${text}Z`).getTime();
}

export function isCurrencyCode(value) {
  return typeof value === "string" && /^[A-Z]{3}$/.test(value.trim().toUpperCase());
}

export function resolveEnvironment(config, endpoints) {
  if (config.graphqlEndpoint) {
    const endpoint = config.graphqlEndpoint;
    const environment =
      config.environment ?? (/testnet|localhost|127\.0\.0\.1|:\d+\//i.test(endpoint) ? "testnet" : "mainnet");
    return { endpoint, environment };
  }
  const environment = config.environment === "testnet" ? "testnet" : "mainnet";
  return { endpoint: endpoints[environment], environment };
}

const HTML_ESCAPES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

export function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (ch) => HTML_ESCAPES[ch]);
}

export function safeImageUrl(value) {
  const url = String(value ?? "").trim();
  if (!url) return "";
  if (/^data:image\/(png|jpe?g|gif|webp|svg\+xml)[;,]/i.test(url)) return escapeHtml(url);
  try {
    const parsed = new URL(url, window.location.href);
    if (parsed.protocol === "https:" || parsed.protocol === "http:") return escapeHtml(parsed.href);
  } catch (_) {}
  return "";
}
