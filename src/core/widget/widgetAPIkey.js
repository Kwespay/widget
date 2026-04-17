import { dispatchWidgetEvent } from "../../utils/helpers.js";

export const APIKeyMethods = {
  async _validateAPIKey() {
    try {
      const validation = await this.paymentService.validateAPIKey();
      if (validation.valid) {
        this.state.vendorInfo = validation.vendorInfo;
        this.state.keyAllowedNetworks = validation.allowedNetworks ?? null;
        this.state.keyAllowedTokens = validation.allowedTokens ?? null;
        this._goToStep(1);
        dispatchWidgetEvent("apiKeyValidated", {
          vendorInfo: this.state.vendorInfo,
        });
      } else {
        this._goToStep(0.5);
        dispatchWidgetEvent("apiKeyInvalid", {});
      }
    } catch (err) {
      console.error("[KwesPayWidget] API key validation error:", err.message);
      this._goToStep(0.5);
      dispatchWidgetEvent("apiKeyError", { error: err.message });
    }
  },
};
