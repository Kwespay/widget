import {
  dispatchWidgetEvent,
  isMobileDevice,
  getErrorMessage,
  escapeHtml,
  safeImageUrl,
} from "../../utils/helpers.js";
import SuiWalletService from "../../services/Suiwalletservice.js";
import { ensureBuffer } from "../../utils/nodeGlobals.js";
import { icon } from "../../ui/icons.js";

export const SuiWalletMethods = {
  async _handleSuiWalletConnection() {
    if (!this.suiWalletService) {
      this.suiWalletService = new SuiWalletService();
    }

    if (isMobileDevice()) {
      this._renderSuiMobilePicker();
      return;
    }

    await this.suiWalletService.ensureSlushWebWallet(
      this.config?.appName || this.config?.vendorName || document.title
    );
    this._renderSuiWalletPickerStep();
  },

  _renderSuiWalletPickerStep() {
    if (isMobileDevice()) {
      return this._renderSuiMobilePicker();
    }

    this._removeCustomStep("kwespay-step-sui-picker");

    const container = document.getElementById("kwespay-widget-container");
    const step = document.createElement("div");
    step.className = "step";
    step.id = "kwespay-step-sui-picker";

    const knownWallets = this.suiWalletService.getKnownExtensionWallets();

    const skeletonRows = knownWallets
      .map(
        (w, i) => `
        <div class="list-item kp-sui-known-wallet" data-known-index="${i}" style="opacity:0.45;pointer-events:none">
          <div class="item-icon">
            <img src="${safeImageUrl(w.icon)}" alt="${escapeHtml(w.name)}" style="width:22px;height:22px;object-fit:contain;border-radius:6px">
          </div>
          <div class="item-info">
            <div class="item-name-row"><p class="item-name">${escapeHtml(w.name)}</p></div>
            <p class="item-desc kp-sui-wallet-status-${i}" style="font-family:var(--kp-mono);font-size:10px;color:var(--kp-muted)">Detecting…</p>
          </div>
          ${icon("chevron_right", "item-chevron", "color:var(--kp-muted)")}
        </div>
      `
      )
      .join("");

    step.innerHTML = `
      <div class="kp-topbar">
        <div class="kp-topbar-brand">
          <button class="kp-back-btn" id="kwespay-sui-picker-back">
            ${icon("arrow_back")}
          </button>
          <span class="kp-topbar-name">Connect Sui Wallet</span>
        </div>
      </div>
      <div class="content-scroll" style="padding-top:16px">
        <p class="section-hint">Choose a Sui wallet to connect.</p>
        <div class="item-list" id="kwespay-sui-injected-list">
          ${skeletonRows}
        </div>
      </div>
    `;

    container.appendChild(step);

    step
      .querySelector("#kwespay-sui-picker-back")
      ?.addEventListener("click", () => {
        this._removeCustomStep("kwespay-step-sui-picker");
        this._goToStep(2);
      });

    this._goToStep("sui-picker");

    this.suiWalletService.discoverWallets().then((detectedWallets) => {
      const detectedByName = new Map(
        detectedWallets.map((w) => [w.name.toLowerCase(), w])
      );

      step.querySelectorAll(".kp-sui-known-wallet").forEach((row) => {
        const index = parseInt(row.getAttribute("data-known-index"), 10);
        const known = knownWallets[index];
        const detected = detectedByName.get(known.name.toLowerCase());
        const statusEl = row.querySelector(`.kp-sui-wallet-status-${index}`);

        if (detected) {
          row.style.opacity = "1";
          row.style.pointerEvents = "auto";
          row.style.cursor = "pointer";
          if (statusEl) {
            statusEl.textContent = "Browser extension";
            statusEl.style.color = "var(--kp-accent)";
          }
          row.addEventListener("click", async () => {
            this._removeCustomStep("kwespay-step-sui-picker");
            await this._connectSuiInjectedWallet(detected);
          });
        } else {
          row.style.opacity = "0.4";
          row.style.pointerEvents = "auto";
          row.style.cursor = "pointer";
          if (statusEl) {
            statusEl.textContent = "Not detected — click to install";
            statusEl.style.color = "var(--kp-muted)";
          }
          row.addEventListener("click", () => {
            window.open(known.installUrl, "_blank", "noreferrer noopener");
          });
        }
      });

      detectedWallets.forEach((wallet) => {
        const alreadyListed = knownWallets.some(
          (k) => k.name.toLowerCase() === wallet.name.toLowerCase()
        );
        if (alreadyListed) return;

        const list = document.getElementById("kwespay-sui-injected-list");
        if (!list) return;

        const iconHtml = wallet.icon
          ? `<img src="${safeImageUrl(wallet.icon)}" alt="${escapeHtml(wallet.name)}" style="width:22px;height:22px;object-fit:contain;border-radius:6px">`
          : icon("account_balance_wallet", "", "font-size:18px;color:var(--kp-accent)");

        const item = document.createElement("div");
        item.className = "list-item";
        item.style.cursor = "pointer";
        item.innerHTML = `
          <div class="item-icon">${iconHtml}</div>
          <div class="item-info">
            <div class="item-name-row"><p class="item-name">${escapeHtml(wallet.name)}</p></div>
            <p class="item-desc" style="color:var(--kp-accent)">Browser extension</p>
          </div>
          ${icon("chevron_right", "item-chevron")}
        `;
        item.addEventListener("click", async () => {
          this._removeCustomStep("kwespay-step-sui-picker");
          await this._connectSuiInjectedWallet(wallet);
        });
        list.appendChild(item);
      });
    });
  },

  _renderSuiMobilePicker() {
    this._removeCustomStep("kwespay-step-sui-picker");

    const wallets = [
      {
        id: "slush",
        name: "Slush",
        icon: "https://arthuremma2.github.io/img-hosting/slush.svg",
        kind: "slush",
      },
      ...this.suiWalletService
        .getMobileWallets()
        .filter((w) => w.name.toLowerCase() !== "slush")
        .map((w) => ({
          id: w.name.toLowerCase(),
          name: w.name,
          icon: w.icon,
          kind: "wc",
          wc: w,
        })),
    ];

    const container = document.getElementById("kwespay-widget-container");
    const step = document.createElement("div");
    step.className = "step";
    step.id = "kwespay-step-sui-picker";
    step.innerHTML = `
      <div class="kp-topbar">
        <div class="kp-topbar-brand">
          <button class="kp-back-btn" id="kwespay-sui-picker-back">
            ${icon("arrow_back")}
          </button>
          <span class="kp-topbar-name">Connect Sui Wallet</span>
        </div>
      </div>
      <div class="content-scroll" style="padding-top:16px">
        <p class="section-hint">Choose a wallet to connect.</p>
        <div class="item-list">
          ${wallets
            .map(
              (w, i) => `
            <div class="list-item kp-sui-mwallet" data-index="${i}" style="cursor:pointer${
                w.kind === "slush" ? ";opacity:0.45;pointer-events:none" : ""
              }">
              <div class="item-icon">
                <img src="${safeImageUrl(w.icon)}" alt="${escapeHtml(w.name)}" style="width:22px;height:22px;object-fit:contain;border-radius:6px">
              </div>
              <div class="item-info">
                <div class="item-name-row"><p class="item-name">${escapeHtml(w.name)}</p></div>
                <p class="item-desc kp-sui-mwallet-desc">${
                  w.kind === "slush" ? "Getting ready…" : "Tap to connect"
                }</p>
              </div>
              ${icon("chevron_right", "item-chevron")}
            </div>`
            )
            .join("")}
        </div>
      </div>
    `;
    container.appendChild(step);

    step
      .querySelector("#kwespay-sui-picker-back")
      ?.addEventListener("click", () => {
        this._removeCustomStep("kwespay-step-sui-picker");
        this._goToStep(2);
      });

    this._goToStep("sui-picker");

    this._suiSlushWallet = null;
    const slushRow = step.querySelector('.kp-sui-mwallet[data-index="0"]');
    const slushDesc = slushRow?.querySelector(".kp-sui-mwallet-desc");
    this.suiWalletService
      .ensureSlushWebWallet(
        this.config?.appName || this.config?.vendorName || document.title
      )
      .then(() => this.suiWalletService.discoverWallets())
      .then((found) => {
        this._suiSlushWallet =
          found.find((w) => w.name.toLowerCase().includes("slush")) ?? null;
        if (!slushRow) return;
        if (this._suiSlushWallet) {
          slushRow.style.opacity = "1";
          slushRow.style.pointerEvents = "auto";
          if (slushDesc) slushDesc.textContent = "Tap to connect";
        } else {
          slushRow.style.opacity = "0.4";
          slushRow.style.pointerEvents = "auto";
          if (slushDesc) slushDesc.textContent = "Unavailable right now";
        }
      })
      .catch(() => {
        if (slushDesc) slushDesc.textContent = "Unavailable right now";
        if (slushRow) slushRow.style.pointerEvents = "auto";
      });

    step.querySelectorAll(".kp-sui-mwallet").forEach((el) => {
      const w = wallets[parseInt(el.getAttribute("data-index"), 10)];
      el.addEventListener("click", () => {
        if (w.kind === "slush") this._connectSuiSlushMobile();
        else this._connectSuiMobileWc(w.wc);
      });
    });
  },

  async _connectSuiMobileWc(wallet) {
    this._removeCustomStep("kwespay-step-sui-picker");

    await this._renderWalletConnectStep({
      title: "Connect Sui Wallet",
      subtitle: `Open ${escapeHtml(wallet.name)} below, or scan from another device.`,
      mobileWallets: [wallet],
      backToStep: 2,
      start: async (onUri) => {
        if (!this.suiMobileTransport) {
          await ensureBuffer();
          const { default: SuiMobileTransport } = await import(
            "../../services/SuiMobileTransport.js"
          );
          this.suiMobileTransport = SuiMobileTransport.get(
            this.config?.projectId
          );
        }
        if (this.suiMobileTransport.isConnected()) {
          await this.suiMobileTransport.disconnect().catch(() => {});
        }
        this._persistResumeState("sui");
        return this.suiMobileTransport.connect({
          chainId: this.state.selectedChainId,
          onUri,
        });
      },
      onConnected: async (connection) => {
        this._activeSuiTransport = this.suiMobileTransport;
        await this._onSuiWalletConnected(connection);
      },
    });
  },

  _connectSuiSlushMobile() {
    const slush = this._suiSlushWallet;
    if (!slush) return;

    this._removeCustomStep("kwespay-step-sui-picker");
    this._activeSuiTransport = null;
    this._renderSuiConnectingStep("Slush");
    this._persistResumeState("sui");

    this.suiWalletService
      .connect(slush, this.state.selectedChainId)
      .then((connection) => {
        this._removeCustomStep("kwespay-step-sui-connecting");
        return this._onSuiWalletConnected(connection);
      })
      .catch((err) => {
        this._removeCustomStep("kwespay-step-sui-connecting");
        const m = (err?.message ?? "").toLowerCase();
        if (err.code === "USER_CANCELLED" || m.includes("user closed")) {
          this._goToStep(2);
          return;
        }
        this._showError(
          "Connection Failed",
          getErrorMessage(err, { token: this.state.selectedToken })
        );
      });
  },

  _renderSuiConnectingStep(name) {
    this._removeCustomStep("kwespay-step-sui-connecting");
    const container = document.getElementById("kwespay-widget-container");
    const step = document.createElement("div");
    step.className = "step";
    step.id = "kwespay-step-sui-connecting";
    step.innerHTML = `
      <div class="kp-topbar">
        <div class="kp-topbar-brand">
          <button class="kp-back-btn" id="kwespay-sui-connecting-back">
            ${icon("arrow_back")}
          </button>
          <span class="kp-topbar-name">Connecting…</span>
        </div>
      </div>
      <div class="content-scroll" style="padding-top:16px;display:flex;flex-direction:column;align-items:center;gap:16px;text-align:center">
        <div style="width:30px;height:30px;border:3px solid var(--kp-border);border-top-color:var(--kp-accent);border-radius:50%;animation:kpSpin 0.85s linear infinite;margin-top:24px"></div>
        <p class="section-hint">Opening ${name}… approve the connection there, then return to this page.</p>
      </div>
    `;
    container.appendChild(step);
    step
      .querySelector("#kwespay-sui-connecting-back")
      ?.addEventListener("click", () => {
        this._removeCustomStep("kwespay-step-sui-connecting");
        this._goToStep(2);
      });
    this._goToStep("sui-connecting");
  },

  async _connectSuiInjectedWallet(wallet) {
    this._activeSuiTransport = null;

    try {
      const connection = await this.suiWalletService.connect(
        wallet,
        this.state.selectedChainId
      );
      await this._onSuiWalletConnected(connection);
    } catch (err) {
      if (err.code === "USER_CANCELLED") return;
      this._showError(
        "Connection Failed",
        getErrorMessage(err, { token: this.state.selectedToken })
      );
    }
  },

  async _onSuiWalletConnected(connection) {
    this.state.payerWalletAddress = connection.address;

    const addressEl = document.getElementById("kwespay-connectedWalletAddress");
    if (addressEl) addressEl.textContent = connection.shortAddress;

    const networkEl = document.getElementById("kwespay-summaryNetwork");
    if (networkEl) networkEl.textContent = this.state.selectedNetworkName;

    const tokenEl = document.getElementById("kwespay-summaryToken");
    if (tokenEl) tokenEl.textContent = this.state.selectedToken;

    const cryptoLine = document.getElementById("kwespay-reviewCryptoLine");
    const timerEl = document.getElementById("kwespay-quoteTimer");
    const proceedBtn = document.getElementById("kwespay-proceedToPayment");

    if (cryptoLine) {
      cryptoLine.textContent = "loading…";
      cryptoLine.classList.add("loading");
    }
    if (timerEl) timerEl.style.display = "none";
    if (proceedBtn) proceedBtn.disabled = true;

    this._goToStep(3);

    try {
      await this._loadReviewStep();
    } catch (err) {
      if (cryptoLine) {
        cryptoLine.textContent = "Could not load rate — please try again.";
        cryptoLine.classList.remove("loading");
      }
    }

    dispatchWidgetEvent("walletConnected", { address: connection.address });
  },

  async _disconnectSuiWallet() {
    if (this.suiWalletService?.isConnected()) {
      await this.suiWalletService.disconnect();
    }

    if (this._activeSuiTransport?.isConnected()) {
      await this._activeSuiTransport.disconnect();
      this._activeSuiTransport = null;
    }
  },
};
