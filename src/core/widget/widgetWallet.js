import {
  dispatchWidgetEvent,
  isMobileDevice,
  getErrorMessage,
  escapeHtml,
  safeImageUrl,
} from "../../utils/helpers.js";
import { icon } from "../../ui/icons.js";
import { ensureBuffer } from "../../utils/nodeGlobals.js";

export const WalletMethods = {
  async _handleWalletConnection() {
    if (this.config.preview) {
      const btn = document.getElementById("kwespay-continueToWalletConnect");
      if (btn) {
        const label = btn.textContent;
        btn.textContent = "Payments are off in preview";
        btn.disabled = true;
        setTimeout(() => {
          btn.textContent = label;
          btn.disabled = false;
        }, 1800);
      }
      return;
    }
    if (!this.state.selectedToken || !this.state.selectedTokenConfig) {
      const btn = document.getElementById("kwespay-continueToWalletConnect");
      if (btn) btn.disabled = true;
      return;
    }

    const ecosystem = this.state.selectedNetworkConfig?.ecosystem;

    if (ecosystem === "sui") {
      await this._handleSuiWalletConnection();
      return;
    }

    if (ecosystem === "stellar") {
      await this._handleStellarWalletConnection();
      return;
    }

    if (ecosystem === "near") {
      await this._handleNearWalletConnection();
      return;
    }

    if (isMobileDevice()) {
      await this._handleEvmMobileConnection();
      return;
    }

    this._renderWalletPickerStep();
  },

  async _handleEvmMobileConnection() {
    let providers = [];
    try {
      providers = await this.walletService.discoverInjectedWallets();
    } catch (_) {}

    if (providers.length === 1) {
      await this._connectInjectedProvider(0);
      return;
    }
    if (providers.length > 1) {
      this._renderWalletPickerStep();
      return;
    }
    await this._connectEvmWalletConnect();
  },

  async _connectEvmWalletConnect() {
    await this._renderWalletConnectStep({
      title: "Connect Wallet",
      subtitle: "Choose your wallet to continue.",
      mobileWallets: this.walletService.getEvmMobileWallets(),
      backToStep: 2,
      start: async (onUri) => {
        if (!this._activeEvmTransport) {
          await ensureBuffer();
          const { default: EvmMobileTransport } = await import(
            "../../services/EvmMobileTransport.js"
          );
          this._activeEvmTransport = EvmMobileTransport.get(
            this.config.projectId
          );
        }
        this._persistResumeState("evm");
        return this._activeEvmTransport.connect({
          chainId: this.state.selectedChainId,
          rpcUrl: this.state.selectedRpcUrl,
          onUri,
        });
      },
      onConnected: async (connection) => {
        this.walletService.useExternalProvider(
          this._activeEvmTransport.getProvider(),
          connection.address,
          "evm-wc"
        );
        await this._onWalletConnected(connection);
      },
      onError: (err) => {
        this._showError(
          "Connection Failed",
          getErrorMessage(err, { token: this.state.selectedToken })
        );
        dispatchWidgetEvent("walletConnectionError", { error: err.message });
      },
    });
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
            ${icon("arrow_back")}
          </button>

          <span class="kp-topbar-name">Connect Wallet</span>
        </div>
      </div>
      <div class="content-scroll" style="padding-top:16px">
        <p class="section-hint">Choose your wallet to continue.</p>
        <div class="item-list" id="kwespay-injected-list">
          <div style="text-align:center;padding:12px;font-family:var(--kp-mono);font-size:11px;color:var(--kp-muted)">Detecting wallets…</div>
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
          ? `<img src="${safeImageUrl(entry.info.icon)}" alt="${escapeHtml(entry.info.name)}" style="width:22px;height:22px;object-fit:contain;border-radius:6px">`
          : icon("account_balance_wallet", "", "font-size:18px;color:var(--kp-accent)");

        const item = document.createElement("div");
        item.className = "list-item";
        item.style.cursor = "pointer";
        item.innerHTML = `
          <div class="item-icon">${iconHtml}</div>
          <div class="item-info">
            <div class="item-name-row"><p class="item-name">${escapeHtml(entry.info.name)}</p></div>
            <p class="item-desc">Tap to connect</p>
          </div>
          ${icon("chevron_right", "item-chevron")}
        `;
        item.addEventListener("click", async () => {
          this._removeCustomStep("kwespay-step-wallet-picker");
          await this._connectInjectedProvider(index);
        });
        list.appendChild(item);
      });
    });
  },

  _renderConnectingStep(walletName) {
    this._removeCustomStep("kwespay-step-connecting");
    const container = document.getElementById("kwespay-widget-container");
    const step = document.createElement("div");
    step.className = "step";
    step.id = "kwespay-step-connecting";
    step.innerHTML = `
      <div class="kp-topbar">
        <div class="kp-topbar-brand">
          <button class="kp-back-btn" data-connecting-back>${icon("arrow_back")}</button>
          <span class="kp-topbar-name">Connecting…</span>
        </div>
      </div>
      <div class="content-scroll" style="padding-top:16px;display:flex;flex-direction:column;align-items:center;gap:16px;text-align:center">
        <div style="width:30px;height:30px;border:3px solid var(--kp-border);border-top-color:var(--kp-accent);border-radius:50%;animation:kpSpin 0.85s linear infinite;margin-top:24px"></div>
        <p class="section-hint" data-connecting-text></p>
      </div>
    `;
    step.querySelector("[data-connecting-text]").textContent =
      `Approve the connection in ${walletName || "your wallet"} to continue.`;
    step.querySelector("[data-connecting-back]").addEventListener("click", () => {
      this._removeCustomStep("kwespay-step-connecting");
      this._goToStep(2);
    });
    container.appendChild(step);
    this._goToStep("connecting");
  },

  async _connectInjectedProvider(index) {
    const name = this.walletService.injectedProviders?.[index]?.info?.name;
    this._renderConnectingStep(name);
    try {
      const connection = await this.walletService.connectInjected(index);
      this._removeCustomStep("kwespay-step-connecting");
      await this._onWalletConnected(connection);
    } catch (err) {
      this._removeCustomStep("kwespay-step-connecting");
      if (err.code === "USER_CANCELLED" || err.code === 4001) {
        this._goToStep(2);
        return;
      }
      this._showError(
        "Connection Failed",
        getErrorMessage(err, { token: this.state.selectedToken })
      );
      dispatchWidgetEvent("walletConnectionError", { error: err.message });
    }
  },

  async _onWalletConnected(connection) {
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
};
