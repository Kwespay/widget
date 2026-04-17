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

      const setStatus = (title, text) => {
        const titleEl = document.getElementById("kwespay-processingTitle");
        const textEl = document.getElementById("kwespay-processingText");
        if (titleEl) titleEl.textContent = title;
        if (textEl) textEl.textContent = text;
      };

      const isWC = this.walletService.connectionType === "walletconnect";
      const isMobile = this.walletService.isMobile();
      const strictMobile = isWC && isMobile; // mobile WC path — no network switching, no RPC shortcuts
      const provider = this.walletService.getProvider();
      const targetChainId = this.state.selectedChainId;

      if (!provider) throw new Error("No wallet provider");


      const alive = await this.walletService.isSessionAlive();
      if (!alive) {
        console.error(
          "[KwesPay] Session liveness check failed — session appears stale"
        );
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

        console.log("[KwesPay] Desktop chain check —", {
          currentChainId,
          targetChainId,
        });

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
          console.log("[KwesPay] Network switched");
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

     
      const decimals = this.state.selectedTokenConfig?.decimals ?? 6;
      const amountBig = BigInt(this.state.currentPayload.amountBaseUnits);
      const cryptoDisplay = `${formatUnits(amountBig, decimals)} ${
        this.state.selectedToken
      }`;

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

      this._goToStep(5);

      dispatchWidgetEvent("paymentSuccess", {
        transactionReference: receipt.transactionReference,
        paymentIdBytes32: receipt.paymentIdBytes32,
        transactionHash: receipt.hash,
        fiatAmount: this.config.amount,
        currency: this.config.currency,
        token: this.state.selectedToken,
        network: this.state.selectedNetwork,
      });
    } catch (error) {
      console.error(
        "[KwesPay] Payment error —",
        error.code ?? "UNKNOWN",
        ":",
        error.message
      );

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
      dispatchWidgetEvent("paymentError", { error: message, errorType });
    }
  },

  /**
   * Confirm the wallet is on the target chain before sending a transaction.
   * Retries up to 3 times with 1s delay to handle WC relay propagation lag.
   * Throws WRONG_NETWORK if the chain never matches.
   *
   * MOBILE WC ONLY — never call this on desktop/injected.
   */
  async _assertMobileChain(provider, targetChainId) {
    const MAX_ATTEMPTS = 3;
    const DELAY_MS = 1000;

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      let currentChainId = null;

      try {
        const raw = await provider.request({ method: "eth_chainId" });
        currentChainId = parseInt(raw, 16);
      } catch (err) {
        console.error(
          `[KwesPay] eth_chainId RPC failed (attempt ${attempt}/${MAX_ATTEMPTS}):`,
          err.message
        );
      }

      console.log(
        `[KwesPay] Chain check attempt ${attempt}/${MAX_ATTEMPTS} —`,
        { currentChainId, targetChainId }
      );

      if (currentChainId === targetChainId) {
        console.log("[KwesPay] Chain confirmed ✅", currentChainId);
        return;
      }

      if (attempt < MAX_ATTEMPTS) {
        await new Promise((r) => setTimeout(r, DELAY_MS));
      }
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
    const switchNetwork = this.walletService.switchNetwork;
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
    } catch (err) {
      console.warn(
        "[KwesPay] Could not read chainId before switch:",
        err.message
      );
    }

    try {
      await switchNetwork(
        chainId,
        networkName,
        rpcUrl,
        tokenSymbol,
        tokenDecimals
      );
    } catch (err) {
      if (err.code === 4001) throw err; // user rejected
      // Some wallets throw even on success — continue to verify below
      console.warn(
        "[KwesPay] switchNetwork threw (verifying anyway):",
        err.message
      );
    }

    // Poll until confirmed or 15s timeout
    const POLL_MS = 500;
    const TIMEOUT_MS = 15_000;
    const started = Date.now();

    while (Date.now() - started < TIMEOUT_MS) {
      await new Promise((r) => setTimeout(r, POLL_MS));
      try {
        const currentHex = toHex(
          await provider.request({ method: "eth_chainId" })
        );
        if (currentHex && currentHex === targetHex) {
          console.log(
            `[KwesPay] Network switch confirmed after ${
              Date.now() - started
            }ms ✅`
          );
          return;
        }
      } catch (err) {
        console.warn("[KwesPay] Poll eth_chainId error:", err.message);
      }
    }

    throw new Error(
      `Could not confirm network switch to ${networkName} after 15s. ` +
        `Please switch manually in your wallet and try again.`
    );
  },
};
