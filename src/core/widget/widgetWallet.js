import { dispatchWidgetEvent, isMobileDevice } from "../../utils/helpers.js";

export const WalletMethods = {
  async _handleWalletConnection() {
    if (!this.state.selectedToken || !this.state.selectedTokenConfig) {
      alert("Please select a token first");
      return;
    }
    this._renderWalletPickerStep();
  },

  _renderWalletPickerStep() {
    this._removeCustomStep("kwespay-step-wallet-picker");

    const container = document.getElementById("kwespay-widget-container");
    const step = document.createElement("div");
    step.className = "step";
    step.id = "kwespay-step-wallet-picker";

    step.innerHTML = `
      <div class="kp-topbar">
        <div class="kp-topbar-brand">
          <button class="kp-back-btn" id="kwespay-picker-back">
            <span class="material-symbols-outlined">arrow_back</span>
          </button>
          <div class="kp-topbar-dot"></div>
          <span class="kp-topbar-name">Connect Wallet</span>
        </div>
      </div>
      <div class="content-scroll" style="padding-top:16px">
        <p class="section-hint">Choose how to connect your wallet.</p>
        <div class="item-list" id="kwespay-injected-list">
          <div style="text-align:center;padding:12px;font-family:var(--kp-mono);font-size:11px;color:var(--kp-muted)">Detecting wallets…</div>
        </div>
        <div class="kp-section-divider" style="margin-top:20px">Or scan QR code</div>
        <div class="item-list" id="kwespay-wc-list">
          <div class="list-item" id="kwespay-wc-option" style="cursor:pointer">
            <div class="item-icon" style="background:transparent">
              <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
                <path d="M4 4C7.3 1 14.7 1 18 4C18 4 15 7.5 11 7.5C7 7.5 4 4 4 4Z" fill="#3396FF"/>
                <path d="M4 4C4 4 6.5 9 11 9C15.5 9 18 4 18 4" stroke="#3396FF" stroke-width="1.5" fill="none"/>
                <path d="M7.5 10L9.5 14L11 11L12.5 14L14.5 10" stroke="#3396FF" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </div>
            <div class="item-info">
              <div class="item-name-row"><p class="item-name">WalletConnect</p></div>
              <p class="item-desc">${
                isMobileDevice()
                  ? "Open your mobile wallet"
                  : "Scan QR with any wallet"
              }</p>
            </div>
            <span class="material-symbols-outlined item-chevron">chevron_right</span>
          </div>
        </div>
      </div>
    `;

    container.appendChild(step);

    step
      .querySelector("#kwespay-picker-back")
      ?.addEventListener("click", () => {
        this._removeCustomStep("kwespay-step-wallet-picker");
        this._goToStep(2);
      });

    step.querySelector("#kwespay-wc-option")?.addEventListener("click", () => {
      this._removeCustomStep("kwespay-step-wallet-picker");
      this._startWalletConnect();
    });

    this._goToStep("wallet-picker");

    this.walletService.discoverInjectedWallets().then((providers) => {
      const list = document.getElementById("kwespay-injected-list");
      if (!list) return;
      list.innerHTML = "";

      if (providers.length === 0) {
        list.innerHTML = `<div style="text-align:center;padding:12px;font-family:var(--kp-mono);font-size:11px;color:var(--kp-muted)">No browser wallet detected.</div>`;
        return;
      }

      providers.forEach((entry, index) => {
        const iconHtml = entry.info.icon
          ? `<img src="${entry.info.icon}" alt="${entry.info.name}" style="width:22px;height:22px;object-fit:contain;border-radius:6px">`
          : `<span class="material-symbols-outlined" style="font-size:18px;color:var(--kp-accent)">account_balance_wallet</span>`;

        const item = document.createElement("div");
        item.className = "list-item";
        item.style.cursor = "pointer";
        item.innerHTML = `
          <div class="item-icon">${iconHtml}</div>
          <div class="item-info">
            <div class="item-name-row"><p class="item-name">${entry.info.name}</p></div>
            <p class="item-desc">Browser extension</p>
          </div>
          <span class="material-symbols-outlined item-chevron">chevron_right</span>
        `;
        item.addEventListener("click", async () => {
          this._removeCustomStep("kwespay-step-wallet-picker");
          await this._connectInjectedProvider(index);
        });
        list.appendChild(item);
      });
    });
  },

  async _connectInjectedProvider(index) {
    try {
      const connection = await this.walletService.connectInjected(index);
      await this._onWalletConnected(connection);
    } catch (err) {
      if (err.code === "USER_CANCELLED" || err.code === 4001) return;
      console.error("[KwesPayWidget] Injected connect error:", err.message);
      this._showError(
        "Connection Failed",
        err.message || "Could not connect wallet."
      );
      dispatchWidgetEvent("walletConnectionError", { error: err.message });
    }
  },

  async _startWalletConnect() {
    this._renderWCStep();

    try {
      await this.walletService.initWalletConnect(
        (uri) => this._onWCUri(uri),
        () => this._onWCConnected(),
        () => this._onWCDisconnected()
      );

      if (isMobileDevice()) {
        this._renderWCMobileStep();
      }

      // Pass the target chain so the wallet starts the WC session on the right
      // network — without this it defaults to its last-used WC chain (Mainnet).
      await this.walletService.connectWalletConnect(this.state.selectedChainId);
    } catch (err) {
      if (
        err.message?.includes("User rejected") ||
        err.message?.includes("cancelled")
      )
        return;
      console.error("[KwesPayWidget] WC connect error:", err.message);
      this._showError(
        "Connection Failed",
        err.message || "WalletConnect failed."
      );
    }
  },

  _renderWCStep() {
    this._removeCustomStep("kwespay-step-wc");
    const container = document.getElementById("kwespay-widget-container");
    const step = document.createElement("div");
    step.className = "step";
    step.id = "kwespay-step-wc";
    step.innerHTML = isMobileDevice()
      ? this._wcMobileHTML()
      : this._wcDesktopHTML();
    container.appendChild(step);

    step
      .querySelector("#kwespay-wc-back")
      ?.addEventListener("click", async () => {
        await this.walletService.disconnect();
        this._removeCustomStep("kwespay-step-wc");
        this._renderWalletPickerStep();
      });

    step.querySelector("#kwespay-wc-copy")?.addEventListener("click", () => {
      if (this.state.wcUri) {
        navigator.clipboard.writeText(this.state.wcUri).catch(() => {});
        const btn = document.getElementById("kwespay-wc-copy");
        if (btn) btn.textContent = "Copied!";
        setTimeout(() => {
          if (btn) btn.textContent = "Copy URI";
        }, 2000);
      }
    });

    this._goToStep("wc");
  },

  _wcDesktopHTML() {
    return `
      <div class="kp-topbar">
        <div class="kp-topbar-brand">
          <button class="kp-back-btn" id="kwespay-wc-back">
            <span class="material-symbols-outlined">arrow_back</span>
          </button>
          <div class="kp-topbar-dot"></div>
          <span class="kp-topbar-name">Scan QR Code</span>
        </div>
      </div>
      <div class="content-scroll" style="padding-top:16px;display:flex;flex-direction:column;align-items:center;gap:16px">
        <p class="section-hint" style="text-align:center">Open any WalletConnect-compatible wallet app and scan the code below.</p>
        <div id="kwespay-qr-canvas" style="width:220px;height:220px;background:white;border-radius:12px;display:flex;align-items:center;justify-content:center;border:1px solid var(--kp-border)">
          <p style="font-size:11px;color:#888;font-family:var(--kp-mono)">Generating QR…</p>
        </div>
        <button class="action-btn secondary" id="kwespay-wc-copy" style="width:auto;padding:8px 20px;font-size:12px">Copy URI</button>
        <p style="font-size:11px;color:var(--kp-muted);font-family:var(--kp-mono);text-align:center">Waiting for wallet connection…</p>
      </div>
    `;
  },

  _wcMobileHTML() {
    const wallets = this.walletService.getMobileWallets();
    const walletButtons = wallets
      .map(
        (w, i) => `
      <div class="list-item kp-wallet-option" data-index="${i}" style="cursor:pointer">
        <div class="item-icon">
          <img src="${w.icon}" alt="${w.name}" style="width:22px;height:22px;object-fit:contain;border-radius:6px" onerror="this.style.display='none'">
        </div>
        <div class="item-info">
          <div class="item-name-row"><p class="item-name">${w.name}</p></div>
          <p class="item-desc">Tap to open and approve</p>
        </div>
        <span class="material-symbols-outlined item-chevron">open_in_new</span>
      </div>
    `
      )
      .join("");

    return `
      <div class="kp-topbar">
        <div class="kp-topbar-brand">
          <button class="kp-back-btn" id="kwespay-wc-back">
            <span class="material-symbols-outlined">arrow_back</span>
          </button>
          <div class="kp-topbar-dot"></div>
          <span class="kp-topbar-name">Connect Wallet</span>
        </div>
      </div>
      <div class="content-scroll" style="padding-top:16px">
        <div class="kp-mobile-connect-status" id="kwespay-wc-status-card">
          <div class="kp-mobile-status-icon">
            <div class="spinner-ring" style="width:20px;height:20px;border-width:2px"></div>
          </div>
          <div class="kp-mobile-status-text">
            <p class="kp-mobile-status-title">Preparing connection</p>
            <p class="kp-mobile-status-desc" id="kwespay-wc-status">This only takes a moment…</p>
          </div>
        </div>
        <p class="section-hint" style="margin-top:16px">Choose your wallet app to connect.</p>
        <div class="item-list" id="kwespay-mobile-wallet-list">${walletButtons}</div>
        <p style="font-size:10px;color:var(--kp-muted);font-family:var(--kp-mono);text-align:center;margin-top:16px;line-height:1.6">
          After approving in your wallet, return here to complete payment.
        </p>
      </div>
    `;
  },

  _renderWCMobileStep() {
    const list = document.getElementById("kwespay-mobile-wallet-list");
    if (!list) return;

    list.querySelectorAll(".kp-wallet-option").forEach((item) => {
      const index = parseInt(item.getAttribute("data-index"), 10);
      const wallet = this.walletService.getMobileWallets()[index];

      item.addEventListener("click", () => {
        if (!this.state.wcUri) {
          const status = document.getElementById("kwespay-wc-status");
          if (status) status.textContent = "Still connecting — please wait…";
          return;
        }
        const url = wallet.universalLink(this.state.wcUri);
        if (this.walletService.isIOS()) {
          window.location.href = url;
        } else {
          window.open(url, "_blank", "noreferrer noopener");
        }
      });
    });
  },

  _onWCUri(uri) {
    this.state.wcUri = uri;

    if (isMobileDevice()) {
      const statusDesc = document.getElementById("kwespay-wc-status");
      const statusTitle = document.querySelector(".kp-mobile-status-title");
      const statusIcon = document.querySelector(".kp-mobile-status-icon");
      if (statusDesc)
        statusDesc.textContent = "Ready. Tap a wallet below to connect.";
      if (statusTitle) statusTitle.textContent = "Connection ready";
      if (statusIcon)
        statusIcon.innerHTML = `<span class="material-symbols-outlined" style="font-size:18px;color:var(--kp-accent)">check_circle</span>`;
    } else {
      this._renderQRCode(uri);
    }
  },

  _renderQRCode(uri) {
    const canvas = document.getElementById("kwespay-qr-canvas");
    if (!canvas) return;

    if (typeof QRCode !== "undefined") {
      canvas.innerHTML = "";
      new QRCode(canvas, {
        text: uri,
        width: 200,
        height: 200,
        colorDark: "#000000",
        colorLight: "#ffffff",
        correctLevel: QRCode.CorrectLevel.M,
      });
      return;
    }
    if (typeof window.qrcode !== "undefined") {
      const qr = window.qrcode(0, "M");
      qr.addData(uri);
      qr.make();
      canvas.innerHTML = qr.createImgTag(3);
      return;
    }

    canvas.innerHTML = `
      <div style="display:flex;flex-direction:column;align-items:center;gap:8px;padding:12px">
        <p style="font-size:10px;color:#888;font-family:monospace;word-break:break-all;text-align:center;max-width:180px">${uri.slice(
          0,
          80
        )}…</p>
        <p style="font-size:10px;color:#888;font-family:monospace">Use Copy URI button</p>
      </div>
    `;
  },

  _onWCConnected() {
    const connection = this.walletService._connectionResult();
    this._removeCustomStep("kwespay-step-wc");
    this._onWalletConnected(connection);
  },

  _onWCDisconnected() {
    this._removeCustomStep("kwespay-step-wc");
    this._goToStep(2);
  },

  async _onWalletConnected(connection) {
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
      console.error(
        "[KwesPayWidget] Quote load failed after wallet connect:",
        err.message
      );
      if (cryptoLine) {
        cryptoLine.textContent = "Could not load rate — please try again.";
        cryptoLine.classList.remove("loading");
      }
    }

    dispatchWidgetEvent("walletConnected", { address: connection.address });
  },
};
