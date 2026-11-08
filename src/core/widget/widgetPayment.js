import {
  dispatchWidgetEvent,
  truncateHash,
  getErrorType,
  getErrorMessage,
  formatCryptoAmount,
  isMobileDevice,
} from "../../utils/helpers.js";
import { formatUnits } from "./widgetQuote.js";
import { icon } from "../../ui/icons.js";

const RECEIPT_DWELL_MS = 10_000;

export const PaymentMethods = {
  async _handlePaymentProcessing() {
    if (!this.state.currentQuote) {
      this._showError(
        "Payment Error",
        "Something went wrong. Please go back and try again."
      );
      return;
    }

    const ecosystem = this.state.selectedNetworkConfig?.ecosystem;

    if (ecosystem === "sui") {
      return this._handleSuiPaymentProcessing();
    }
    if (ecosystem === "stellar") {
      return this._handleStellarPaymentProcessing();
    }
    if (ecosystem === "near") {
      return this._handleNearPaymentProcessing();
    }
    return this._handleEvmPaymentProcessing();
  },

  async _handleEvmPaymentProcessing() {
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

      const isMobile = this.walletService.isMobile();
      const provider = this.walletService.getProvider();
      const targetChainId = this.state.selectedChainId;

      if (!provider) {
        throw Object.assign(
          new Error(
            "No wallet provider available. Please reconnect your wallet."
          ),
          { code: "NO_PROVIDER" }
        );
      }

      const alive = await this.walletService
        .isSessionAlive()
        .catch(() => false);
      if (!alive) {
        await this.walletService.disconnect().catch(() => {});
        throw Object.assign(
          new Error(
            "Your wallet session expired. Please reconnect your wallet."
          ),
          { code: "SESSION_EXPIRED" }
        );
      }

      if (isMobile) {
        document
          .getElementById("kwespay-mobileTransactionInstruction")
          ?.style.setProperty("display", "flex");
      }

      let rawChain;
      try {
        rawChain = await provider.request({ method: "eth_chainId" });
      } catch {
        throw Object.assign(
          new Error(
            "Could not read the current network from your wallet. Please try again."
          ),
          { code: "NETWORK_ERROR" }
        );
      }
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
          this.state.selectedNetworkConfig?.nativeSymbol ?? "ETH",
          18
        );
      }

      setStatus(
        "Waiting for approval…",
        "Confirm the transaction in your wallet."
      );

      const enrichedPayload = await this._prepareTransaction(setStatus, provider);

      let receipt;
      try {
        receipt = await this.paymentService.createPayment({
          payload: enrichedPayload,
          walletProvider: provider,
          onStatusUpdate: setStatus,
        });
      } catch (payErr) {
        throw Object.assign(
          new Error(
            payErr?.message ?? "Payment submission failed. Please try again."
          ),
          { code: payErr?.code ?? "CONTRACT_ERROR", original: payErr }
        );
      }

      if (!receipt?.hash) {
        throw Object.assign(
          new Error(
            "Transaction was submitted but no hash was returned. Check your wallet for status."
          ),
          { code: "MISSING_HASH" }
        );
      }

      document
        .getElementById("kwespay-mobileTransactionInstruction")
        ?.style.setProperty("display", "none");

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
      this._broadcastPayment = onChainPayload;

      this._setProcessingView("confirming");
      setStatus("Confirming payment…", "Waiting for network confirmation.");

      const confirmed = await this._awaitBackendConfirmation(receipt);
      this._completeWithStatus(receipt, onChainPayload, confirmed);
    } catch (error) {
      document
        .getElementById("kwespay-mobileTransactionInstruction")
        ?.style.setProperty("display", "none");
      this._handlePaymentError(error);
    }
  },

  async _handleSuiPaymentProcessing() {
    const popupBridge = this._openSlushPopupBridge();
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

      const suiReady =
        this._activeSuiTransport?.isConnected() ||
        this.suiWalletService?.isConnected();

      if (!suiReady) {
        throw Object.assign(
          new Error(
            "Sui wallet is not connected. Please reconnect and try again."
          ),
          { code: "NO_PROVIDER" }
        );
      }

      setStatus(
        "Waiting for approval…",
        "Confirm the transaction in your wallet."
      );

      const walletAdapter = this._getSuiAdapter();

      const enrichedPayload = await this._prepareTransaction(setStatus, null);

      let receipt;
      try {
        receipt = await this.paymentService.createSuiPayment({
          payload: enrichedPayload,
          wallet: walletAdapter,
          onStatusUpdate: setStatus,
        });
      } catch (payErr) {
        throw Object.assign(
          new Error(
            payErr?.message ?? "Payment submission failed. Please try again."
          ),
          { code: payErr?.code ?? "CONTRACT_ERROR", original: payErr }
        );
      }

      if (!receipt?.hash) {
        throw Object.assign(
          new Error(
            "Transaction was submitted but no digest was returned. Check your wallet for status."
          ),
          { code: "MISSING_HASH" }
        );
      }

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
      this._broadcastPayment = onChainPayload;

      this._setProcessingView("confirming");
      setStatus("Confirming payment…", "Waiting for network confirmation.");

      const confirmed = await this._awaitBackendConfirmation(receipt);
      this._completeWithStatus(receipt, onChainPayload, confirmed);
    } catch (error) {
      this._handlePaymentError(error);
    } finally {
      popupBridge?.release();
    }
  },

  _openSlushPopupBridge() {
    const wallet = this.suiWalletService?.getWallet?.();
    const usingSlushWeb =
      isMobileDevice() &&
      !this._activeSuiTransport?.isConnected?.() &&
      this.suiWalletService?.isConnected?.() &&
      /slush/i.test(wallet?.name ?? "");
    if (!usingSlushWeb) return null;

    let pre = null;
    try {
      pre = window.open("", "_blank");
    } catch (_) {
      return null;
    }
    if (!pre) return null;

    try {
      pre.document.write(
        '<!doctype html><title>Slush</title><body style="background:#0b0b0f;color:#8b8b99;font-family:system-ui;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;font-size:14px">Preparing your Slush approval…</body>'
      );
    } catch (_) {}

    const originalOpen = window.open;
    let used = false;
    window.open = function (url, target, features) {
      if (!used && (url === "about:blank" || url === "" || url == null)) {
        used = true;
        window.open = originalOpen;
        return pre;
      }
      return originalOpen.call(window, url, target, features);
    };

    return {
      release: () => {
        if (window.open !== originalOpen) window.open = originalOpen;
        if (!used) {
          try {
            pre.close();
          } catch (_) {}
        }
      },
    };
  },


  async _handleStellarPaymentProcessing() {
    let watchdogTimer = null;
    let reassureTimers = [];
    let tripWatchdog = () => {};
    const watchdogPromise = new Promise((_, reject) => {
      tripWatchdog = reject;
    });
    const clearWatchdog = () => {
      if (watchdogTimer) clearTimeout(watchdogTimer);
      reassureTimers.forEach(clearTimeout);
      watchdogTimer = null;
      reassureTimers = [];
    };

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

      const armWatchdog = () => {
        clearWatchdog();
        reassureTimers.push(
          setTimeout(
            () =>
              setStatus(
                "Waiting for confirmation",
                "Still confirming on the network — hang tight…"
              ),
            20_000
          )
        );
        reassureTimers.push(
          setTimeout(
            () =>
              setStatus(
                "Waiting for confirmation",
                "Almost there — this can take a minute or two…"
              ),
            75_000
          )
        );
        watchdogTimer = setTimeout(() => {
          tripWatchdog(
            Object.assign(
              new Error(
                "The network is taking too long to confirm. If the payment already left your wallet, do NOT retry — check the transaction in your wallet first, or contact support."
              ),
              { code: "TIMEOUT" }
            )
          );
        }, 180_000);
      };

      const guardedSetStatus = (title, text) => {
        setStatus(title, text);
        if (/waiting for confirmation/i.test(title ?? "")) armWatchdog();
        else clearWatchdog();
      };

      const stellarReady =
        this._activeStellarTransport?.isConnected() ||
        this.stellarWalletService?.isConnected();

      if (!stellarReady) {
        throw Object.assign(
          new Error(
            "Stellar wallet is not connected. Please reconnect and try again."
          ),
          { code: "NO_PROVIDER" }
        );
      }

      setStatus(
        "Waiting for approval…",
        "Confirm the transaction in your wallet."
      );

      const walletAdapter = this._getStellarAdapter();

      const enrichedPayload = await this._prepareTransaction(guardedSetStatus, null);

      let receipt;
      try {
        receipt = await Promise.race([
          this.paymentService.createStellarPayment({
            payload: enrichedPayload,
            wallet: walletAdapter,
            onStatusUpdate: guardedSetStatus,
          }),
          watchdogPromise,
        ]);
      } catch (payErr) {
        if (payErr?.code === "TIMEOUT") throw payErr;
        throw Object.assign(
          new Error(
            payErr?.message ?? "Payment submission failed. Please try again."
          ),
          { code: payErr?.code ?? "CONTRACT_ERROR", original: payErr }
        );
      } finally {
        clearWatchdog();
      }

      if (!receipt?.hash) {
        throw Object.assign(
          new Error(
            "Transaction was submitted but no hash was returned. Check your wallet for status."
          ),
          { code: "MISSING_HASH" }
        );
      }

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
      this._broadcastPayment = onChainPayload;

      this._setProcessingView("confirming");
      setStatus("Confirming payment…", "Waiting for network confirmation.");

      const confirmed = await this._awaitBackendConfirmation(receipt);
      this._completeWithStatus(receipt, onChainPayload, confirmed);
    } catch (error) {
      this._handlePaymentError(await this._refineStellarTrustlineError(error));
    }
  },

  async _refineStellarTrustlineError(error) {
    try {
      if (getErrorType(error) !== "MISSING_TRUSTLINE") return error;
      const token = this.state.selectedToken;
      const payer = this.state.payerWalletAddress;
      if (!token || token === "XLM" || !payer) return error;

      const horizon =
        this.state.selectedNetworkConfig?.type === "testnet"
          ? "https://horizon-testnet.stellar.org"
          : "https://horizon.stellar.org";
      const res = await fetch(`${horizon}/accounts/${payer}`, {
        signal: AbortSignal.timeout?.(8000),
      });
      if (!res.ok) return error;
      const account = await res.json();
      const hasTrustline = (account.balances ?? []).some(
        (b) => b.asset_code?.toUpperCase() === token.toUpperCase()
      );
      if (!hasTrustline) return error;

      return Object.assign(
        new Error(
          `This merchant can't accept ${token} payments right now — the receiving account isn't set up for ${token}. Please pay with a different token, or contact the merchant.`
        ),
        { code: "RECIPIENT_TRUSTLINE", original: error }
      );
    } catch (_) {
      return error;
    }
  },

  _getSuiAdapter() {
    if (this._activeSuiTransport?.isConnected()) {
      return this._activeSuiTransport.getSuiWalletAdapter();
    }
    return this.suiWalletService.getSuiWalletAdapter();
  },

  _getStellarAdapter() {
    if (this._activeStellarTransport?.isConnected()) {
      return this._activeStellarTransport.getStellarWalletAdapter();
    }
    return this.stellarWalletService.getStellarWalletAdapter();
  },

  async _prepareTransaction(setStatus, provider) {
    const quote = this.state.currentQuote;
    const payerWalletAddress = this.state.payerWalletAddress ?? "";

    if (provider) {
      setStatus("Checking balance…", "Making sure your wallet can cover this payment.");
      await this.paymentService.checkBalance({ quote, payerWalletAddress, provider });
    }

    setStatus("Preparing payment…", "Locking in your rate with KwesPay.");
    const payload = await this.paymentService.createTransaction({
      quote,
      vendorId: this.config.vendorId,
      payerWalletAddress,
    });
    this.state.currentPayload = payload;
    setStatus("Waiting for approval…", "Confirm the transaction in your wallet.");
    return payload;
  },

  _completeWithStatus(receipt, onChainPayload, confirmed) {
    const status = confirmed?.transactionStatus ?? "unconfirmed";
    const payload = { ...onChainPayload, transactionStatus: status };
    this._renderReceiptUI(receipt, confirmed);

    if (status === "completed") {
      this._setProcessingView("success");
      this._startReceiptCountdown(RECEIPT_DWELL_MS);
    } else {
      this._showOutcome(status, receipt);
    }

    this._finalisePayment(payload, false);
  },

  _showOutcome(status, receipt) {
    const outcomes = {
      underpaid: {
        title: "Payment Needs Review",
        headline: "Less than the quoted amount arrived",
        message: "KwesPay recorded your payment, but it was short of the quoted amount. The merchant will review it. Keep your reference and do not pay again.",
      },
      overpaid: {
        title: "Payment Received",
        headline: "More than the quoted amount arrived",
        message: "KwesPay recorded your payment. It was more than the quoted amount, and the merchant will review the difference.",
      },
      failed: {
        title: "Payment Not Verified",
        headline: "This payment could not be verified",
        message: "The transaction did not match this checkout. Do not pay again. Contact the merchant with your reference.",
      },
      expired: {
        title: "Payment Window Closed",
        headline: "KwesPay did not record this payment in time",
        message: "If funds left your wallet, contact the merchant with your reference before paying again.",
      },
      refunded: {
        title: "Payment Refunded",
        headline: "This payment was refunded",
        message: "The merchant has recorded a refund for this payment.",
      },
      unconfirmed: {
        title: "Still Confirming",
        headline: "Your payment is still being confirmed",
        message: "Your transaction was sent, but the network has not confirmed it yet. You can close this window. Do not pay again; the merchant will see the payment once it confirms.",
      },
    };
    const outcome = outcomes[status] ?? outcomes.unconfirmed;
    const explorer = this._networkConfig(this.state.selectedNetwork)?.explorer;

    this._removeCustomStep("kwespay-step-outcome");
    const container = document.getElementById("kwespay-widget-container");
    const step = document.createElement("div");
    step.className = "step";
    step.id = "kwespay-step-outcome";
    step.innerHTML = `
      <div class="kp-topbar">
        <div class="kp-topbar-brand">
          <div class="kp-topbar-dot" style="background:var(--kp-muted);box-shadow:none;animation:none"></div>
          <span class="kp-topbar-name"></span>
        </div>
      </div>
      <div class="loading-container" style="flex:1">
        <div class="error-icon" style="color:var(--kp-muted)">${icon("info")}</div>
        <h2 class="headline"></h2>
        <p class="body-text" data-outcome-message></p>
        <div class="tx-details">
          <div class="tx-row">
            <span class="tx-label">Reference</span>
            <span class="tx-value" data-outcome-reference></span>
          </div>
          <div class="tx-row">
            <span class="tx-label">Tx hash</span>
            <div class="tx-hash-row">
              <span class="tx-value" data-outcome-hash></span>
              ${explorer ? `<a class="explorer-link" data-outcome-explorer target="_blank" rel="noopener noreferrer">${icon("open_in_new")}</a>` : ""}
            </div>
          </div>
        </div>
      </div>
      <div class="bottom-action">
        <button class="action-btn" data-outcome-close>Close</button>
      </div>
    `;
    step.querySelector(".kp-topbar-name").textContent = outcome.title;
    step.querySelector(".headline").textContent = outcome.headline;
    step.querySelector("[data-outcome-message]").textContent = outcome.message;
    step.querySelector("[data-outcome-reference]").textContent = receipt.transactionReference ?? "—";
    step.querySelector("[data-outcome-hash]").textContent = truncateHash(receipt.hash);
    const explorerLink = step.querySelector("[data-outcome-explorer]");
    if (explorerLink) explorerLink.href = explorer + receipt.hash;
    step.querySelector("[data-outcome-close]").addEventListener("click", () => this.close());
    container.appendChild(step);
    this._goToStep("outcome");
  },

  _renderReceiptUI(receipt, confirmed) {
    const decimals = this.state.selectedTokenConfig?.decimals ?? 18;
    const sym = this.state.selectedToken;
    const payload = this.state.currentPayload;
    const totalBig = BigInt(payload.totalBaseUnits ?? "0");
    const cryptoDisplay = formatCryptoAmount(
      parseFloat(formatUnits(totalBig, decimals)),
      sym
    );

    const now = new Date();
    const timeString = now.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
    const dateString = now.toLocaleDateString([], {
      month: "short",
      day: "numeric",
      year: "numeric",
    });

    const setEl = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.textContent = val;
    };

    setEl("kwespay-txHash", truncateHash(receipt.hash));
    setEl(
      "kwespay-txFiatAmount",
      `${this.config.amount} ${this.config.currency}`
    );
    setEl("kwespay-txCryptoAmount", cryptoDisplay);
    setEl("kwespay-txNetwork", this.state.selectedNetworkName);
    setEl("kwespay-txRef", receipt.transactionReference ?? "—");
    setEl("kwespay-txTime", `${dateString} · ${timeString}`);

    const explorerLink = document.getElementById("kwespay-explorerLink");
    if (explorerLink) {
      explorerLink.href =
        (this._networkConfig(this.state.selectedNetwork)?.explorer ?? "") +
        receipt.hash;
    }
  },

  _handlePaymentError(error) {
    const errorType = getErrorType(error);

    let message = getErrorMessage(error, { token: this.state.selectedToken });

    const codeTitles = {
      SESSION_EXPIRED: "Session Expired",
      NO_PROVIDER: "Wallet Disconnected",
      NETWORK_ERROR: "Network Error",
      MISSING_HASH: "Payment Status Unknown",
      TIMEOUT: "Taking Too Long",
      RECIPIENT_TRUSTLINE: "Token Not Accepted",
    };
    const typeTitles = {
      USER_REJECTED: "Transaction Cancelled",
      MISSING_TRUSTLINE: "Trustline Required",
      SESSION_EXPIRED: "Wallet Disconnected",
      POPUP_BLOCKED: "Wallet Window Blocked",
      EXPIRED: "Quote Expired",
      INSUFFICIENT_BALANCE: "Insufficient Balance",
      CONNECTION_REJECTED: "Connection Cancelled",
      TIMEOUT: "Request Timed Out",
      CONTRACT_FAILURE: "Payment Failed",
      NETWORK: "Network Error",
    };

    let title = "Payment Failed";
    if (codeTitles[error?.code]) {
      title = codeTitles[error.code];
      if (error?.message) message = error.message;
    } else if (typeTitles[errorType]) {
      title = typeTitles[errorType];
    }

    const mayHaveSent =
      Boolean(this._broadcastPayment) || ["MISSING_HASH", "TIMEOUT"].includes(error?.code);
    this._showError(title, message, { canRetry: !mayHaveSent });
    this._failPayment(message, error?.code && !codeTitles[error.code] ? error.code : errorType);
  },

  _setProcessingView(view) {
    ["processing", "confirming", "success"].forEach((v) => {
      const el = document.getElementById(`kwespay-view-${v}`);
      if (!el) return;
      el.style.display = v === view ? (v === "success" ? "flex" : "") : "none";
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
      if (title) title.textContent = this._brandTitle();
      if (secure) secure.style.display = "none";
    }
  },

  _startReceiptCountdown(totalMs) {
    this._stopReceiptCountdown();
    const totalSec = Math.round(totalMs / 1000);
    let remaining = totalSec;
    const countdownEl = document.getElementById("kwespay-receiptCountdown");
    const barEl = document.getElementById("kwespay-receiptCountdownBar");

    const update = () => {
      if (countdownEl)
        countdownEl.textContent =
          remaining > 0 ? `Closing in ${remaining}s` : "Closing…";
      if (barEl) {
        barEl.style.width = `${(remaining / totalSec) * 100}%`;
        barEl.style.background =
          remaining <= 3 ? "var(--kp-green)" : "var(--kp-accent)";
      }
    };

    update();
    this._receiptCountdownInterval = setInterval(() => {
      remaining -= 1;
      update();
      if (remaining <= 0) {
        this._stopReceiptCountdown();
        this.close();
      }
    }, 1000);
  },

  _stopReceiptCountdown() {
    if (this._receiptCountdownInterval) {
      clearInterval(this._receiptCountdownInterval);
      this._receiptCountdownInterval = null;
    }
  },

  _awaitBackendConfirmation(receipt) {
    return this.paymentService
      .pollTransactionStatus(receipt.transactionReference, {
        intervalMs: 2000,
        maxAttempts: 150,
        onStatus: (status) => {
          const el = document.getElementById("kwespay-confirmingText");
          if (el) el.textContent = `Network status: ${status}…`;
        },
      })
      .catch((err) => {
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
    } catch {}

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
      } catch {}
    }

    throw new Error(
      `Could not confirm network switch to ${networkName} after 15s. Please switch manually in your wallet and try again.`
    );
  },
};
