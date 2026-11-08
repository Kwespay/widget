import { dispatchWidgetEvent, getErrorMessage, escapeHtml, safeImageUrl } from "../../utils/helpers.js";
import NearWalletService from "../../services/NearWalletService.js";
import { icon } from "../../ui/icons.js";

export const NearWalletMethods = {
  async _handleNearWalletConnection() {
    if (!this.nearWalletService) {
      this.nearWalletService = new NearWalletService({ external: this.config?.nearWallet });
    }
    if (this.nearWalletService.hasExternalWallet()) {
      try {
        const connection = await this.nearWalletService.connectExternal();
        await this._onNearWalletConnected(connection);
      } catch (err) {
        if (err.code === "USER_CANCELLED") return;
        this._showError("Connection Failed", getErrorMessage(err, { token: this.state.selectedToken }));
      }
      return;
    }
    await this._renderNearWalletPickerStep();
  },

  async _renderNearWalletPickerStep() {
    this._removeCustomStep("kwespay-step-near-picker");

    const container = document.getElementById("kwespay-widget-container");
    const step = document.createElement("div");
    step.className = "step";
    step.id = "kwespay-step-near-picker";
    step.innerHTML = `
      <div class="kp-topbar">
        <div class="kp-topbar-brand">
          <button class="kp-back-btn" id="kwespay-near-picker-back">
            ${icon("arrow_back")}
          </button>
          <span class="kp-topbar-name">Connect NEAR Wallet</span>
        </div>
      </div>
      <div class="content-scroll" style="padding-top:16px">
        <p class="section-hint">Choose a NEAR wallet to connect.</p>
        <div class="item-list" id="kwespay-near-wallet-list">
          <div style="text-align:center;padding:12px;font-family:var(--kp-mono);font-size:11px;color:var(--kp-muted)">Loading wallets…</div>
        </div>
      </div>
    `;
    container.appendChild(step);

    step.querySelector("#kwespay-near-picker-back")?.addEventListener("click", () => {
      this._removeCustomStep("kwespay-step-near-picker");
      this._goToStep(2);
    });

    this._goToStep("near-picker");

    const net = this.state.selectedNetworkConfig;
    let wallets = [];
    let loadError = null;
    try {
      wallets = await this.nearWalletService.discoverWallets({
        networkId: net?.type === "testnet" ? "testnet" : "mainnet",
        contractId: net?.contractAddress,
      });
    } catch (err) {
      loadError = err;
    }

    const list = document.getElementById("kwespay-near-wallet-list");
    if (!list) return;
    list.innerHTML = "";

    wallets.filter((w) => w.isAvailable).forEach((wallet) => {
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
          <p class="item-desc">${wallet.type === "injected" ? "Browser extension" : "Opens a wallet window"}</p>
        </div>
        ${icon("chevron_right", "item-chevron")}
      `;
      item.addEventListener("click", async () => {
        this._removeCustomStep("kwespay-step-near-picker");
        await this._connectNearWallet(wallet.id);
      });
      list.appendChild(item);
    });

    if (!list.children.length) {
      list.innerHTML = `<div style="text-align:center;padding:12px;font-family:var(--kp-mono);font-size:11px;color:var(--kp-muted)">${
        loadError ? "NEAR wallets could not be loaded." : "No NEAR wallets found."
      }</div>`;
    }
  },

  async _connectNearWallet(walletId) {
    try {
      const connection = await this.nearWalletService.connect(walletId);
      await this._onNearWalletConnected(connection);
    } catch (err) {
      if (err.code === "USER_CANCELLED") {
        this._goToStep(2);
        return;
      }
      this._showError("Connection Failed", getErrorMessage(err, { token: this.state.selectedToken }));
    }
  },

  async _onNearWalletConnected(connection) {
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

  async _disconnectNearWallet() {
    if (this.nearWalletService?.isConnected() && !this.nearWalletService.hasExternalWallet()) {
      await this.nearWalletService.disconnect();
    } else if (this.nearWalletService) {
      this.nearWalletService.connectedAddress = null;
      this.nearWalletService.connectedWalletId = null;
    }
  },

  async _handleNearPaymentProcessing() {
    try {
      this._clearQuoteTimer();
      this._goToStep(4);
      this._setProcessingView("processing");

      const setStatus = (title, text) => {
        const titleEl = document.getElementById("kwespay-processingTitle");
        const textEl = document.getElementById("kwespay-processingText");
        if (titleEl) titleEl.textContent = title;
        if (textEl) textEl.textContent = text;
      };

      if (!this.nearWalletService?.isConnected()) {
        throw Object.assign(
          new Error("NEAR wallet is not connected. Please reconnect and try again."),
          { code: "NO_PROVIDER" }
        );
      }

      const wallet = await this.nearWalletService.getNearWalletAdapter();
      const payload = await this._prepareTransaction(setStatus, null);

      let receipt;
      try {
        receipt = await this.paymentService.createNearPayment({
          payload,
          wallet,
          onStatusUpdate: setStatus,
        });
      } catch (payErr) {
        throw Object.assign(
          new Error(payErr?.message ?? "Payment submission failed. Please try again."),
          { code: payErr?.code ?? "CONTRACT_ERROR", original: payErr }
        );
      }

      const onChainPayload = {
        transactionReference: receipt.transactionReference,
        paymentIdBytes32: receipt.paymentIdBytes32,
        transactionHash: receipt.hash ?? "",
        transactionStatus: "pending",
        fiatAmount: this.config.amount,
        currency: this.config.currency,
        token: this.state.selectedToken,
        network: this.state.selectedNetwork,
      };

      dispatchWidgetEvent("paymentSuccess", onChainPayload);
      this.config.onPaymentSuccess?.(onChainPayload);
      this._broadcastPayment = onChainPayload;

      this._setProcessingView("confirming");
      setStatus("Confirming payment…", "Waiting for KwesPay to confirm on NEAR.");

      const confirmed = await this._awaitBackendConfirmation(receipt);
      this._completeWithStatus(receipt, onChainPayload, confirmed);
    } catch (error) {
      this._handlePaymentError(error);
    }
  },
};
