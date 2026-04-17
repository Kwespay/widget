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

    if (targetStep) targetStep.classList.add("active");
    else console.warn(`[KwesPayWidget] Step not found: ${stepNumber}`);
  },

  _removeCustomStep(id) {
    document.getElementById(id)?.remove();
  },

  _showError(title, message) {
    const titleEl = document.getElementById("kwespay-errorTitle");
    const msgEl = document.getElementById("kwespay-errorMessage");
    if (titleEl) titleEl.textContent = title;
    if (msgEl) msgEl.textContent = message;
    this._goToStep(6);
  },

  _reset() {
    this._clearQuoteTimer();
    this._removeCustomStep("kwespay-step-wallet-picker");
    this._removeCustomStep("kwespay-step-wc");
    this.state.selectedNetwork = null;
    this.state.selectedNetworkName = "";
    this.state.selectedChainId = null;
    this.state.selectedRpcUrl = null;
    this.state.selectedContractAddress = null;
    this.state.selectedToken = null;
    this.state.selectedTokenConfig = null;
    this.state.currentPayload = null;
    this.state.wcUri = null;
  },
};
