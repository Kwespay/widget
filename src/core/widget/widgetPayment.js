import { NETWORK_CONFIGS } from "../../config/constants.js";
import {
  dispatchWidgetEvent,
  truncateHash,
  getErrorType,
  getErrorMessage,
  formatCryptoAmount,
} from "../../utils/helpers.js";
import { formatUnits } from "./widgetQuote.js";

const RECEIPT_DWELL_MS = 10_000;

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

      if (!provider) {
        throw Object.assign(
          new Error(
            "No wallet provider available. Please reconnect your wallet."
          ),
          {
            code: "NO_PROVIDER",
          }
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

      if (strictMobile) {
        await this._assertMobileChain(provider, targetChainId);
      } else {
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

      let receipt;
      try {
        receipt = await this.paymentService.createPayment({
          payload: this.state.currentPayload,
          walletProvider: provider,
          onStatusUpdate: setStatus,
        });
      } catch (payErr) {
        const msg =
          payErr?.message ?? "Payment submission failed. Please try again.";
        throw Object.assign(new Error(msg), {
          code: payErr?.code ?? "CONTRACT_ERROR",
          original: payErr,
        });
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

      const confirmed = await this._awaitBackendConfirmation(receipt);

      const decimals = this.state.selectedTokenConfig?.decimals ?? 18;
      const sym = this.state.selectedToken;
      const payload = this.state.currentPayload;
      const totalBig = BigInt(payload.totalBaseUnits);
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
          (NETWORK_CONFIGS[this.state.selectedNetwork]?.explorer ?? "") +
          receipt.txHash;
      }

      this._setProcessingView("success");
      this._startReceiptCountdown(RECEIPT_DWELL_MS);

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

      this._finalisePayment(finalPayload, false);
    } catch (error) {
      document
        .getElementById("kwespay-mobileTransactionInstruction")
        ?.style.setProperty("display", "none");

      const errorType = getErrorType(error);
      let title = "Payment Failed";
      let message = getErrorMessage(error, { token: this.state.selectedToken });

      switch (error.code) {
        case "SESSION_EXPIRED":
          title = "Session Expired";
          message = error.message;
          break;
        case "NO_PROVIDER":
          title = "Wallet Disconnected";
          message = error.message;
          break;
        case "NETWORK_ERROR":
          title = "Network Error";
          message = error.message;
          break;
        case "WRONG_NETWORK":
          title = "Wrong Network";
          message = error.message;
          break;
        case "MISSING_HASH":
          title = "Unknown Transaction Status";
          message = error.message;
          break;
        default:
          if (errorType === "USER_REJECTED") {
            title = "Transaction Cancelled";
            message = "You rejected the transaction in your wallet.";
          } else if (errorType === "INSUFFICIENT_BALANCE") {
            title = "Insufficient Balance";
          } else if (!message) {
            message =
              "An unexpected error occurred. Please try again or contact support.";
          }
      }

      console.error("[KwesPayWidget] Payment error:", {
        title,
        message,
        code: error.code,
        error,
      });

      this._showError(title, message);
      this._failPayment(message, errorType);
    }
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
      if (title) title.textContent = "KwesPay Checkout";
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
      if (countdownEl) {
        countdownEl.textContent =
          remaining > 0 ? `Closing in ${remaining}s` : "Closing…";
      }
      if (barEl) {
        const pct = (remaining / totalSec) * 100;
        barEl.style.width = `${pct}%`;
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
        intervalMs: 4000,
        maxAttempts: 15,
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

  async _assertMobileChain(provider, targetChainId) {
    const MAX_ATTEMPTS = 3;
    const DELAY_MS = 1000;

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      let currentChainId = null;
      try {
        const raw = await provider.request({ method: "eth_chainId" });
        currentChainId = parseInt(raw, 16);
      } catch {}

      if (currentChainId === targetChainId) return;
      if (attempt < MAX_ATTEMPTS)
        await new Promise((r) => setTimeout(r, DELAY_MS));
    }

    throw Object.assign(
      new Error(
        `Please switch to ${this.state.selectedNetworkName} in your wallet and try again.`
      ),
      { code: "WRONG_NETWORK" }
    );
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
      `Could not confirm network switch to ${networkName} after 15s. ` +
        `Please switch manually in your wallet and try again.`
    );
  },
};
