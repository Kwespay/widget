import { formatCryptoAmount } from "../../utils/helpers.js";

function formatUnits(rawBigInt, decimals) {
  const divisor = BigInt(10 ** decimals);
  const whole = rawBigInt / divisor;
  const remainder = rawBigInt % divisor;

  if (remainder === 0n) return `${whole}`;

  const fracFull = remainder.toString().padStart(decimals, "0");

  if (whole > 0n) {
    const frac = fracFull.slice(0, 4).replace(/0+$/, "");
    return frac ? `${whole}.${frac}` : `${whole}`;
  }

  let firstSig = -1;
  for (let i = 0; i < fracFull.length; i++) {
    if (fracFull[i] !== "0") {
      firstSig = i;
      break;
    }
  }
  if (firstSig === -1) return `${whole}`;

  const sigSlice = fracFull.slice(firstSig, firstSig + 4).replace(/0+$/, "");
  return `0.${fracFull.slice(0, firstSig) + sigSlice}`;
}

function _validateQuoteDecimals(
  amountBaseUnits,
  fiatAmount,
  decimals,
  usdPrice
) {
  try {
    if (!usdPrice || usdPrice <= 0) return { ok: true };
    const humanAmount = Number(BigInt(amountBaseUnits)) / 10 ** decimals;
    const impliedUsd = humanAmount * usdPrice;
    const ratio = impliedUsd / fiatAmount;
    if (ratio < 0.5 || ratio > 10) {
      return {
        ok: false,
        reason: `Amount sanity check failed: got ${humanAmount} (≈$${impliedUsd.toFixed(
          6
        )}) for $${fiatAmount} fiat.`,
      };
    }
    return { ok: true };
  } catch {
    return { ok: true };
  }
}

export const QuoteMethods = {
  async _loadReviewStep() {
    this._clearQuoteTimer();

    const cryptoLine = document.getElementById("kwespay-reviewCryptoLine");
    const timerEl = document.getElementById("kwespay-quoteTimer");
    const feeAmount = document.getElementById("kwespay-feePaymentAmount");
    const feePlatform = document.getElementById("kwespay-feePlatformFee");
    const feeVendor = document.getElementById("kwespay-feeVendorAmount");
    const proceedBtn = document.getElementById("kwespay-proceedToPayment");

    if (cryptoLine) {
      cryptoLine.textContent = "loading...";
      cryptoLine.classList.add("loading");
    }
    if (timerEl) timerEl.style.display = "none";
    if (proceedBtn) proceedBtn.disabled = true;

    try {
      const quote = await this.paymentService.getQuote({
        vendorIdentifier: this.config.vendorId,
        cryptoCurrency: this.state.selectedToken,
        fiatAmount: this.config.amount,
        fiatCurrency: this.config.currency,
        network: this.state.selectedNetwork,
      });

      const decimals = this.state.selectedTokenConfig?.decimals ?? 18;
      const sym = this.state.selectedToken;

      const check = _validateQuoteDecimals(
        quote.amountBaseUnits,
        this.config.amount,
        decimals,
        quote.usdPriceSnapshot
      );
      if (!check.ok) {
        console.error("[KwesPay] Quote sanity check failed:", check.reason);
        throw new Error(
          `Quote returned an implausible amount for ${sym}. Please contact support.`
        );
      }

      this.state.currentPayload = {
        ...quote,
        vendorIdentifier: this.config.vendorId,
        fiatAmount: this.config.amount,
        fiatCurrency: this.config.currency,
      };

      const fmt = (n) =>
        formatCryptoAmount(parseFloat(formatUnits(n, decimals)), sym);

      const amountBig = BigInt(quote.amountBaseUnits);
      const totalBig = BigInt(quote.totalBaseUnits);
      const feeBig = totalBig - amountBig;

      if (cryptoLine) {
        cryptoLine.textContent = fmt(totalBig);
        cryptoLine.classList.remove("loading");
      }
      if (feeAmount) feeAmount.textContent = fmt(totalBig);
      if (feePlatform) feePlatform.textContent = fmt(feeBig);
      if (feeVendor) feeVendor.textContent = fmt(amountBig);
      if (proceedBtn) proceedBtn.disabled = false;

      this._startQuoteTimer(quote.expiresAt);
    } catch (err) {
      console.error("[KwesPay] Quote fetch failed:", err.message);
      if (cryptoLine) {
        cryptoLine.textContent = "Could not load please try again.";
        cryptoLine.classList.remove("loading");
      }
      if (proceedBtn) proceedBtn.disabled = true;
    }
  },

  _startQuoteTimer(expiresAt) {
    const timerEl = document.getElementById("kwespay-quoteTimer");
    const timerText = document.getElementById("kwespay-quoteTimerText");
    if (!timerEl || !timerText) return;
    timerEl.style.display = "flex";

    const update = () => {
      const remaining = Math.max(0, new Date(expiresAt).getTime() - Date.now());
      const secs = Math.ceil(remaining / 1000);
      const mins = Math.floor(secs / 60);
      const s = secs % 60;

      timerText.textContent = `Quote expires in ${mins}:${String(s).padStart(
        2,
        "0"
      )}`;
      timerEl.className =
        "kp-quote-timer" +
        (secs <= 30 ? " urgent" : "") +
        (secs <= 0 ? " expired" : "");

      if (secs <= 0) {
        timerText.textContent = "Refreshing your rate...";
        const proceedBtn = document.getElementById("kwespay-proceedToPayment");
        if (proceedBtn) proceedBtn.disabled = true;
        this._clearQuoteTimer();
        this._loadReviewStep();
      }
    };

    update();
    this.state.quoteTimerInterval = setInterval(update, 1000);
  },

  _clearQuoteTimer() {
    if (this.state.quoteTimerInterval) {
      clearInterval(this.state.quoteTimerInterval);
      this.state.quoteTimerInterval = null;
    }
  },
};

export { formatUnits };
