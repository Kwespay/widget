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
  const msg = error?.message ?? "";
  if (
    error?.code === 4001 ||
    error?.code === "ACTION_REJECTED" ||
    msg.includes("rejected") ||
    msg.includes("denied") ||
    msg.includes("cancelled")
  )
    return "USER_REJECTED";
  if (msg.toLowerCase().includes("insufficient")) return "INSUFFICIENT_BALANCE";
  if (
    msg.includes("User rejected") ||
    msg.includes("User closed modal") ||
    msg.includes("Connection request reset")
  )
    return "CONNECTION_REJECTED";
  if (msg.includes("timeout")) return "TIMEOUT";
  return "UNKNOWN";
}

export function getErrorMessage(error, context = {}) {
  const type = getErrorType(error);

  console.error("[KwesPay] Payment error breakdown:", {
    errorType: type,
    message: error?.message,
    code: error?.code,
    data: error?.data,
    reason: error?.reason,
    stack: error?.stack,
    raw: error,
    context,
  });

  if (error?.data) console.error("[KwesPay] Contract revert data:", error.data);
  if (error?.transaction)
    console.error("[KwesPay] Failed tx details:", error.transaction);
  if (error?.receipt) console.error("[KwesPay] Tx receipt:", error.receipt);

  switch (type) {
    case "USER_REJECTED":
      return "You cancelled the transaction in your wallet.";
    case "INSUFFICIENT_BALANCE":
      return `Not enough ${context.token || "funds"} to complete this payment.`;
    case "CONNECTION_REJECTED":
      return "Wallet connection was cancelled.";
    case "TIMEOUT":
      return "Connection timed out. Please try again.";
    default:
      return (
        error?.reason ||
        error?.message ||
        "Something went wrong while processing your payment."
      );
  }
}
