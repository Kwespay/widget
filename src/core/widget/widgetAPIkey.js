import { dispatchWidgetEvent } from "../../utils/helpers.js";
import { indexCatalog } from "../../config/catalog.js";

export const APIKeyMethods = {
  async _validateAPIKey(navigateOnSuccess = true) {
    if (this.config.paymentLink) return this._loadPaymentLink(navigateOnSuccess);
    try {
      const validation = await this.paymentService.validateAPIKey(
        this.config.vendorId
      );

      if (!validation.valid) {
        if (this._isCurrentInstance()) this._goToStep(0.5);
        dispatchWidgetEvent("apiKeyInvalid", {});
        return;
      }

      const vendorAuth = validation.scope?.isAuthorizedForVendor;
      if (vendorAuth === false) {
        dispatchWidgetEvent("apiKeyVendorMismatch", {
          vendorId: this.config.vendorId,
        });
      }

      this.state.vendorInfo = validation.vendorInfo;
      if (!this.config.vendorId) {
        this.config.vendorId = validation.vendorInfo?.vendorIdentifier ?? null;
      }
      if (!this.config.vendorId) {
        if (this._isCurrentInstance()) this._goToStep(0.5);
        dispatchWidgetEvent("apiKeyError", {
          error: "This API key can access more than one vendor. Pass vendorId to choose one.",
        });
        return;
      }
      this.state.keyAllowedNetworks = validation.allowedNetworks ?? null;
      this.state.keyAllowedTokens = validation.allowedTokens ?? null;

      try {
        const [merchantConfig, networks] = await Promise.all([
          this.paymentService.getMerchantConfig(this.config.vendorId),
          this.paymentService.getNetworks(),
        ]);

        this.state.merchantConfig = merchantConfig;
        this.state.catalog = indexCatalog(networks);
      } catch (configErr) {
        if (this._isCurrentInstance()) this._goToStep(0.5);
        dispatchWidgetEvent("apiKeyError", {
          error: `Could not load merchant configuration: ${configErr.message}`,
        });
        return;
      }

      if (navigateOnSuccess && this._isCurrentInstance()) {
        this._goToStep(1);
        this._renderNetworkList();
      }

      dispatchWidgetEvent("apiKeyValidated", {
        vendorInfo: this.state.vendorInfo,
        merchantConfig: this.state.merchantConfig,
      });
    } catch (err) {
      if (this._isCurrentInstance()) this._goToStep(0.5);
      dispatchWidgetEvent("apiKeyError", { error: err.message });
    }
  },
};
