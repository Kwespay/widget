import { dispatchWidgetEvent, getErrorMessage, escapeHtml, safeImageUrl } from "../../utils/helpers.js";
import StellarWalletService from "../../services/StellarWalletService.js";
import { ensureBuffer } from "../../utils/nodeGlobals.js";
import { icon } from "../../ui/icons.js";

export const StellarWalletMethods = {
  async _handleStellarWalletConnection() {
    if (!this.stellarWalletService) {
      this.stellarWalletService = new StellarWalletService({
        projectId: this.config?.projectId,
        appName: this.config?.appName,
      });
    }
    await this._renderStellarWalletPickerStep();
  },

  async _renderStellarWalletPickerStep() {
    this._removeCustomStep("kwespay-step-stellar-picker");

    const container = document.getElementById("kwespay-widget-container");
    const step = document.createElement("div");
    step.className = "step";
    step.id = "kwespay-step-stellar-picker";

    step.innerHTML = `
      <div class="kp-topbar">
        <div class="kp-topbar-brand">
          <button class="kp-back-btn" id="kwespay-stellar-picker-back">
            ${icon("arrow_back")}
          </button>
          <span class="kp-topbar-name">Connect Stellar Wallet</span>
        </div>
      </div>
      <div class="content-scroll" style="padding-top:16px">
        <p class="section-hint">Choose a Stellar wallet to connect.</p>
        <div class="item-list" id="kwespay-stellar-wallet-list">
          <div style="text-align:center;padding:12px;font-family:var(--kp-mono);font-size:11px;color:var(--kp-muted)">Detecting wallets…</div>
        </div>
      </div>
    `;

    container.appendChild(step);

    step
      .querySelector("#kwespay-stellar-picker-back")
      ?.addEventListener("click", () => {
        this._removeCustomStep("kwespay-step-stellar-picker");
        this._goToStep(2);
      });

    this._goToStep("stellar-picker");

    const networkPassphrase =
      this.state.selectedNetworkConfig?.networkPassphrase;

    let wallets = [];
    try {
      wallets = await this.stellarWalletService.discoverWallets(
        networkPassphrase
      );
    } catch {}

    const list = document.getElementById("kwespay-stellar-wallet-list");
    if (!list) return;
    list.innerHTML = "";

    const available = wallets.filter((w) => w.isAvailable).slice(0, 5);

    available.forEach((wallet) => {
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
          <p class="item-desc">Tap to connect</p>
        </div>
        ${icon("chevron_right", "item-chevron")}
      `;

      item.addEventListener("click", async () => {
        this._removeCustomStep("kwespay-step-stellar-picker");
        await this._connectStellarWallet(wallet.id);
      });

      list.appendChild(item);
    });

    if (this.config?.projectId) {
      const wcItem = document.createElement("div");
      wcItem.className = "list-item";
      wcItem.style.cursor = "pointer";
      wcItem.innerHTML = `
        <div class="item-icon">
          ${icon("qr_code_2", "", "font-size:18px;color:var(--kp-accent)")}
        </div>
        <div class="item-info">
          <div class="item-name-row"><p class="item-name">LOBSTR / WalletConnect</p></div>
          <p class="item-desc">Scan QR with your Stellar wallet app</p>
        </div>
        ${icon("chevron_right", "item-chevron")}
      `;
      wcItem.addEventListener("click", () => {
        this._removeCustomStep("kwespay-step-stellar-picker");
        this._connectStellarWalletConnect();
      });
      list.appendChild(wcItem);
    }

    if (!list.children.length) {
      list.innerHTML = `<div style="text-align:center;padding:12px;font-family:var(--kp-mono);font-size:11px;color:var(--kp-muted)">No Stellar wallets found.</div>`;
    }
  },

  async _connectStellarWallet(walletId) {
    try {
      this._activeStellarTransport = null;
      const connection = await this.stellarWalletService.connect(walletId);
      await this._onStellarWalletConnected(connection);
    } catch (err) {
      if (err.code === "USER_CANCELLED") return;
      this._showError(
        "Connection Failed",
        getErrorMessage(err, { token: this.state.selectedToken })
      );
    }
  },

  async _connectStellarWalletConnect() {
    await this._renderWalletConnectStep({
      title: "Connect Stellar Wallet",
      steps: [
        "Tap the QR scanner icon inside the app",
        "Scan the code shown below",
        "On your phone instead? Tap **Copy link** and paste it into your wallet app",
      ],
      mobileWallets: [],
      backToStep: 2,
      start: async (onUri) => {
        await ensureBuffer();
        const { default: StellarMobileTransport } = await import(
          "../../services/StellarMobileTransport.js"
        );
        const transport = StellarMobileTransport.get(this.config.projectId);
        if (transport.isConnected()) {
          await transport.disconnect().catch(() => {});
        }
        this._pendingStellarTransport = transport;
        this._persistResumeState("stellar");
        return transport.connect({
          chainId: this.state.selectedChainId,
          onUri,
        });
      },
      onConnected: async (connection) => {
        this._activeStellarTransport = this._pendingStellarTransport;
        this._pendingStellarTransport = null;
        await this._onStellarWalletConnected(connection);
      },
    });
  },

  async _onStellarWalletConnected(connection) {
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

  async _disconnectStellarWallet() {
    if (this.stellarWalletService?.isConnected()) {
      await this.stellarWalletService.disconnect();
    }
    if (this._activeStellarTransport?.isConnected?.()) {
      await this._activeStellarTransport.disconnect().catch(() => {});
    }
    this._activeStellarTransport = null;
  },
};
