
if (typeof globalThis !== "undefined" && !globalThis.process) {
  globalThis.process = { env: {} };
}

import KwesPayWidget from "./core/kwespayWidget.js";
import { loadResumeState, clearResumeState } from "./utils/mobileResume.js";
import { bindDeclarativeButtons } from "./utils/declarative.js";

export { KwesPayWidget };
export default KwesPayWidget;

const _instances = new Map();

function _cacheKey(apiKey, vendorId) {
  return `${apiKey}::${vendorId ?? ""}`;
}

export function attemptMobileResume() {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  const saved = loadResumeState();
  if (!saved) return;

  const existingOverlay = document.getElementById("kwespay-widget-overlay");
  if (existingOverlay?.classList.contains("open")) return;

  try {
    const widget = new KwesPayWidget(saved.config);
    const key = saved.config.paymentLink
      ? `link::${saved.config.paymentLink}`
      : _cacheKey(saved.config.apiKey, saved.config.vendorId);
    _instances.set(key, widget);
    widget.resume(saved.flow).finally(() => {
      if (_instances.get(key) === widget) _instances.delete(key);
    });
  } catch {
    clearResumeState();
  }
}

export function hasPendingMobileResume() {
  if (typeof window === "undefined") return false;
  return !!loadResumeState();
}

if (typeof window !== "undefined" && typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", attemptMobileResume, {
      once: true,
    });
  } else {
    attemptMobileResume();
  }

  window.addEventListener("pageshow", (event) => {
    if (event.persisted) attemptMobileResume();
  });

  bindDeclarativeButtons((config) => kwespay(config));
}


export async function kwespay(config) {
  const { apiKey, vendorId, amount, currency, paymentLink } = config;

  if (!paymentLink && !apiKey) throw new Error("[kwespay] apiKey is required");
  if (!paymentLink && (!amount || parseFloat(amount) <= 0))
    throw new Error("[kwespay] A valid amount is required");

  const key = paymentLink ? `link::${paymentLink}` : _cacheKey(apiKey, vendorId);

  let widget = _instances.get(key);

  if (!widget) {
    widget = new KwesPayWidget(config);
    _instances.set(key, widget);
  } else if (!paymentLink) {
    widget.updateAmount(amount, currency);
  }

  try {
    const result = widget.isOpen() ? await widget._paymentPromise : await widget.open();
    return result;
  } finally {
    _instances.delete(key);
  }
}

