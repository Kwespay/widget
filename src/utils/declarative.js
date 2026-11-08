const TRIGGER = "[data-kwespay-amount]";

function merchantScript() {
  return document.querySelector("script[data-kwespay-key]");
}

export function configFromElement(el, script = merchantScript()) {
  if (!script) return null;
  const merchant = script.dataset;
  const own = el.dataset;
  const tokens = own.kwespayTokens ?? merchant.kwespayTokens;

  const config = {
    apiKey: merchant.kwespayKey,
    vendorId: merchant.kwespayVendor,
    environment: merchant.kwespayEnvironment,
    amount: Number(own.kwespayAmount),
    currency: own.kwespayCurrency ?? merchant.kwespayCurrency,
    orderId: own.kwespayOrder,
    acceptedTokens:
      tokens && tokens !== "stablecoins"
        ? tokens.split(",").map((t) => t.trim()).filter(Boolean)
        : tokens,
  };
  return Object.fromEntries(
    Object.entries(config).filter(([, v]) => v !== undefined && v !== "")
  );
}

export function bindDeclarativeButtons(open) {
  if (bindDeclarativeButtons.bound) return;
  bindDeclarativeButtons.bound = true;

  document.addEventListener("click", (event) => {
    const el = event.target instanceof Element ? event.target.closest(TRIGGER) : null;
    if (!el || el.hasAttribute("disabled") || el.getAttribute("aria-busy") === "true") return;

    const config = configFromElement(el);
    if (!config) return;
    event.preventDefault();

    const emit = (name, detail) =>
      el.dispatchEvent(new CustomEvent(name, { bubbles: true, detail }));

    el.setAttribute("aria-busy", "true");
    let pending;
    try {
      pending = open(config);
    } catch (error) {
      el.removeAttribute("aria-busy");
      emit("kwespay:error", { code: error?.code ?? "INVALID_CONFIG", message: error?.message });
      return;
    }
    pending
      .then((result) => emit("kwespay:result", result))
      .catch((error) =>
        emit("kwespay:error", { code: error?.code ?? "UNKNOWN", message: error?.message })
      )
      .finally(() => el.removeAttribute("aria-busy"));
  });
}
