import { dispatchWidgetEvent, escapeHtml, safeImageUrl, truncateAddress, truncateHash } from "../../utils/helpers.js";
import { icon } from "../../ui/icons.js";
import StellarWalletService from "../../services/StellarWalletService.js";
import { ensureBuffer } from "../../utils/nodeGlobals.js";

const STELLAR_PUBLIC = "Public Global Stellar Network ; September 2015";

const OPTIONS_TTL_MS = 45_000;
const ENTRY_LOGOS = [
  { url: "https://coin-images.coingecko.com/coins/images/325/small/Tether.png", fallback: "U" },
  { url: "https://coin-images.coingecko.com/coins/images/279/small/ethereum.png", fallback: "E" },
  { url: "https://coin-images.coingecko.com/coins/images/4128/small/solana.png", fallback: "S" },
];
const POPULAR_SYMBOLS = ["USDT", "USDC", "ETH", "BTC", "SOL", "BNB", "XRP", "TRX", "DOGE", "TON", "SUI", "XLM", "NEAR", "AVAX", "POL", "ADA", "LTC", "BCH"];
const POPULAR_CHAINS = ["Ethereum", "Tron", "Solana", "Base", "Arbitrum", "BNB Chain", "Polygon", "Optimism"];
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

function ccSymbol(asset) {
  return String(asset ?? "").split(":")[0];
}

function ccLabel(option) {
  return option.originAsset.includes(":") ? option.name : option.originAsset;
}

function formatEstimate(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return String(value ?? "");
  return new Intl.NumberFormat("en-US", { maximumSignificantDigits: 6 }).format(amount);
}

function popularity(list, value) {
  const index = list.indexOf(value);
  return index === -1 ? list.length : index;
}

function buildSearchEntries(options) {
  return options
    .map((option) => {
      const symbol = ccSymbol(ccLabel(option)).toLowerCase().replace(/^\$/, "");
      return {
        option,
        label: ccLabel(option),
        symbol,
        name: String(option.name ?? "").toLowerCase(),
        chain: String(option.chainName ?? "").toLowerCase(),
        chainKey: String(option.chain ?? "").toLowerCase(),
        order: [
          option.available ? 0 : 1,
          popularity(POPULAR_SYMBOLS, symbol.toUpperCase()),
          String(option.chain ?? "").toLowerCase() === symbol ? 0 : 1,
          popularity(POPULAR_CHAINS, option.chainName),
          symbol,
        ],
      };
    })
    .sort((a, b) => {
      for (let i = 0; i < a.order.length; i += 1) {
        if (a.order[i] < b.order[i]) return -1;
        if (a.order[i] > b.order[i]) return 1;
      }
      return 0;
    });
}

function matchScore(entry, terms) {
  let total = 0;
  for (const term of terms) {
    let score = -1;
    if (entry.symbol === term) score = 0;
    else if (entry.symbol.startsWith(term)) score = 1;
    else if (entry.chain === term || entry.chainKey === term) score = 2;
    else if (entry.chain.startsWith(term)) score = 3;
    else if (entry.name.startsWith(term)) score = 4;
    else if (entry.symbol.includes(term) || entry.name.includes(term) || entry.chain.includes(term)) score = 5;
    if (score === -1) return -1;
    total += score;
  }
  return total;
}

function searchTerms(value) {
  return value.trim().toLowerCase().replace(/\$/g, "").split(/\s+/).filter((term) => term && term !== "on");
}

function formatEta(seconds) {
  if (!seconds) return "";
  if (seconds < 90) return `about ${Math.max(10, Math.round(seconds / 10) * 10)} sec`;
  return `about ${Math.round(seconds / 60)} min`;
}

function paymentUri(route) {
  if (route.originAsset === "XLM") {
    const params = new URLSearchParams({ destination: route.depositAddress, amount: route.amountInFormatted });
    if (route.depositMemo) {
      params.set("memo", route.depositMemo);
      params.set("memo_type", "MEMO_ID");
    }
    return `web+stellar:pay?${params.toString()}`;
  }
  if (route.originAsset === "BTC") return `bitcoin:${route.depositAddress}?amount=${route.amountInFormatted}`;
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
      const token = STABLE_PREFERENCE.find((t) => accepted.includes(t)) ?? accepted[0];
      if (token) return { network, token, config: this._networkConfig(network) };
    }
    return null;
  },

  _renderCrossChainEntry() {
    document.getElementById("kwespay-cc-section")?.remove();
    const destination = this._crossChainDestination();
    const hint = document.getElementById("kwespay-step1-hint");
    if (hint) hint.textContent = destination ? "Choose a network, or pay with what you have" : "Select a network to continue";
    if (!destination) return;

    const mainnetList = document.getElementById("kwespay-mainnetList");
    if (!mainnetList) return;
    const section = document.createElement("div");
    section.id = "kwespay-cc-section";
    section.className = "kp-cc-section";
    section.innerHTML = `
      <div class="kp-section-divider">Don't hold these tokens?</div>
      <button type="button" class="list-item kp-cc-entry" id="kwespay-cc-entry">
        <div class="item-info">
          <div class="item-name-row"><p class="item-name">Pay with what you have</p></div>
          <p class="item-desc">Any coin, any chain. We handle the conversion.</p>
        </div>
        <div class="kp-cc-stack" aria-hidden="true">
          ${ENTRY_LOGOS.map((logo) => `<img src="${safeImageUrl(logo.url)}" alt="" width="26" height="26" data-kp-fallback="${logo.fallback}" />`).join("")}
        </div>
        ${icon("chevron_right", "item-chevron")}
      </button>
    `;
    mainnetList.insertAdjacentElement("afterend", section);
    const entry = section.querySelector("#kwespay-cc-entry");
    const warm = () => this._ccLoadOptions(destination).catch(() => {});
    entry.addEventListener("pointerenter", warm, { once: true });
    entry.addEventListener("touchstart", warm, { once: true, passive: true });
    entry.addEventListener("focus", warm, { once: true });
    entry.addEventListener("click", () => this._openCrossChainAssets());
  },

  _ccRemoveSteps() {
    STEP_IDS.forEach((id) => this._removeCustomStep(id));
  },

  _ccStopPolling() {
    this._ccPollToken = null;
    if (this._ccTimer) clearInterval(this._ccTimer);
    this._ccTimer = null;
  },

  _ccStep(id, title, body, { back = null, footer = "", header = "" } = {}) {
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
      ${header}
      <div class="content-scroll">${body}</div>
      ${footer}
    `;
    container.appendChild(step);
    if (back) step.querySelector("[data-cc-back]").addEventListener("click", back);
    this._goToStep(id.replace("kwespay-step-", ""));
    return step;
  },

  _ccLoadOptions(destination) {
    const key = [destination.network, destination.token, this.config.amount, this.config.currency].join("|");
    const cached = this._ccOptionsCache;
    if (cached && cached.key === key && Date.now() - cached.at < OPTIONS_TTL_MS) return cached.promise;
    const promise = (async () => {
      const quote = await this.paymentService.getQuote({
        vendorId: this.config.vendorId,
        cryptoCurrency: destination.token,
        fiatAmount: this.config.amount,
        fiatCurrency: this.config.currency,
        network: destination.network,
        orderId: this.config.orderId,
      });
      const { options } = await this.paymentService.getCrossChainOptions({ quote });
      return { quote, options };
    })();
    const entry = { key, at: Date.now(), promise };
    this._ccOptionsCache = entry;
    promise.catch(() => {
      if (this._ccOptionsCache === entry) this._ccOptionsCache = null;
    });
    return promise;
  },

  async _openCrossChainAssets() {
    const destination = this._crossChainDestination();
    if (!destination) return;
    this.state.ccDestination = destination;

    const step = this._ccStep(
      "kwespay-step-cc-assets",
      "Pay with what you have",
      `
        <div class="item-list kp-cc-token-list" id="kwespay-cc-options" role="listbox" aria-label="Tokens" aria-busy="true">
          ${'<div class="kp-cc-skeleton"></div>'.repeat(7)}
        </div>
        <p class="kp-cc-results" id="kwespay-cc-results" aria-live="polite"></p>
      `,
      {
        back: () => { this._ccRemoveSteps(); this._goToStep(1); },
        header: `
          <div class="kp-cc-search">
            <div class="kp-cc-search-box">
              ${icon("search", "kp-cc-search-icon")}
              <input id="kwespay-cc-search" class="kp-cc-search-input" type="text" inputmode="search" enterkeyhint="search"
                placeholder="Search any coin or chain" aria-label="Search any coin or chain" role="combobox" aria-expanded="true"
                aria-controls="kwespay-cc-options" aria-autocomplete="list" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" />
              <button type="button" class="kp-cc-search-clear" id="kwespay-cc-search-clear" hidden>Clear</button>
            </div>
          </div>
        `,
      }
    );

    if (window.matchMedia?.("(hover: hover) and (pointer: fine)").matches) {
      step.querySelector("#kwespay-cc-search")?.focus({ preventScroll: true });
    }
    await this._ccFillOptions(step, destination);
  },

  async _ccFillOptions(step, destination) {
    const list = step.querySelector("#kwespay-cc-options");
    try {
      const { quote, options } = await this._ccLoadOptions(destination);
      if (!step.isConnected) return;
      this.state.ccQuote = quote;
      list?.removeAttribute("aria-busy");
      this._renderCrossChainOptions(step, options);
    } catch (err) {
      if (!step.isConnected || !list) return;
      list.removeAttribute("aria-busy");
      list.innerHTML = `
        <div class="kp-cc-loading">
          <p>${escapeHtml(err?.message ?? "Prices are unavailable right now.")}</p>
          <button type="button" class="kp-cc-copy" id="kwespay-cc-retry">Try again</button>
        </div>
      `;
      list.querySelector("#kwespay-cc-retry")?.addEventListener("click", () => {
        list.setAttribute("aria-busy", "true");
        list.innerHTML = '<div class="kp-cc-skeleton"></div>'.repeat(7);
        this._ccFillOptions(step, destination);
      });
    }
  },

  _ccOptionRow(entry, index) {
    const { option, label } = entry;
    const row = document.createElement("button");
    row.type = "button";
    row.id = `kwespay-cc-option-${index}`;
    row.setAttribute("role", "option");
    row.setAttribute("aria-selected", "false");
    row.tabIndex = -1;
    row.dataset.index = String(index);
    row.className = "list-item kp-cc-option kp-cc-token" + (option.available ? "" : " is-disabled");
    row.disabled = !option.available;
    const detail = option.available
      ? option.chainName
      : option.code === "AMOUNT_BELOW_MINIMUM"
        ? `${option.chainName} · from $${option.minimumUsd}`
        : `${option.chainName} · unavailable`;
    const symbol = ccSymbol(label).replace(/^\$/, "");
    const logoUrl = safeImageUrl(option.logoUrl);
    const chainLogoUrl = safeImageUrl(option.chainLogoUrl);
    row.innerHTML = `
      <div class="kp-cc-mark" aria-hidden="true">
        ${logoUrl
          ? `<img class="kp-cc-coin" src="${logoUrl}" alt="" width="36" height="36" loading="lazy" decoding="async" data-kp-fallback="${escapeHtml(symbol.charAt(0).toUpperCase())}" />`
          : `<span class="kp-logo-fallback">${escapeHtml(symbol.charAt(0).toUpperCase())}</span>`}
        ${chainLogoUrl ? `<img class="kp-cc-chain" src="${chainLogoUrl}" alt="" width="16" height="16" loading="lazy" decoding="async" />` : ""}
      </div>
      <div class="item-info">
        <p class="item-name">${escapeHtml(label)}</p>
        <p class="item-desc">${escapeHtml(detail)}</p>
      </div>
      ${option.available ? `<div class="kp-cc-price">${escapeHtml(formatEstimate(option.amountInFormatted))} ${escapeHtml(ccSymbol(label))}</div>` : ""}
    `;
    return row;
  },

  _ccSelectOption(option) {
    if (option.originAsset === "XLM") this._openCrossChainMethod(option);
    else this._openCrossChainRefund(option);
  },

  _renderCrossChainOptions(step, options) {
    const list = step.querySelector("#kwespay-cc-options");
    const input = step.querySelector("#kwespay-cc-search");
    const clear = step.querySelector("#kwespay-cc-search-clear");
    const results = step.querySelector("#kwespay-cc-results");
    const scroller = step.querySelector(".content-scroll");
    if (!list || !input) return;
    if (!options.length) {
      list.innerHTML = `<div class="kp-cc-loading">Paying from another chain isn't available for this payment.</div>`;
      return;
    }

    const entries = buildSearchEntries(options);
    entries.forEach((entry, index) => {
      entry.el = this._ccOptionRow(entry, index);
    });
    const empty = document.createElement("div");
    empty.className = "kp-cc-loading";

    let visible = entries;
    let active = -1;
    let frame = 0;

    const setActive = (next, reveal = true) => {
      if (visible[active]?.el) {
        visible[active].el.classList.remove("is-active");
        visible[active].el.setAttribute("aria-selected", "false");
      }
      active = next;
      const target = visible[active]?.el;
      if (!target) {
        input.removeAttribute("aria-activedescendant");
        return;
      }
      target.classList.add("is-active");
      target.setAttribute("aria-selected", "true");
      input.setAttribute("aria-activedescendant", target.id);
      if (reveal) target.scrollIntoView({ block: "nearest" });
    };

    const apply = () => {
      frame = 0;
      const value = input.value;
      const terms = searchTerms(value);
      visible = terms.length
        ? entries
            .map((entry, index) => ({ entry, index, score: matchScore(entry, terms) }))
            .filter((match) => match.score !== -1)
            .sort((a, b) => Number(a.entry.option.available === false) - Number(b.entry.option.available === false) || a.score - b.score || a.index - b.index)
            .map((match) => match.entry)
        : entries;
      entries.forEach((entry) => {
        entry.el.classList.remove("is-active");
        entry.el.setAttribute("aria-selected", "false");
      });
      active = -1;
      input.removeAttribute("aria-activedescendant");
      if (visible.length) {
        list.replaceChildren(...visible.map((entry) => entry.el));
      } else {
        empty.textContent = `Nothing found for "${value.trim()}". Try a coin or chain name.`;
        list.replaceChildren(empty);
      }
      if (scroller) scroller.scrollTop = 0;
      if (clear) clear.hidden = !value;
      if (results) results.textContent = visible.length === 1 ? "1 token" : `${visible.length} tokens`;
      if (terms.length && visible[0]?.option.available) setActive(0, false);
    };

    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(apply);
    };

    const move = (direction) => {
      if (!visible.length) return;
      let next = active;
      for (let i = 0; i < visible.length; i += 1) {
        next = next + direction;
        if (next < 0) next = visible.length - 1;
        if (next >= visible.length) next = 0;
        if (visible[next].option.available) {
          setActive(next);
          return;
        }
      }
    };

    input.addEventListener("input", schedule);
    input.addEventListener("keydown", (event) => {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        move(1);
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        move(-1);
      } else if (event.key === "Enter") {
        event.preventDefault();
        const chosen = visible[active];
        if (chosen?.option.available) this._ccSelectOption(chosen.option);
      } else if (event.key === "Escape" && input.value) {
        event.preventDefault();
        event.stopPropagation();
        input.value = "";
        apply();
      }
    });
    clear?.addEventListener("click", () => {
      input.value = "";
      apply();
      input.focus({ preventScroll: true });
    });
    list.addEventListener("click", (event) => {
      const row = event.target.closest("[data-index]");
      if (!row || row.disabled) return;
      this._ccSelectOption(entries[Number(row.dataset.index)].option);
    });
    apply();
  },

  _openCrossChainMethod(option) {
    const step = this._ccStep(
      "kwespay-step-cc-method",
      `Pay with ${ccLabel(option)}`,
      `
        <div class="kp-cc-summary">
          <span>You'll send about</span>
          <strong>${escapeHtml(formatEstimate(option.amountInFormatted))} ${escapeHtml(ccSymbol(ccLabel(option)))}</strong>
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
    this._ccOptionsCache = null;
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
      setBanner("Payment sent", `Waiting for your ${ccSymbol(route.originAsset)} to arrive.`, "is-ok");
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
      `Pay with ${ccLabel(option)}`,
      `
        <div class="kp-cc-summary">
          <span>You'll send about</span>
          <strong>${escapeHtml(formatEstimate(option.amountInFormatted))} ${escapeHtml(ccSymbol(ccLabel(option)))}</strong>
        </div>
        <div class="kp-field">
          <label class="kp-field-label" for="kwespay-cc-refund"><span>Your ${escapeHtml(chain)} address for refunds</span></label>
          <input class="kp-input" id="kwespay-cc-refund" type="text" autocomplete="off" autocapitalize="off" spellcheck="false" maxlength="128"
            placeholder="Paste your ${escapeHtml(chain)} address" />
          <p class="kp-field-error" id="kwespay-cc-refund-error" role="alert"></p>
          <p class="kp-field-help">If the payment can't be completed, your ${escapeHtml(ccSymbol(ccLabel(option)))} is returned here. Use an address you control, not an exchange deposit address.</p>
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
      `Send ${ccSymbol(route.originAsset)}`,
      `
        <ol class="kp-steps kp-cc-progress" id="kwespay-cc-progress">
          ${PROGRESS.map((p, i) => `<li data-stage="${p.key}"><span class="kp-step-num">${i + 1}</span><span class="kp-step-text">${p.label}</span></li>`).join("")}
        </ol>
        ${wallet ? `<div class="kp-cc-wallet-status" id="kwespay-cc-wallet-status"><strong>Opening your wallet</strong><span>Approve the payment to send it.</span></div>` : ""}
        <div class="kp-cc-deposit${wallet ? " is-wallet" : ""}" id="kwespay-cc-deposit">
          <div class="kp-cc-field">
            <span class="kp-cc-label">Amount</span>
            <div class="kp-cc-value-row">
              <span class="kp-cc-value strong">${escapeHtml(route.amountInFormatted)} ${escapeHtml(ccSymbol(route.originAsset))}</span>
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
        if (text) text.textContent = `Less than ${route.amountInFormatted} ${ccSymbol(route.originAsset)} arrived. It will be returned to your address.`;
      } else if (route.status === "delivered") {
        if (title) title.textContent = "Confirming payment";
        if (text) text.textContent = `Verifying the ${route.token} payment to the merchant.`;
      } else {
        if (title) title.textContent = "Payment received";
        if (text) text.textContent = `Converting your ${ccSymbol(route.originAsset)} to ${route.token}. This takes ${formatEta(route.timeEstimateSeconds) || "a few minutes"}.`;
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
      paidWith: { asset: ccSymbol(route.originAsset), chain: route.originChain, amount: route.amountInFormatted, transactions: route.originTransactions },
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
    setEl("kwespay-txCryptoAmount", `${route.amountInFormatted} ${ccSymbol(route.originAsset)}`);
    setEl("kwespay-txNetwork", `${ccSymbol(route.originAsset)} → ${route.token} on ${destinationName}`);
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
          ? `${route.refundedAmount ? `${route.refundedAmount} ${ccSymbol(route.originAsset)}` : `Your ${ccSymbol(route.originAsset)}`} was sent back to ${truncateAddress(route.refundAddress, 6, 6)}.${route.refundReason ? ` ${route.refundReason}.` : ""}`
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
