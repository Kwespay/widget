import { indexCatalog } from "../../config/catalog.js";
import { icon } from "../../ui/icons.js";
import { dispatchWidgetEvent, escapeHtml, safeImageUrl } from "../../utils/helpers.js";

const ZERO_DECIMAL = new Set(["XOF", "XAF", "UGX", "RWF"]);
const PAGE_BG = "#0a0a0f";

function decimalsFor(currency) {
  return ZERO_DECIMAL.has(String(currency || "").toUpperCase()) ? 0 : 2;
}

function formatFiat(amount, currency) {
  const value = Number(amount);
  if (!Number.isFinite(value)) return `— ${currency}`;
  const decimals = decimalsFor(currency);
  const whole = Number.isInteger(value);
  const text = value.toLocaleString("en", {
    minimumFractionDigits: whole ? 0 : decimals,
    maximumFractionDigits: decimals,
  });
  return `${text} ${currency}`;
}

function checkAmount(raw, currency, min, max) {
  const text = String(raw ?? "").trim().replace(/,/g, "");
  if (!text) return { error: "Enter an amount." };
  if (!/^\d+(\.\d+)?$/.test(text)) return { error: "Enter a number, like 25 or 25.50." };
  const decimals = decimalsFor(currency);
  if ((text.split(".")[1] ?? "").length > decimals) {
    return { error: decimals === 0 ? `${currency} amounts must be whole numbers.` : `Use at most ${decimals} decimal places.` };
  }
  const value = Number(text);
  if (!(value > 0)) return { error: "The amount must be more than zero." };
  if (value > 1e9) return { error: "That amount is too large." };
  if (min && value < Number(min)) return { error: `The minimum is ${formatFiat(min, currency)}.` };
  if (max && value > Number(max)) return { error: `The maximum is ${formatFiat(max, currency)}.` };
  return { value: text.replace(/^0+(?=\d)/, "") };
}

function hexToRgb(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || "").trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function luminance([r, g, b]) {
  const lin = (c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function contrast(a, b) {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

export function brandAccent(hex) {
  const base = hexToRgb(hex);
  if (!base) return null;
  const bg = hexToRgb(PAGE_BG);
  let accent = base;
  for (let i = 0; i < 24 && contrast(accent, bg) < 3; i++) {
    accent = accent.map((c) => c + (255 - c) * 0.12);
  }
  accent = accent.map((c) => Math.round(c));
  const white = [255, 255, 255];
  const onAccent = contrast(accent, white) >= contrast(accent, bg) ? "#ffffff" : PAGE_BG;
  const [r, g, b] = accent;
  return {
    accent: `rgb(${r}, ${g}, ${b})`,
    dim: `rgba(${r}, ${g}, ${b}, 0.12)`,
    glow: `rgba(${r}, ${g}, ${b}, 0.3)`,
    border: `rgba(${r}, ${g}, ${b}, 0.55)`,
    onAccent,
  };
}

function initials(name) {
  const words = String(name || "").trim().split(/\s+/).filter(Boolean);
  if (!words.length) return "K";
  return (words.length === 1 ? words[0].slice(0, 2) : words[0][0] + words[words.length - 1][0]).toUpperCase();
}

function merchantMark(merchant) {
  const url = safeImageUrl(merchant?.logoUrl);
  const fallback = escapeHtml(initials(merchant?.displayName));
  if (url) return `<img class="kp-merchant-logo" src="${url}" alt="" data-kp-fallback="${fallback}" />`;
  return `<span class="kp-merchant-logo kp-merchant-initials" aria-hidden="true">${fallback}</span>`;
}

function badgeMark(merchant) {
  const url = safeImageUrl(merchant?.logoUrl);
  const fallback = escapeHtml(initials(merchant?.displayName));
  if (url) return `<img class="kp-link-badge" src="${url}" alt="" data-kp-fallback="${fallback}" />`;
  return `<span class="kp-link-badge kp-merchant-initials" aria-hidden="true">${fallback}</span>`;
}

const EYEBROW = { payment_request: "Payment request", donation: "Contribution", event: "Event" };
const AMOUNT_LABEL = { donation: "Contribution", flexible: "Amount", payment_request: "Amount due" };

export const LinkMethods = {
  _brandTitle() {
    return this.state.paymentLink?.merchant?.displayName || "KwesPay Checkout";
  },

  _linkNeedsDetails(link) {
    const f = link.customerFields || {};
    return (
      link.pricingMode === "flexible" ||
      [f.name, f.email, f.reference].some((m) => m && m !== "off") ||
      Boolean(
        link.description ||
          safeImageUrl(link.imageUrl) ||
          link.eventStartsAt ||
          link.eventLocation ||
          Number(link.targetAmount) > 0 ||
          link.merchant?.supportMessage
      )
    );
  },

  _applyLinkBranding(link) {
    const overlay = document.getElementById("kwespay-widget-overlay");
    if (!overlay) return;
    const palette = brandAccent(link.merchant?.primaryColor);
    if (palette) {
      overlay.classList.add("kp-branded");
      overlay.style.setProperty("--kp-accent", palette.accent);
      overlay.style.setProperty("--kp-accent-dim", palette.dim);
      overlay.style.setProperty("--kp-accent-glow", palette.glow);
      overlay.style.setProperty("--kp-border-active", palette.border);
      overlay.style.setProperty("--kp-on-accent", palette.onAccent);
    }
    const name = link.merchant?.displayName || "KwesPay Checkout";
    overlay.querySelectorAll(".kwespay-steps-wrapper > .step:not(#kwespay-step4) .kp-topbar-name").forEach((el) => {
      el.textContent = name;
      el.parentElement?.querySelectorAll(".kp-merchant-logo").forEach((mark) => mark.remove());
      el.insertAdjacentHTML("beforebegin", merchantMark(link.merchant));
    });
    const step1Amount = document.querySelector("#kwespay-step1 .kp-amount-block");
    document.getElementById("kwespay-linkSummary")?.remove();
    if (step1Amount) {
      step1Amount.insertAdjacentHTML(
        "beforebegin",
        `<div class="kp-link-strip" id="kwespay-linkSummary">
          ${safeImageUrl(link.imageUrl) ? `<img class="kp-link-strip-thumb" src="${safeImageUrl(link.imageUrl)}" alt="" />` : ""}
          <div class="kp-link-strip-text">
            <p class="kp-link-strip-title">${escapeHtml(link.title)}</p>
            ${link.reference ? `<p class="kp-link-strip-meta">Reference ${escapeHtml(link.reference)}</p>` : ""}
          </div>
        </div>`
      );
    }
    const label = AMOUNT_LABEL[link.purpose];
    if (label) {
      overlay.querySelectorAll(".kp-amount-label").forEach((el) => {
        if (el.textContent.trim().toLowerCase() === "total due") el.textContent = label;
      });
    }
  },

  async updatePreviewLink(link) {
    if (!this.config.preview || !link || !this.paymentService) return false;
    this.paymentService.previewLink = link;
    document.getElementById("kwespay-widget-overlay")?.classList.add("kp-instant");
    const onNetworks = this.state.currentStep === 1;
    await this._loadPaymentLink(false);
    if (this.state.paymentLink?.state !== "active") return true;
    if (this._linkNeedsDetails(link)) {
      this._renderLinkDetailsStep(link);
      if (onNetworks) this._goToStep(1);
    } else if (!onNetworks) {
      this._goToStep(1);
    }
    this._renderNetworkList();
    return true;
  },

  async _loadPaymentLink(navigateOnSuccess = true) {
    let link;
    try {
      link = await this.paymentService.loadLink();
    } catch (err) {
      const missing = /doesn't exist|not found/i.test(err?.message || "");
      if (missing) {
        this._renderLinkClosedStep({
          title: "Payment link unavailable",
          body: "This payment link doesn't exist or is no longer available. Check the link with the person who sent it.",
        });
      } else if (this._isCurrentInstance()) {
        this._goToStep(0.5);
      }
      dispatchWidgetEvent("paymentLinkError", { error: err?.message });
      return;
    }

    this.state.paymentLink = link;
    this.config.currency = link.currency;
    this._applyLinkBranding(link);

    if (link.state !== "active") {
      const copy = {
        completed: ["Already paid", "This payment has already been completed. No further payment is needed."],
        expired: ["Payment link expired", "This payment link has expired. Contact the merchant for a new one."],
        inactive: ["Not accepting payments", "This payment link isn't accepting payments right now. Please check back later."],
      }[link.state] ?? ["Payment link unavailable", "This payment link isn't available."];
      this._renderLinkClosedStep({ title: copy[0], body: copy[1], link });
      dispatchWidgetEvent("paymentLinkLoaded", { state: link.state });
      return;
    }

    try {
      const [validation, merchantConfig, networks] = await Promise.all([
        this.paymentService.validateAPIKey(),
        this.paymentService.getMerchantConfig(),
        this.paymentService.getNetworks(),
      ]);
      this.state.vendorInfo = validation.vendorInfo;
      this.state.keyAllowedNetworks = validation.allowedNetworks;
      this.state.keyAllowedTokens = validation.allowedTokens;
      this.state.merchantConfig = merchantConfig;
      this.state.catalog = indexCatalog(networks);
    } catch (err) {
      if (this._isCurrentInstance()) this._goToStep(0.5);
      dispatchWidgetEvent("paymentLinkError", { error: err?.message });
      return;
    }

    if (link.pricingMode === "fixed") {
      this._setLinkAmount(link.amount);
    } else if (this.config.amount > 0) {
      this._setLinkAmount(String(this.config.amount));
    }
    this.paymentService.setCheckoutDetails({ amount: this._linkAmount ?? null, customer: this.config.customer });

    dispatchWidgetEvent("paymentLinkLoaded", { state: link.state });
    if (!navigateOnSuccess || !this._isCurrentInstance()) return;

    if (this._linkNeedsDetails(link)) {
      this._renderLinkDetailsStep(link);
    } else {
      this._goToStep(1);
      this._renderNetworkList();
    }
  },

  _setLinkAmount(amount) {
    this._linkAmount = String(amount);
    this.config.amount = Number(amount);
    const display = formatFiat(amount, this.config.currency);
    document
      .querySelectorAll(
        '.kwespay-container .kp-amount-value, [id*="summaryFiatAmount"], [id*="txFiatAmount"], [id*="reviewFiatAmount"]'
      )
      .forEach((el) => {
        el.textContent = display;
      });
  },

  _renderLinkClosedStep({ title, body, link }) {
    this._removeCustomStep("kwespay-step-link-closed");
    const wrapper = document.querySelector(".kwespay-steps-wrapper");
    if (!wrapper) return;
    const step = document.createElement("div");
    step.className = "step";
    step.id = "kwespay-step-link-closed";
    const merchant = link?.merchant;
    step.innerHTML = `
      <div class="kp-topbar">
        <div class="kp-topbar-brand">
          ${merchant ? merchantMark(merchant) : ""}
          <span class="kp-topbar-name">${escapeHtml(merchant?.displayName || "KwesPay Checkout")}</span>
        </div>
      </div>
      <div class="loading-container" style="flex:1">
        <div class="kp-link-closed-icon">${icon(link?.state === "completed" ? "check_circle" : "link_off")}</div>
        <h2 class="headline">${escapeHtml(title)}</h2>
        <p class="body-text">${escapeHtml(body)}</p>
        ${link?.title ? `<p class="kp-link-closed-title">${escapeHtml(link.title)}</p>` : ""}
      </div>
      <div class="kp-footer">
        ${icon("lock", "kp-footer-lock", "font-size:12px")}
        <span class="kp-footer-text">Powered by &middot; <span>KwesPay</span></span>
      </div>
    `;
    wrapper.appendChild(step);
    this._goToStep("link-closed");
  },

  _renderLinkDetailsStep(link) {
    this._removeCustomStep("kwespay-step-link");
    const wrapper = document.querySelector(".kwespay-steps-wrapper");
    if (!wrapper) return;
    const fields = link.customerFields || {};
    const customer = this.config.customer || {};
    const currency = link.currency;
    const flexible = link.pricingMode === "flexible";
    const image = safeImageUrl(link.imageUrl);
    const eyebrow = EYEBROW[link.purpose];
    const target = Number(link.targetAmount);
    const raised = Math.max(0, Number(link.collectedAmount) || 0);
    const percent = target > 0 ? Math.min(100, (raised / target) * 100) : null;
    const eventDate = link.eventStartsAt ? new Date(link.eventStartsAt) : null;
    const hint = link.minAmount && link.maxAmount
      ? `Between ${formatFiat(link.minAmount, currency)} and ${formatFiat(link.maxAmount, currency)}`
      : link.minAmount
        ? `Minimum ${formatFiat(link.minAmount, currency)}`
        : link.maxAmount
          ? `Maximum ${formatFiat(link.maxAmount, currency)}`
          : "";
    const field = (key, label, mode, type, autocomplete, max) =>
      mode && mode !== "off"
        ? `<div class="kp-field">
            <label class="kp-field-label" for="kwespay-link-${key}">
              <span>${escapeHtml(label)}</span>${mode === "optional" ? `<span class="kp-field-optional">Optional</span>` : ""}
            </label>
            <input class="kp-input" id="kwespay-link-${key}" type="${type}" autocomplete="${autocomplete}" maxlength="${max}"
              value="${escapeHtml(customer[key] || "")}" ${mode === "required" ? "required" : ""} />
            <p class="kp-field-error" id="kwespay-link-${key}-error" role="alert"></p>
          </div>`
        : "";

    const step = document.createElement("div");
    step.className = "step";
    step.id = "kwespay-step-link";
    step.innerHTML = `
      <div class="kp-topbar">
        <span class="kp-topbar-secure">${icon("lock")}Powered by <strong>KwesPay</strong></span>
      </div>
      <div class="content-scroll">
        ${image ? `<div class="kp-link-hero"><div class="kp-link-cover"><img src="${image}" alt="" /></div></div>` : ""}
        <div class="kp-link-identity${image ? " on-cover" : ""}">
          ${badgeMark(link.merchant)}
          <span class="kp-link-identity-name">${escapeHtml(link.merchant.displayName)}</span>
        </div>
        ${eyebrow ? `<p class="kp-link-eyebrow">${escapeHtml(eyebrow)}</p>` : ""}
        <h2 class="kp-link-title">${escapeHtml(link.title)}</h2>
        ${link.description ? `<p class="kp-link-desc">${escapeHtml(link.description)}</p>` : ""}
        ${eventDate && !Number.isNaN(eventDate.getTime())
          ? `<p class="kp-link-meta">${icon("schedule")}<span>${escapeHtml(eventDate.toLocaleString(undefined, { weekday: "short", day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" }))}</span></p>`
          : ""}
        ${link.eventLocation ? `<p class="kp-link-meta">${icon("location_on")}<span>${escapeHtml(link.eventLocation)}</span></p>` : ""}
        ${link.reference ? `<p class="kp-link-meta"><span>Reference ${escapeHtml(link.reference)}</span></p>` : ""}
        ${percent !== null
          ? `<div class="kp-link-progress">
              <div class="kp-link-progress-row"><span>${escapeHtml(formatFiat(raised, currency))} raised</span><span>of ${escapeHtml(formatFiat(target, currency))}</span></div>
              <div class="kp-link-progress-track" role="progressbar" aria-label="Amount raised toward the target" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(percent)}">
                <div class="kp-link-progress-fill" style="width:${percent > 0 ? Math.max(percent, 2) : 0}%"></div>
              </div>
              <p class="kp-link-progress-note">Based on confirmed payments.</p>
            </div>`
          : ""}
        <div class="kp-link-section">
          ${flexible
            ? `<div class="kp-field">
                <label class="kp-field-label" for="kwespay-link-amount"><span>${escapeHtml(AMOUNT_LABEL[link.purpose] || "Amount")}</span></label>
                ${link.suggestedAmounts?.length
                  ? `<div class="kp-suggest-grid" role="group" aria-label="Suggested amounts">
                      ${link.suggestedAmounts.map((s) => `<button type="button" class="kp-suggest" data-amount="${escapeHtml(s)}" aria-pressed="false">${escapeHtml(formatFiat(s, currency))}</button>`).join("")}
                    </div>`
                  : ""}
                <div class="kp-input-wrap">
                  <span class="kp-input-prefix">${escapeHtml(currency)}</span>
                  <input class="kp-input kp-input-amount" id="kwespay-link-amount" inputmode="${decimalsFor(currency) ? "decimal" : "numeric"}"
                    autocomplete="off" placeholder="${decimalsFor(currency) ? "0.00" : "0"}" value="${escapeHtml(this._linkAmount || "")}" />
                </div>
                ${hint ? `<p class="kp-field-hint">${escapeHtml(hint)}</p>` : ""}
                <p class="kp-field-error" id="kwespay-link-amount-error" role="alert"></p>
              </div>`
            : `<div class="kp-link-fixed">
                <div class="kp-amount-label">${escapeHtml(AMOUNT_LABEL[link.purpose] || "Total due")}</div>
                <div class="kp-amount-value">${escapeHtml(formatFiat(link.amount, currency))}</div>
              </div>`}
          ${field("name", "Your name", fields.name, "text", "name", 120)}
          ${field("email", "Email address", fields.email, "email", "email", 254)}
          ${field("reference", fields.referenceLabel || "Reference", fields.reference, "text", "off", 128)}
        </div>
        ${link.merchant.supportMessage ? `<p class="kp-link-support">${escapeHtml(link.merchant.supportMessage)}</p>` : ""}
      </div>
      <div class="bottom-action">
        <button class="action-btn" id="kwespay-linkContinue">Continue</button>
      </div>
    `;
    wrapper.appendChild(step);

    const cover = step.querySelector(".kp-link-cover img");
    if (cover) {
      const reveal = () => cover.classList.add("is-loaded");
      if (cover.complete && cover.naturalWidth) reveal();
      else {
        cover.addEventListener("load", reveal, { once: true });
        cover.addEventListener("error", () => step.querySelector(".kp-link-hero")?.remove(), { once: true });
      }
    }
    step.querySelectorAll(".kp-link-badge[data-kp-fallback]").forEach((img) =>
      img.addEventListener(
        "error",
        () => {
          const span = document.createElement("span");
          span.className = "kp-link-badge kp-merchant-initials";
          span.setAttribute("aria-hidden", "true");
          span.textContent = img.dataset.kpFallback || "";
          img.replaceWith(span);
        },
        { once: true }
      )
    );

    const amountInput = step.querySelector("#kwespay-link-amount");
    const syncSuggestions = () => {
      step.querySelectorAll(".kp-suggest").forEach((btn) => {
        btn.setAttribute("aria-pressed", String(amountInput && Number(amountInput.value) === Number(btn.dataset.amount)));
      });
    };
    step.querySelectorAll(".kp-suggest").forEach((btn) => {
      btn.addEventListener("click", () => {
        if (!amountInput) return;
        amountInput.value = btn.dataset.amount;
        syncSuggestions();
        step.querySelector("#kwespay-link-amount-error").textContent = "";
      });
    });
    amountInput?.addEventListener("input", () => {
      amountInput.value = amountInput.value.replace(/[^\d.,]/g, "");
      syncSuggestions();
    });
    syncSuggestions();

    const brand = document.querySelector("#kwespay-step1 .kp-topbar-brand");
    if (brand && !document.getElementById("kwespay-link-back1")) {
      brand.insertAdjacentHTML(
        "afterbegin",
        `<button class="kp-back-btn" id="kwespay-link-back1" aria-label="Back">${icon("arrow_back")}</button>`
      );
      document.getElementById("kwespay-link-back1").addEventListener("click", () => this._goToStep("link"));
    }

    step.querySelector("#kwespay-linkContinue").addEventListener("click", () => this._submitLinkDetails(link));
    step.querySelectorAll("input").forEach((input) => {
      input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          this._submitLinkDetails(link);
        }
      });
      input.addEventListener("input", () => {
        const error = step.querySelector(`#${input.id}-error`);
        if (error) error.textContent = "";
        input.setAttribute("aria-invalid", "false");
      });
    });
    this._goToStep("link");
  },

  _submitLinkDetails(link) {
    const step = document.getElementById("kwespay-step-link");
    if (!step) return;
    const fields = link.customerFields || {};
    const setError = (key, message) => {
      const el = step.querySelector(`#kwespay-link-${key}-error`);
      if (el) el.textContent = message || "";
      step.querySelector(`#kwespay-link-${key}`)?.setAttribute("aria-invalid", message ? "true" : "false");
    };
    let firstInvalid = null;
    let amount = link.pricingMode === "fixed" ? String(link.amount) : null;
    if (link.pricingMode === "flexible") {
      const result = checkAmount(step.querySelector("#kwespay-link-amount")?.value, link.currency, link.minAmount, link.maxAmount);
      setError("amount", result.error);
      if (result.error) firstInvalid = firstInvalid || "amount";
      else amount = result.value;
    }
    const customer = {};
    for (const key of ["name", "email", "reference"]) {
      const mode = fields[key];
      if (!mode || mode === "off") continue;
      const value = (step.querySelector(`#kwespay-link-${key}`)?.value || "").trim();
      let message = "";
      if (mode === "required" && !value) {
        message = key === "email" ? "Enter your email address." : key === "name" ? "Enter your name." : `Enter your ${(fields.referenceLabel || "reference").toLowerCase()}.`;
      } else if (key === "email" && value && !/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(value)) {
        message = "Enter a valid email address.";
      }
      setError(key, message);
      if (message) firstInvalid = firstInvalid || key;
      customer[key] = value;
    }
    if (firstInvalid) {
      step.querySelector(`#kwespay-link-${firstInvalid}`)?.focus();
      return;
    }
    this.config.customer = customer;
    this._setLinkAmount(amount);
    this.paymentService.setCheckoutDetails({ amount, customer });
    this._goToStep(1);
    this._renderNetworkList();
  },

  async _finishLinkPage() {
    let status = null;
    try {
      status = await this.paymentService.checkoutStatus();
    } catch (_) {}
    const redirect = status?.paid && status.redirectUrl ? status.redirectUrl : null;
    if (redirect) {
      try {
        const url = new URL(redirect);
        if (url.protocol === "https:" && !url.username && !url.password) {
          window.location.assign(url.href);
          return;
        }
      } catch (_) {}
    }
    const done = document.getElementById("kwespay-closeSuccessBtn");
    if (done) done.style.display = "none";
    const countdown = document.getElementById("kwespay-receiptCountdown");
    if (countdown) countdown.textContent = "You can now close this page.";
    const bar = document.getElementById("kwespay-receiptCountdownBar");
    if (bar?.parentElement) bar.parentElement.style.display = "none";
  },
};
