import { NETWORK_CONFIGS } from "../../config/constants.js";
import {
  dispatchWidgetEvent,
  truncateHash,
  getErrorType,
  getErrorMessage,
} from "../../utils/helpers.js";
import { formatUnits } from "./widgetQuote.js";

export const PaymentMethods = {
  async _handlePaymentProcessing() {
    if (!this.state.currentPayload) {
      this._showError(
        "Payment Error",
        "Something went wrong. Please go back and try again."
      );
      return;
    }

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

      const isWC = this.walletService.connectionType === "walletconnect";
      const isMobile = this.walletService.isMobile();
      const strictMobile = isWC && isMobile;
      const provider = this.walletService.getProvider();
      const targetChainId = this.state.selectedChainId;

      if (!provider) throw new Error("No wallet provider");

      const alive = await this.walletService.isSessionAlive();
      if (!alive) {
        await this.walletService.disconnect();
        const err = new Error(
          "Your wallet session expired. Please reconnect your wallet."
        );
        err.code = "SESSION_EXPIRED";
        throw err;
      }

      if (isMobile) {
        document
          .getElementById("kwespay-mobileTransactionInstruction")
          ?.style.setProperty("display", "flex");
      }

      if (strictMobile) {
        await this._assertMobileChain(provider, targetChainId);
      } else {
        const rawChain = await provider.request({ method: "eth_chainId" });
        const currentChainId = parseInt(rawChain, 16);
        if (currentChainId !== targetChainId) {
          setStatus(
            "Switching network…",
            "Approve the network change in your wallet."
          );
          await this._switchNetworkSafe(
            targetChainId,
            this.state.selectedNetworkName,
            this.state.selectedRpcUrl,
            this.state.selectedToken,
            this.state.selectedTokenConfig.decimals
          );
        }
      }

      if (strictMobile) {
        setStatus(
          "Opening your wallet…",
          "Approve the payment in your wallet."
        );
        this.walletService._openWalletForApproval();
        await new Promise((r) => setTimeout(r, 700));
      } else {
        setStatus(
          "Waiting for approval…",
          "Confirm the transaction in your wallet."
        );
      }

      const receipt = await this.paymentService.createPayment({
        payload: this.state.currentPayload,
        walletProvider: provider,
        onStatusUpdate: setStatus,
      });

      document
        .getElementById("kwespay-mobileTransactionInstruction")
        ?.style.setProperty("display", "none");

      // On-chain tx is done — show confirming state and fire the legacy
      // paymentSuccess event so integrators that listen to it can update their UI.
      this._setProcessingView("confirming");

      const onChainPayload = {
        transactionReference: receipt.transactionReference,
        paymentIdBytes32: receipt.paymentIdBytes32,
        transactionHash: receipt.hash,
        transactionStatus: "pending",
        fiatAmount: this.config.amount,
        currency: this.config.currency,
        token: this.state.selectedToken,
        network: this.state.selectedNetwork,
      };

      dispatchWidgetEvent("paymentSuccess", onChainPayload);
      this.config.onPaymentSuccess?.(onChainPayload);

      // Wait for backend confirmation — always resolves, never throws outward
      const confirmed = await this._awaitBackendConfirmation(receipt);

      // Populate success sub-view
      const decimals = this.state.selectedTokenConfig?.decimals ?? 18;
      const sym = this.state.selectedToken;
      const payload = this.state.currentPayload;
      const totalBig = BigInt(payload.totalBaseUnits);
      const cryptoDisplay = `${formatUnits(totalBig, decimals)} ${sym}`;

      document.getElementById("kwespay-txHash").textContent = truncateHash(
        receipt.hash
      );
      document.getElementById(
        "kwespay-txFiatAmount"
      ).textContent = `${this.config.amount} ${this.config.currency}`;
      document.getElementById("kwespay-txCryptoAmount").textContent =
        cryptoDisplay;
      document.getElementById("kwespay-txNetwork").textContent =
        this.state.selectedNetworkName;
      document.getElementById("kwespay-explorerLink").href =
        NETWORK_CONFIGS[this.state.selectedNetwork].explorer + receipt.hash;

      this._setProcessingView("success");

      // transactionStatus is "completed" if backend confirmed, "unconfirmed" on timeout.
      // Both mean the on-chain tx is done — treat both as success.
      const finalStatus = confirmed?.transactionStatus ?? "completed";

      const finalPayload = {
        transactionReference: receipt.transactionReference,
        paymentIdBytes32: receipt.paymentIdBytes32,
        transactionHash: receipt.hash,
        transactionStatus: finalStatus,
        fiatAmount: this.config.amount,
        currency: this.config.currency,
        token: this.state.selectedToken,
        network: this.state.selectedNetwork,
      };

      // _finalisePayment fires the DOM event + callback (backward compat),
      // resolves the open() Promise, and closes the widget.
      this._finalisePayment(finalPayload);
    } catch (error) {
      document
        .getElementById("kwespay-mobileTransactionInstruction")
        ?.style.setProperty("display", "none");

      const errorType = getErrorType(error);
      let title = "Payment Failed";
      let message = getErrorMessage(error, { token: this.state.selectedToken });

      if (error.code === "SESSION_EXPIRED") {
        title = "Session Expired";
        message = error.message;
      } else if (error.code === "WRONG_NETWORK") {
        title = "Wrong Network";
        message = error.message;
      } else if (errorType === "USER_REJECTED") {
        title = "Transaction Cancelled";
        message = "You rejected the transaction in your wallet.";
      } else if (errorType === "INSUFFICIENT_BALANCE") {
        title = "Insufficient Balance";
      }

      this._showError(title, message);

      // _failPayment fires the DOM event + callback (backward compat) and
      // rejects the open() Promise.
      this._failPayment(message, errorType);
    }
  },

  _setProcessingView(view) {
    ["processing", "confirming", "success"].forEach((v) => {
      const el = document.getElementById(`kwespay-view-${v}`);
      if (el)
        el.style.display =
          v === view ? (v === "success" ? "flex" : "") : "none";
    });

    const dot = document.getElementById("kwespay-step4-dot");
    const title = document.getElementById("kwespay-step4-title");
    const secure = document.getElementById("kwespay-step4-secure");

    if (view === "success") {
      if (dot) {
        dot.style.background = "var(--kp-green)";
        dot.style.boxShadow = "0 0 8px rgba(16,185,129,0.4)";
        dot.style.animation = "none";
      }
      if (title) title.textContent = "Payment Complete";
      if (secure) secure.style.display = "flex";
    } else {
      if (dot) {
        dot.style.background = "var(--kp-accent)";
        dot.style.boxShadow = "0 0 8px var(--kp-accent-glow)";
        dot.style.animation = "";
      }
      if (title) title.textContent = "KwesPay Checkout";
      if (secure) secure.style.display = "none";
    }
  },

  // Polls backend for confirmation. Always resolves (never throws outward).
  // On timeout, fires the legacy paymentUnconfirmed DOM event so integrators
  // that need it can reconcile async on their backend.
  _awaitBackendConfirmation(receipt) {
    return this.paymentService
      .pollTransactionStatus(receipt.transactionReference, {
        intervalMs: 4000,
        maxAttempts: 15,
        onStatus: (status) => {
          const el = document.getElementById("kwespay-confirmingText");
          if (el) el.textContent = `Network status: ${status}…`;
        },
      })
      .catch((err) => {
        // Polling timed out — on-chain tx is done so proceed to success.
        // Fire paymentUnconfirmed for integrators that want async reconciliation.
        dispatchWidgetEvent("paymentUnconfirmed", {
          transactionReference: receipt.transactionReference,
          transactionHash: receipt.hash,
          reason: err.message,
        });
        this.config.onPaymentUnconfirmed?.({
          transactionReference: receipt.transactionReference,
          transactionHash: receipt.hash,
          reason: err.message,
        });
        return { transactionStatus: "unconfirmed" };
      });
  },

  async _assertMobileChain(provider, targetChainId) {
    const MAX_ATTEMPTS = 3;
    const DELAY_MS = 1000;

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      let currentChainId = null;
      try {
        const raw = await provider.request({ method: "eth_chainId" });
        currentChainId = parseInt(raw, 16);
      } catch {
        // RPC failed, will retry
      }

      if (currentChainId === targetChainId) return;
      if (attempt < MAX_ATTEMPTS)
        await new Promise((r) => setTimeout(r, DELAY_MS));
    }

    const err = new Error(
      `Please switch to ${this.state.selectedNetworkName} in your wallet and try again.`
    );
    err.code = "WRONG_NETWORK";
    throw err;
  },

  async _switchNetworkSafe(
    chainId,
    networkName,
    rpcUrl,
    tokenSymbol,
    tokenDecimals
  ) {
    const provider = this.walletService.getProvider();
    if (!provider) throw new Error("[WalletService] No provider connected");

    const toHex = (val) => {
      if (val == null) return null;
      try {
        const n =
          typeof val === "string"
            ? val.startsWith("0x")
              ? parseInt(val, 16)
              : parseInt(val, 10)
            : Number(val);
        return isNaN(n) ? null : "0x" + n.toString(16);
      } catch {
        return null;
      }
    };

    const targetHex = toHex(chainId);

    try {
      const currentHex = toHex(
        await provider.request({ method: "eth_chainId" })
      );
      if (currentHex && currentHex === targetHex) return;
    } catch {
      // Can't read current chain — proceed to switch anyway
    }

    try {
      await this.walletService.switchNetwork(
        chainId,
        networkName,
        rpcUrl,
        tokenSymbol,
        tokenDecimals
      );
    } catch (err) {
      if (err.code === 4001) throw err;
    }

    const POLL_MS = 500;
    const TIMEOUT_MS = 15_000;
    const started = Date.now();

    while (Date.now() - started < TIMEOUT_MS) {
      await new Promise((r) => setTimeout(r, POLL_MS));
      try {
        const currentHex = toHex(
          await provider.request({ method: "eth_chainId" })
        );
        if (currentHex && currentHex === targetHex) return;
      } catch {
        // Poll error — keep trying
      }
    }

    throw new Error(
      `Could not confirm network switch to ${networkName} after 15s. Please switch manually in your wallet and try again.`
    );
  },
};
