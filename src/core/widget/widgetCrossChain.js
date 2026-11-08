import { dispatchWidgetEvent, escapeHtml, safeImageUrl, truncateAddress, truncateHash } from "../../utils/helpers.js";
import { icon } from "../../ui/icons.js";
import StellarWalletService from "../../services/StellarWalletService.js";
import { ensureBuffer } from "../../utils/nodeGlobals.js";

const STELLAR_PUBLIC = "Public Global Stellar Network ; September 2015";

const ORIGIN_LABELS = ["XLM", "BTC"];
const POLL_MS = 5000;
const STABLE_PREFERENCE = ["USDC", "USDT"];
const REFUND_PATTERNS = {
  stellar: /^G[A-Z2-7]{55}$/,
  btc: /^(bc1[02-9ac-hj-np-z]{11,71}|[13][1-9A-HJ-NP-Za-km-z]{25,34})$/,
};
const STEP_IDS = ["kwespay-step-cc-assets", "kwespay-step-cc-method", "kwespay-step-cc-wallets", "kwespay-step-cc-refund", "kwespay-step-cc-deposit"];
const PROGRESS = [
  { key: "deposit", label: "Send" },
  { key: "convert", label: "Convert" },
  { key: "paid", label: "Paid" },
];

function originLogo(origin, catalog) {
  const stellar = Object.values(catalog ?? {}).find((c) => c.network.ecosystem === "stellar" && c.network.type === "mainnet")
    ?? Object.values(catalog ?? {}).find((c) => c.network.ecosystem === "stellar");
  const url = origin === "XLM" ? safeImageUrl(stellar?.tokens?.find((t) => t.symbol === "XLM")?.icon ?? stellar?.network?.logo) : "";
  if (url) return `<img src="${url}" alt="${escapeHtml(origin)}" data-kp-fallback="${origin.charAt(0)}" />`;
  const marks = { BTC: "\u20bf", XLM: "\u2726" };
  const mark = marks[origin] ?? origin.charAt(0);
  return `<span class="kp-cc-mark kp-cc-mark-${escapeHtml(origin.toLowerCase())}">${escapeHtml(mark)}</span>`;
}

function formatEta(seconds) {
  if (!seconds) return "";
  if (seconds < 90) return `about ${Math.max(10, Math.round(seconds / 10) * 10)} sec`;
  return `about ${Math.round(seconds / 60)} min`;
}

function paymentUri(route) {
  if (route.originChain === "stellar") {
    const params = new URLSearchParams({ destination: route.depositAddress, amount: route.amountInFormatted });
    if (route.depositMemo) {
      params.set("memo", route.depositMemo);
      params.set("memo_type", "MEMO_ID");
    }
    return `web+stellar:pay?${params.toString()}`;
  }
  if (route.originChain === "btc") return `bitcoin:${route.depositAddress}?amount=${route.amountInFormatted}`;
  return route.depositAddress;
}

function stageOf(route) {
  if (["settled"].includes(route.status) || ["completed", "overpaid"].includes(route.transactionStatus)) return "paid";
  if (["deposit_seen", "processing", "delivered", "incomplete", "failed"].includes(route.status)) return "convert";
  return "deposit";
}

async function copyText(value, button) {
  try {
    await navigator.clipboard.writeText(value);
  } catch {
    const area = document.createElement("textarea");
    area.value = value;
    document.body.appendChild(area);
    area.select();
    try { document.execCommand("copy"); } catch {}
    area.remove();
  }
  if (button) {
    const original = button.textContent;
    button.textContent = "Copied";
    setTimeout(() => { button.textContent = original; }, 1500);
  }
}

async function renderQr(el, uri) {
  if (!el) return;
  try {
    const mod = await import("qrcode");
    const QRCode = mod.default ?? mod;
    el.innerHTML = await QRCode.toString(uri, { type: "svg", margin: 1, color: { dark: "#0b0b0f", light: "#ffffff" } });
    const svg = el.querySelector("svg");
    if (svg) Object.assign(svg.style, { width: "100%", height: "100%", display: "block" });
  } catch {
    el.remove();
  }
}

export const CrossChainMethods = {
  _crossChainDestination() {
    if (this.config.paymentLink) return null;
    const offered = this.state.merchantConfig?.crossChainNetworks ?? [];
    if (!offered.length || typeof this.paymentService.getCrossChainOptions !== "function") return null;
    const enabled = new Set(this._resolveEnabledNetworks());
    for (const network of offered) {
      if (!enabled.has(network)) continue;
      const accepted = this._resolveAcceptedTokensForNetwork(network);
      const token = STABLE_PREFERENCE.find((t) => accepted.includes(t));
      if (token) return { network, token, config: this._networkConfig(network) };
    }
    return null;
  },

  _renderCrossChainEntry() {
    document.getElementById("kwespay-cc-section")?.remove();
    const destination = this._crossChainDestination();
    const hint = document.getElementById("kwespay-step1-hint");
    if (hint) hint.textContent = destination ? `Select a network, or pay with ${ORIGIN_LABELS.join(" or ")}` : "Select a network to continue";
    if (!destination) return;

    const mainnetList = document.getElementById("kwespay-mainnetList");
    if (!mainnetList) return;
    const section = document.createElement("div");
    section.id = "kwespay-cc-section";
    section.className = "kp-cc-section";
    section.innerHTML = `
      <div class="kp-section-divider">Pay from another chain</div>
      <button type="button" class="list-item kp-cc-entry" id="kwespay-cc-entry">
        <div class="kp-cc-logos">
          ${ORIGIN_LABELS.map((o) => `<span class="kp-cc-logo">${originLogo(o, this.state.catalog)}</span>`).join("")}
        </div>
        <div class="item-info">
          <div class="item-name-row"><p class="item-name">Pay with ${ORIGIN_LABELS.join(" or ")}</p></div>
          <p class="item-desc">Send from any wallet or exchange. No wallet connection needed.</p>
        </div>
        ${icon("chevron_right", "item-chevron")}
      </button>
    `;
    mainnetList.insertAdjacentElement("afterend", section);
    section.querySelector("#kwespay-cc-entry").addEventListener("click", () => this._openCrossChainAssets());
  },

  _ccRemoveSteps() {
    STEP_IDS.forEach((id) => this._removeCustomStep(id));
  },

  _ccStopPolling() {
    this._ccPollToken = null;
    if (this._ccTimer) clearInterval(this._ccTimer);
    this._ccTimer = null;
  },

  _ccStep(id, title, body, { back = null, footer = "" } = {}) {
    this._removeCustomStep(id);
    const container = document.getElementById("kwespay-widget-container");
    const step = document.createElement("div");
    step.className = "step";
    step.id = id;
    step.innerHTML = `
      <div class="kp-topbar">
        <div class="kp-topbar-brand">
          ${back ? `<button class="kp-back-btn" data-cc-back>${icon("arrow_back")}</button>` : ""}
          <span class="kp-topbar-name">${escapeHtml(title)}</span>
        </div>
      </div>
      <div class="kp-amount-block">
        <div class="kp-amount-label">Total due</div>
        <div class="kp-amount-value">${escapeHtml(this._displayAmount)} ${escapeHtml(this.config.currency)}</div>
      </div>
      <div class="content-scroll">${body}</div>
      ${footer}
    `;
    container.appendChild(step);
    if (back) step.querySelector("[data-cc-back]").addEventListener("click", back);
    this._goToStep(id.replace("kwespay-step-", ""));
    return step;
  },

  async _openCrossChainAssets() {
    const destination = this._crossChainDestination();
    if (!destination) return;
    this.state.ccDestination = destination;
    const receiveName = destination.config?.name ?? destination.network;

    const step = this._ccStep(
      "kwespay-step-cc-assets",
      "Pay from another chain",
      `
        <p class="section-hint">Choose what you'll pay with. The merchant receives ${escapeHtml(destination.token)} on ${escapeHtml(receiveName)}.</p>
        <div class="item-list" id="kwespay-cc-options">
          <div class="kp-cc-loading">Getting live prices…</div>
        </div>
      `,
      { back: () => { this._ccRemoveSteps(); this._goToStep(1); } }
    );

    try {
      const quote = await this.paymentService.getQuote({
        vendorId: this.config.vendorId,
        cryptoCurrency: destination.token,
        fiatAmount: this.config.amount,
        fiatCurrency: this.config.currency,
        network: destination.network,
        orderId: this.config.orderId,
      });
      this.state.ccQuote = quote;
      const { options } = await this.paymentService.getCrossChainOptions({ quote });
      this._renderCrossChainOptions(step, options);
    } catch (err) {
      const list = step.querySelector("#kwespay-cc-options");
      if (list) list.innerHTML = `<div class="kp-cc-loading">${escapeHtml(err?.message ?? "Prices are unavailable right now. Please try again.")}</div>`;
    }
  },

  _renderCrossChainOptions(step, options) {
    const list = step.querySelector("#kwespay-cc-options");
    if (!list) return;
    list.innerHTML = "";
    if (!options.length) {
      list.innerHTML = `<div class="kp-cc-loading">No other assets are available for this payment.</div>`;
      return;
    }
    options.forEach((option) => {
      const item = document.createElement("button");
      item.type = "button";
      item.className = "list-item kp-cc-option" + (option.available ? "" : " is-disabled");
      item.disabled = !option.available;
      const detail = option.available
        ? [option.chainName, formatEta(option.timeEstimateSeconds)].filter(Boolean).join(" · ")
        : option.code === "AMOUNT_BELOW_MINIMUM"
          ? `Available for payments from $${option.minimumUsd}`
          : option.reason ?? "Unavailable right now";
      item.innerHTML = `
        <div class="item-icon">${originLogo(option.originAsset, this.state.catalog)}</div>
        <div class="item-info">
          <div class="item-name-row"><p class="item-name">${escapeHtml(option.name)}</p></div>
          <p class="item-desc">${escapeHtml(detail)}</p>
        </div>
        ${option.available ? `<div class="kp-cc-price">${escapeHtml(option.amountInFormatted)} ${escapeHtml(option.originAsset)}</div>` : ""}
      `;
      if (option.available) item.addEventListener("click", () => (option.chain === "stellar" ? this._openCrossChainMethod(option) : this._openCrossChainRefund(option)));
      list.appendChild(item);
    });
  },

  _openCrossChainMethod(option) {
    const step = this._ccStep(
      "kwespay-step-cc-method",
      `Pay with ${option.originAsset}`,
      `
        <div class="kp-cc-summary">
          <span>You'll send about</span>
          <strong>${escapeHtml(option.amountInFormatted)} ${escapeHtml(option.originAsset)}</strong>
        </div>
        <div class="item-list">
          <button type="button" class="list-item kp-cc-option kp-cc-primary" data-method="wallet">
            <div class="item-info">
              <div class="item-name-row"><p class="item-name">Pay with a ${escapeHtml(option.chainName)} wallet</p></div>
              <p class="item-desc">Freighter, Lobstr, xBull and more. The amount and memo are filled in for you.</p>
            </div>
            ${icon("chevron_right", "item-chevron")}
          </button>
          <button type="button" class="list-item kp-cc-option" data-method="manual">
            <div class="item-info">
              <div class="item-name-row"><p class="item-name">Send from an exchange or another app</p></div>
              <p class="item-desc">Copy the address and memo, or scan a QR code.</p>
            </div>
            ${icon("chevron_right", "item-chevron")}
          </button>
        </div>
      `,
      { back: () => { this._removeCustomStep("kwespay-step-cc-method"); this._goToStep("cc-assets"); } }
    );
    step.querySelector('[data-method="wallet"]').addEventListener("click", () => this._ccPickStellarWallet(option));
    step.querySelector('[data-method="manual"]').addEventListener("click", () => this._openCrossChainRefund(option));
  },

  async _ccPickStellarWallet(option) {
    if (!this.stellarWalletService) {
      this.stellarWalletService = new StellarWalletService({ projectId: this.config?.projectId, appName: this.config?.appName });
    }
    const step = this._ccStep(
      "kwespay-step-cc-wallets",
      "Connect Stellar Wallet",
      `<p class="section-hint">Choose a wallet. You'll approve one payment of ${escapeHtml(option.amountInFormatted)} XLM.</p>
       <div class="item-list" id="kwespay-cc-wallet-list"><div class="kp-cc-loading">Detecting wallets…</div></div>`,
      { back: () => { this._removeCustomStep("kwespay-step-cc-wallets"); this._goToStep("cc-method"); } }
    );
    let wallets = [];
    try {
      wallets = await this.stellarWalletService.discoverWallets(STELLAR_PUBLIC);
    } catch {}
    const list = step.querySelector("#kwespay-cc-wallet-list");
    if (!list) return;
    list.innerHTML = "";
    wallets.filter((w) => w.isAvailable).slice(0, 5).forEach((wallet) => {
      const item = document.createElement("button");
      item.type = "button";
      item.className = "list-item kp-cc-option";
      item.innerHTML = `
        <div class="item-icon">${wallet.icon ? `<img src="${safeImageUrl(wallet.icon)}" alt="${escapeHtml(wallet.name)}" style="width:22px;height:22px;object-fit:contain;border-radius:6px">` : icon("account_balance_wallet", "", "font-size:18px;color:var(--kp-accent)")}</div>
        <div class="item-info"><div class="item-name-row"><p class="item-name">${escapeHtml(wallet.name)}</p></div><p class="item-desc">Tap to connect</p></div>
        ${icon("chevron_right", "item-chevron")}
      `;
      item.addEventListener("click", async () => {
        try {
          this._activeStellarTransport = null;
          const connection = await this.stellarWalletService.connect(wallet.id);
          await this._ccPayWithWallet(option, connection.address);
        } catch (err) {
          if (err?.code === "USER_CANCELLED") return;
          this._showError("Connection Failed", err?.message ?? "Couldn't connect the wallet.");
        }
      });
      list.appendChild(item);
    });
    if (this.config?.projectId) {
      const wc = document.createElement("button");
      wc.type = "button";
      wc.className = "list-item kp-cc-option";
      wc.innerHTML = `
        <div class="item-icon">${icon("qr_code_2", "", "font-size:18px;color:var(--kp-accent)")}</div>
        <div class="item-info"><div class="item-name-row"><p class="item-name">LOBSTR / WalletConnect</p></div><p class="item-desc">Scan with your Stellar wallet app</p></div>
        ${icon("chevron_right", "item-chevron")}
      `;
      wc.addEventListener("click", () => this._ccStellarWalletConnect(option));
      list.appendChild(wc);
    }
    if (!list.children.length) {
      list.innerHTML = `<div class="kp-cc-loading">No Stellar wallets found in this browser. Go back and choose "Send from an exchange or another app".</div>`;
    }
  },

  async _ccStellarWalletConnect(option) {
    await this._renderWalletConnectStep({
      title: "Connect Stellar Wallet",
      steps: [
        "Tap the QR scanner icon inside the app",
        "Scan the code shown below",
        "On your phone instead? Tap **Copy link** and paste it into your wallet app",
      ],
      mobileWallets: [],
      backToStep: "cc-wallets",
      start: async (onUri) => {
        await ensureBuffer();
        const { default: StellarMobileTransport } = await import("../../services/StellarMobileTransport.js");
        const transport = StellarMobileTransport.get(this.config.projectId);
        if (transport.isConnected()) await transport.disconnect().catch(() => {});
        this._pendingStellarTransport = transport;
        return transport.connect({ chainId: "stellar:mainnet", onUri });
      },
      onConnected: async (connection) => {
        this._activeStellarTransport = this._pendingStellarTransport;
        this._pendingStellarTransport = null;
        this._removeCustomStep("kwespay-step-walletconnect");
        await this._ccPayWithWallet(option, connection.address);
      },
    });
  },

  async _ccCreateRoute(option, refundAddress) {
    const attempt = () =>
      this.paymentService.payFromAnotherAsset({
        quoteId: this.state.ccQuote.quoteId,
        originAsset: option.originAsset,
        refundAddress,
      });
    try {
      return await attempt();
    } catch (err) {
      if (!["QUOTE_EXPIRED", "QUOTE_USED"].includes(err?.code)) throw err;
      const destination = this.state.ccDestination;
      this.state.ccQuote = await this.paymentService.getQuote({
        vendorId: this.config.vendorId,
        cryptoCurrency: destination.token,
        fiatAmount: this.config.amount,
        fiatCurrency: this.config.currency,
        network: destination.network,
        orderId: this.config.orderId,
      });
      return attempt();
    }
  },

  async _ccPayWithWallet(option, address) {
    let route;
    try {
      route = await this._ccCreateRoute(option, address);
    } catch (err) {
      this._showError("Payment Unavailable", err?.message ?? "We couldn't start this payment. Please try again.");
      return;
    }
    this._showCrossChainDeposit(route, { wallet: true });
    await this._ccSendFromWallet(route);
  },

  async _ccSendFromWallet(route) {
    const banner = document.getElementById("kwespay-cc-wallet-status");
    const setBanner = (title, detail, tone = "") => {
      if (!banner) return;
      banner.className = `kp-cc-wallet-status ${tone}`;
      banner.innerHTML = `<strong>${escapeHtml(title)}</strong><span>${escapeHtml(detail)}</span>`;
    };
    try {
      await this.paymentService.sendCrossChainDeposit({
        route,
        wallet: this._getStellarAdapter(),
        onStatus: (title, detail) => setBanner(title, detail),
      });
      setBanner("Payment sent", `Waiting for your ${route.originAsset} to arrive.`, "is-ok");
      this._ccRenderProgress({ ...route, status: "deposit_seen" });
    } catch (err) {
      const cancelled = err?.code === "WALLET_REJECTED";
      setBanner(cancelled ? "Payment cancelled" : "Couldn't send from the wallet", err?.message ?? "Please try again.", "is-error");
      if (banner) {
        const retry = document.createElement("button");
        retry.type = "button";
        retry.className = "kp-cc-copy";
        retry.textContent = "Try again";
        retry.addEventListener("click", () => this._ccSendFromWallet(route));
        banner.appendChild(retry);
      }
    }
  },

  _openCrossChainRefund(option) {
    const chain = option.chainName;
    const step = this._ccStep(
      "kwespay-step-cc-refund",
      `Pay with ${option.originAsset}`,
      `
        <div class="kp-cc-summary">
          <span>You'll send about</span>
          <strong>${escapeHtml(option.amountInFormatted)} ${escapeHtml(option.originAsset)}</strong>
        </div>
        <div class="kp-field">
          <label class="kp-field-label" for="kwespay-cc-refund"><span>Your ${escapeHtml(chain)} address for refunds</span></label>
          <input class="kp-input" id="kwespay-cc-refund" type="text" autocomplete="off" autocapitalize="off" spellcheck="false" maxlength="128"
            placeholder="${option.chain === "stellar" ? "G…" : "bc1… or 1…"}" />
          <p class="kp-field-error" id="kwespay-cc-refund-error" role="alert"></p>
          <p class="kp-field-help">If the payment can't be completed, your ${escapeHtml(option.originAsset)} is returned here. Use an address you control, not an exchange deposit address.</p>
        </div>
      `,
      {
        back: () => { this._removeCustomStep("kwespay-step-cc-refund"); this._goToStep("cc-assets"); },
        footer: `<div class="bottom-action"><button class="action-btn" id="kwespay-cc-start" disabled>Get payment details</button></div>`,
      }
    );

    const input = step.querySelector("#kwespay-cc-refund");
    const error = step.querySelector("#kwespay-cc-refund-error");
    const button = step.querySelector("#kwespay-cc-start");
    const pattern = REFUND_PATTERNS[option.chain];
    const check = () => {
      const value = input.value.trim();
      const ok = pattern ? pattern.test(value) : value.length > 0;
      button.disabled = !ok;
      input.removeAttribute("aria-invalid");
      error.textContent = "";
      return ok;
    };
    input.addEventListener("input", check);
    input.addEventListener("blur", () => {
      if (input.value.trim() && !check()) {
        input.setAttribute("aria-invalid", "true");
        error.textContent = `Enter a valid ${chain} address.`;
      }
    });
    button.addEventListener("click", () => this._startCrossChainPayment(option, input.value.trim(), { input, error, button }));
    setTimeout(() => input.focus(), 50);
  },

  async _startCrossChainPayment(option, refundAddress, ui) {
    ui.button.disabled = true;
    ui.button.textContent = "Preparing…";
    try {
      const route = await this._ccCreateRoute(option, refundAddress);
      this._showCrossChainDeposit(route);
    } catch (err) {
      ui.button.disabled = false;
      ui.button.textContent = "Get payment details";
      if (["INVALID_REFUND_ADDRESS", "AMOUNT_BELOW_MINIMUM"].includes(err?.code)) {
        ui.input.setAttribute("aria-invalid", "true");
        ui.error.textContent = err.message;
        return;
      }
      this._showError("Payment Unavailable", err?.message ?? "We couldn't start this payment. Please try again.");
    }
  },

  _showCrossChainDeposit(route, { wallet = false } = {}) {
    this._ccStopPolling();
    this.state.ccRoute = route;
    const memo = route.depositMemo;
    const step = this._ccStep(
      "kwespay-step-cc-deposit",
      `Send ${route.originAsset}`,
      `
        <ol class="kp-steps kp-cc-progress" id="kwespay-cc-progress">
          ${PROGRESS.map((p, i) => `<li data-stage="${p.key}"><span class="kp-step-num">${i + 1}</span><span class="kp-step-text">${p.label}</span></li>`).join("")}
        </ol>
        ${wallet ? `<div class="kp-cc-wallet-status" id="kwespay-cc-wallet-status"><strong>Opening your wallet</strong><span>Approve the payment to send it.</span></div>` : ""}
        <div class="kp-cc-deposit${wallet ? " is-wallet" : ""}" id="kwespay-cc-deposit">
          <div class="kp-cc-field">
            <span class="kp-cc-label">Amount</span>
            <div class="kp-cc-value-row">
              <span class="kp-cc-value strong">${escapeHtml(route.amountInFormatted)} ${escapeHtml(route.originAsset)}</span>
              <button type="button" class="kp-cc-copy" data-copy="${escapeHtml(route.amountInFormatted)}">Copy</button>
            </div>
          </div>
          <div class="kp-cc-field">
            <span class="kp-cc-label">To address</span>
            <div class="kp-cc-value-row">
              <span class="kp-cc-value mono">${escapeHtml(route.depositAddress)}</span>
              <button type="button" class="kp-cc-copy" data-copy="${escapeHtml(route.depositAddress)}">Copy</button>
            </div>
          </div>
          ${memo ? `
          <div class="kp-cc-field kp-cc-memo">
            <span class="kp-cc-label">Memo (required)</span>
            <div class="kp-cc-value-row">
              <span class="kp-cc-value strong mono">${escapeHtml(memo)}</span>
              <button type="button" class="kp-cc-copy" data-copy="${escapeHtml(memo)}">Copy</button>
            </div>
            <p class="kp-cc-memo-note">Add this memo to your transfer. Without it, your payment can't be matched to this order.</p>
          </div>` : ""}
          <div class="kp-cc-qr-wrap"><div class="kp-cc-qr" id="kwespay-cc-qr"></div><span>Or scan with your wallet app</span></div>
          <p class="kp-cc-note">Send the exact amount in one transfer. If anything goes wrong, it's returned to ${escapeHtml(truncateAddress(route.refundAddress, 6, 6))}.</p>
          <div class="kp-quote-timer" id="kwespay-cc-timer">${icon("schedule")}<span id="kwespay-cc-timer-text">—</span></div>
        </div>
        <div class="kp-cc-status" id="kwespay-cc-status" hidden>
          <div class="spinner-wrapper"><div class="spinner-ring"></div><div class="spinner-ring-2"></div><div class="spinner-icon">${icon("cloud_sync")}</div></div>
          <h2 class="headline" id="kwespay-cc-status-title">Payment received</h2>
          <p class="body-text" id="kwespay-cc-status-text">Converting to ${escapeHtml(route.token)}.</p>
        </div>
      `,
      {
        back: () => { this._ccStopPolling(); this._ccRemoveSteps(); this._goToStep(1); },
      }
    );

    step.querySelectorAll("[data-copy]").forEach((b) => b.addEventListener("click", () => copyText(b.dataset.copy, b)));
    renderQr(step.querySelector("#kwespay-cc-qr"), paymentUri(route));
    this._ccStartTimer(route);
    this._ccRenderProgress(route);
    dispatchWidgetEvent("crossChainDepositReady", {
      transactionReference: route.transactionReference,
      originAsset: route.originAsset,
      amount: route.amountInFormatted,
    });
    this._ccPoll(route.transactionReference);
  },

  _ccStartTimer(route) {
    const text = document.getElementById("kwespay-cc-timer-text");
    const deadline = Date.parse(route.deadline);
    const tick = () => {
      if (!text) return;
      const left = Math.max(0, deadline - Date.now());
      const mins = Math.floor(left / 60000);
      const secs = Math.floor((left % 60000) / 1000);
      text.textContent = left > 0 ? `Send within ${mins}:${String(secs).padStart(2, "0")}` : "Time's up. If you already sent it, keep this window open.";
    };
    tick();
    this._ccTimer = setInterval(tick, 1000);
  },

  _ccRenderProgress(route) {
    const stage = stageOf(route);
    const order = PROGRESS.map((p) => p.key);
    const current = order.indexOf(stage);
    document.querySelectorAll("#kwespay-cc-progress li").forEach((li) => {
      const index = order.indexOf(li.dataset.stage);
      li.classList.toggle("is-done", index < current);
      li.classList.toggle("is-active", index === current);
    });
    if (stage !== "deposit") {
      const deposit = document.getElementById("kwespay-cc-deposit");
      const status = document.getElementById("kwespay-cc-status");
      if (deposit) deposit.hidden = true;
      if (status) status.hidden = false;
      document.querySelector("#kwespay-step-cc-deposit [data-cc-back]")?.remove();
      const title = document.getElementById("kwespay-cc-status-title");
      const text = document.getElementById("kwespay-cc-status-text");
      if (route.status === "incomplete") {
        if (title) title.textContent = "Deposit too small";
        if (text) text.textContent = `Less than ${route.amountInFormatted} ${route.originAsset} arrived. It will be returned to your address.`;
      } else if (route.status === "delivered") {
        if (title) title.textContent = "Confirming payment";
        if (text) text.textContent = `Verifying the ${route.token} payment to the merchant.`;
      } else {
        if (title) title.textContent = "Payment received";
        if (text) text.textContent = `Converting your ${route.originAsset} to ${route.token}. This takes ${formatEta(route.timeEstimateSeconds) || "a few minutes"}.`;
      }
    }
  },

  _ccPoll(reference) {
    const token = {};
    this._ccPollToken = token;
    let announced = false;
    const loop = async () => {
      if (this._ccPollToken !== token) return;
      try {
        const route = await this.paymentService.getPaymentRoute(reference);
        if (this._ccPollToken !== token) return;
        this.state.ccRoute = route;
        if (!announced && stageOf(route) !== "deposit") {
          announced = true;
          this._broadcastPayment = this._ccPayload(route, "pending");
          dispatchWidgetEvent("paymentSuccess", this._broadcastPayment);
          this.config.onPaymentSuccess?.(this._broadcastPayment);
        }
        this._ccRenderProgress(route);
        if (stageOf(route) === "paid") return this._ccComplete(route);
        if (["refunded", "expired"].includes(route.status)) return this._ccEnded(route);
      } catch {}
      setTimeout(loop, POLL_MS);
    };
    setTimeout(loop, POLL_MS);
  },

  _ccPayload(route, status) {
    return {
      transactionReference: route.transactionReference,
      transactionHash: route.destinationTransaction?.hash ?? null,
      paymentIdBytes32: null,
      transactionStatus: status,
      fiatAmount: this.config.amount,
      currency: this.config.currency,
      token: route.token,
      network: route.network,
      paidWith: { asset: route.originAsset, amount: route.amountInFormatted, transactions: route.originTransactions },
    };
  },

  _ccComplete(route) {
    this._ccStopPolling();
    const setEl = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.textContent = val;
    };
    const hash = route.destinationTransaction?.hash ?? "";
    const destinationName = this._networkConfig(route.network)?.name ?? route.network;
    setEl("kwespay-txHash", truncateHash(hash));
    setEl("kwespay-txRef", route.transactionReference);
    setEl("kwespay-txFiatAmount", `${this._displayAmount} ${this.config.currency}`);
    setEl("kwespay-txCryptoAmount", `${route.amountInFormatted} ${route.originAsset}`);
    setEl("kwespay-txNetwork", `${route.originAsset} → ${route.token} on ${destinationName}`);
    const now = new Date();
    setEl("kwespay-txTime", `${now.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })} · ${now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`);
    const link = document.getElementById("kwespay-explorerLink");
    if (link) link.href = route.destinationTransaction?.explorerUrl ?? ((this._networkConfig(route.network)?.explorer ?? "") + hash);
    this._ccRemoveSteps();
    this._goToStep(4);
    this._setProcessingView("success");
    this._startReceiptCountdown(10_000);
    this._finalisePayment(this._ccPayload(route, route.transactionStatus), false);
  },

  _ccEnded(route) {
    this._ccStopPolling();
    const refunded = route.status === "refunded";
    this._removeCustomStep("kwespay-step-outcome");
    const container = document.getElementById("kwespay-widget-container");
    const step = document.createElement("div");
    step.className = "step";
    step.id = "kwespay-step-outcome";
    step.innerHTML = `
      <div class="kp-topbar"><div class="kp-topbar-brand"><span class="kp-topbar-name">${refunded ? "Payment Refunded" : "Payment Window Closed"}</span></div></div>
      <div class="loading-container" style="flex:1">
        <div class="error-icon" style="color:var(--kp-muted)">${icon("info")}</div>
        <h2 class="headline">${refunded ? "Your payment was returned" : "No payment arrived in time"}</h2>
        <p class="body-text">${escapeHtml(refunded
          ? `${route.refundedAmount ? `${route.refundedAmount} ${route.originAsset}` : `Your ${route.originAsset}`} was sent back to ${truncateAddress(route.refundAddress, 6, 6)}.${route.refundReason ? ` ${route.refundReason}.` : ""}`
          : "If you sent a payment, contact the merchant with your reference before paying again.")}</p>
        <div class="tx-details"><div class="tx-row"><span class="tx-label">Reference</span><span class="tx-value">${escapeHtml(route.transactionReference)}</span></div></div>
      </div>
      <div class="bottom-action"><button class="action-btn" data-outcome-close>Close</button></div>
    `;
    step.querySelector("[data-outcome-close]").addEventListener("click", () => this.close());
    container.appendChild(step);
    this._ccRemoveSteps();
    this._goToStep("outcome");
    this._finalisePayment(this._ccPayload(route, route.transactionStatus), false);
  },
};
