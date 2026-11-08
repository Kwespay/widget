export const NavMethods = {
  _goToStep(stepNumber) {
    document
      .querySelectorAll(".kwespay-container .step")
      .forEach((s) => s.classList.remove("active", "exiting"));
    this._activateStep(stepNumber);
    this.state.currentStep = stepNumber;
  },

  _activateStep(stepNumber) {
    let targetStep;
    if (stepNumber === 0.5)
      targetStep = document.getElementById("kwespay-step0-invalid");
    else if (typeof stepNumber === "string")
      targetStep = document.getElementById(`kwespay-step-${stepNumber}`);
    else targetStep = document.getElementById(`kwespay-step${stepNumber}`);

    if (targetStep) {
      targetStep.classList.add("active");
    }
  },

  _removeCustomStep(id) {
    document.getElementById(id)?.remove();
  },

  _showError(title, message, { canRetry = true } = {}) {
    const titleEl = document.getElementById("kwespay-errorTitle");
    const msgEl = document.getElementById("kwespay-errorMessage");
    const hintEl = document.getElementById("kwespay-errorHintText");
    const retryEl = document.getElementById("kwespay-retryPayment");
    if (titleEl) titleEl.textContent = title ?? "Something went wrong";
    if (msgEl)
      msgEl.textContent =
        message ?? "An unexpected error occurred. Please try again.";
    if (hintEl)
      hintEl.textContent = canRetry
        ? "Your funds have not been charged. You can retry safely."
        : "Your wallet may already have sent this payment. Check it before paying again.";
    if (retryEl) retryEl.style.display = canRetry ? "" : "none";
    this._goToStep(5);
  },

  _reset() {
    this._clearQuoteTimer();
    this._stopReceiptCountdown();
    this._removeCustomStep("kwespay-step-wallet-picker");
    this._removeCustomStep("kwespay-step-sui-picker");
    this._removeCustomStep("kwespay-step-sui-connecting");
    this._removeCustomStep("kwespay-step-stellar-picker");
    this._removeCustomStep("kwespay-step-near-picker");
    this._removeCustomStep("kwespay-step-walletconnect");
    this._removeCustomStep("kwespay-step-resuming");
    this._removeCustomStep("kwespay-step-connecting");
    this._removeCustomStep("kwespay-step-outcome");
    this._ccStopPolling?.();
    this._ccRemoveSteps?.();
    if (this.suiWalletService?.isConnected()) {
      this.suiWalletService.disconnect();
    }
    this.stellarWalletService?.disconnect?.();
    this._disconnectNearWallet?.().catch?.(() => {});
    this._activeEvmTransport?.disconnect?.().catch?.(() => {});
    this._activeStellarTransport?.disconnect?.().catch?.(() => {});
    this._activeSuiTransport?.disconnect?.().catch?.(() => {});
    this._activeEvmTransport = null;
    this._activeStellarTransport = null;
    this._activeSuiTransport = null;
    try {
      localStorage.removeItem("WALLETCONNECT_DEEPLINK_CHOICE");
    } catch (_) {}
    this.state.selectedNetwork = null;
    this.state.selectedNetworkName = "";
    this.state.selectedNetworkConfig = null;
    this.state.selectedChainId = null;
    this.state.selectedRpcUrl = null;
    this.state.selectedContractAddress = null;
    this.state.selectedToken = null;
    this.state.selectedTokenConfig = null;
    this.state.currentQuote = null;
    this.state.currentPayload = null;
  },
};
