import {
  DEFAULT_CONFIG,
  API_ENDPOINTS,
  STABLECOIN_SYMBOLS,
} from "../config/constants.js";
import WalletService from "../services/walletService.js";
import PaymentService from "../services/paymentService.js";
import LinkPaymentService from "../services/linkPaymentService.js";
import {
  dispatchWidgetEvent,
  isCurrencyCode,
  resolveEnvironment,
} from "../utils/helpers.js";

import { DomMethods } from "./widget/widgetDom.js";
import { NavMethods } from "./widget/widgetNav.js";
import { APIKeyMethods } from "./widget/widgetAPIkey.js";
import { NetworkMethods } from "./widget/widgetNetwork.js";
import { WalletMethods } from "./widget/widgetWallet.js";
import { SuiWalletMethods } from "./widget/widgetSuiWallet.js";
import { StellarWalletMethods } from "./widget/widgetStellarWallet.js";
import { NearWalletMethods } from "./widget/widgetNearWallet.js";
import { WalletConnectUIMethods } from "./widget/widgetWalletConnect.js";
import { ResumeMethods } from "./widget/widgetResume.js";
import { clearResumeState } from "../utils/mobileResume.js";
import { QuoteMethods } from "./widget/widgetQuote.js";
import { PaymentMethods } from "./widget/widgetPayment.js";
import { LinkMethods } from "./widget/widgetLink.js";
import { CrossChainMethods } from "./widget/widgetCrossChain.js";

let _nextInstanceId = 1;

function resolveAcceptedTokens(input) {
  if (!input) return null;
  if (input === "stablecoins") return STABLECOIN_SYMBOLS;
  if (Array.isArray(input) && input.length)
    return input.map((t) => t.toUpperCase());
  return null;
}

function formatFiatDisplay(amount) {
  const num = parseFloat(amount);
  if (isNaN(num)) return "0.00";
  return num % 1 === 0
    ? num.toString()
    : parseFloat(num.toPrecision(10)).toString();
}

class KwesPayWidget {
  constructor(config) {
    const previewLink = config.previewLink && typeof config.previewLink === "object" ? config.previewLink : null;
    const paymentLink = previewLink
      ? String(previewLink.slug || "preview")
      : config.paymentLink ? String(config.paymentLink).trim().toLowerCase() : null;
    if (!paymentLink && !config.apiKey) throw new Error("[KwesPayWidget] apiKey is required");
    if (!paymentLink && (!config.amount || parseFloat(config.amount) <= 0))
      throw new Error("[KwesPayWidget] Valid amount is required");

    const suiNetworks = config.suiNetworks ?? undefined;
    const stellarNetworks = config.stellarNetworks ?? undefined;
    const nearNetworks = config.nearNetworks ?? undefined;

    const { endpoint, environment } = resolveEnvironment(
      { environment: config.environment ?? DEFAULT_CONFIG.environment, graphqlEndpoint: config.graphqlEndpoint },
      API_ENDPOINTS
    );

    this.config = {
      apiKey: config.apiKey ?? null,
      paymentLink,
      preview: !!previewLink,
      presentation: paymentLink && config.presentation === "page" ? "page" : "modal",
      customer: config.customer ?? null,
      linkAttemptKey: config.linkAttemptKey ?? null,
      vendorId: config.vendorId || null,
      orderId: config.orderId != null && String(config.orderId).trim() ? String(config.orderId).trim() : null,
      amount: parseFloat(config.amount) || 0,
      currency: String(config.currency || DEFAULT_CONFIG.currency).trim().toUpperCase(),
      environment,
      graphqlEndpoint: endpoint,
      projectId: config.projectId || DEFAULT_CONFIG.projectId,
      appName: config.appName || config.vendorName || "KwesPay",
      acceptedTokens: resolveAcceptedTokens(config.acceptedTokens),
      suiNetworks,
      stellarNetworks,
      nearNetworks,
      nearWallet: config.nearWallet ?? null,
      onPaymentSuccess: config.onPaymentSuccess ?? null,
      onPaymentConfirmed: config.onPaymentConfirmed ?? null,
      onPaymentUnconfirmed: config.onPaymentUnconfirmed ?? null,
      onPaymentError: config.onPaymentError ?? null,
      onPaymentFinalised: config.onPaymentFinalised ?? null,
    };

    if (
      this.config.orderId &&
      (this.config.orderId.length > 128 || /[\u0000-\u001f\u007f]/.test(this.config.orderId))
    ) {
      throw new Error("[KwesPayWidget] orderId must be 1-128 printable characters");
    }

    if (!paymentLink && !isCurrencyCode(this.config.currency)) {
      throw new Error(
        `[KwesPayWidget] currency must be an ISO 4217 code such as "USD" or "GHS", got "${this.config.currency}"`
      );
    }

    this.walletService = new WalletService();

    this.paymentService = paymentLink
      ? new LinkPaymentService(paymentLink, this.config.graphqlEndpoint, {
          idempotencyKey: this.config.linkAttemptKey,
          previewLink,
        })
      : new PaymentService(
          this.config.apiKey,
          this.config.suiNetworks,
          this.config.stellarNetworks,
          this.config.graphqlEndpoint,
          this.config.nearNetworks
        );

    this.suiWalletService = null;

    this.suiMobileTransport = null;

    this._activeSuiTransport = null;

    this._activeEvmTransport = null;

    this.stellarWalletService = null;

    this._activeStellarTransport = null;

    this.nearWalletService = null;

    this.state = {
      isOpen: false,
      currentStep: 0,
      selectedNetwork: null,
      selectedNetworkName: "",
      selectedNetworkConfig: null,
      selectedChainId: null,
      selectedRpcUrl: null,
      selectedContractAddress: null,
      selectedToken: null,
      selectedTokenConfig: null,
      vendorInfo: null,
      keyAllowedNetworks: null,
      keyAllowedTokens: null,
      merchantConfig: null,
      catalog: {},
      currentQuote: null,
      currentPayload: null,
      quoteTimerInterval: null,
      wcUri: null,
    };

    this._paymentResolve = null;
    this._paymentReject = null;
    this._finalised = false;
    this._lastFailure = null;
    this._broadcastPayment = null;
    this._receiptCountdownInterval = null;

    this._instanceId = String(_nextInstanceId++);

    this._init();
  }

  get _displayAmount() {
    return formatFiatDisplay(this.config.amount);
  }

  open() {
    this._finalised = false;
    this._lastFailure = null;
    this._broadcastPayment = null;
    this._paymentPromise = new Promise((resolve, reject) => {
      this._paymentResolve = resolve;
      this._paymentReject = reject;
    });

    const overlay = document.getElementById("kwespay-widget-overlay");
    const container = document.getElementById("kwespay-widget-container");
    if (overlay && container) {
      container.classList.remove("closing");
      overlay.classList.add("open");
      document.body.classList.add("kwespay-open");
      this.state.isOpen = true;
    }

    this._validateAPIKey();
    dispatchWidgetEvent("widgetOpened", {});

    return this._paymentPromise;
  }

  resume(flow) {
    this._finalised = false;
    this._lastFailure = null;
    this._broadcastPayment = null;
    this._paymentPromise = new Promise((resolve, reject) => {
      this._paymentResolve = resolve;
      this._paymentReject = reject;
    });

    const overlay = document.getElementById("kwespay-widget-overlay");
    const container = document.getElementById("kwespay-widget-container");
    if (overlay && container) {
      container.classList.remove("closing");
      overlay.classList.add("open");
      document.body.classList.add("kwespay-open");
      this.state.isOpen = true;
    }

    dispatchWidgetEvent("widgetOpened", { resumed: true });

    this._renderResumeConnectingStep();

    Promise.resolve(this._validateAPIKey(false))
      .then(() => this._resumeMobileFlow(flow))
      .catch(() => {});

    return this._paymentPromise;
  }

  _finalisePayment(result, autoClose = true) {
    if (this._finalised) return;
    this._finalised = true;
    this._broadcastPayment = null;

    const payload = { ...result, orderId: this.config.orderId };
    const status = payload.transactionStatus;
    dispatchWidgetEvent("paymentFinalised", payload);
    this.config.onPaymentFinalised?.(payload);

    if (status === "completed") {
      dispatchWidgetEvent("paymentConfirmed", payload);
      this.config.onPaymentConfirmed?.(payload);
    } else if (status !== "unconfirmed") {
      dispatchWidgetEvent("paymentIncomplete", payload);
    }

    this._paymentResolve?.(payload);

    if (autoClose) {
      this.close();
    }
  }

  _failPayment(message, errorType) {
    const errorPayload = { error: message, errorType };
    dispatchWidgetEvent("paymentError", errorPayload);
    this.config.onPaymentError?.(errorPayload);
    this._lastFailure = Object.assign(new Error(message), { code: errorType });
  }

  _settleOnClose() {
    if (this._finalised) return;
    if (this._broadcastPayment) {
      this._finalisePayment({ ...this._broadcastPayment, transactionStatus: "unconfirmed" }, false);
      return;
    }
    this._finalised = true;
    const failure =
      this._lastFailure ??
      Object.assign(new Error("Checkout closed before payment"), { code: "USER_CANCELLED" });
    this._paymentReject?.(failure);
  }

  close() {
    const overlay = document.getElementById("kwespay-widget-overlay");
    const container = document.getElementById("kwespay-widget-container");
    if (!overlay || !container) return;

    if (this.config.presentation === "page") {
      this._stopReceiptCountdown();
      this._clearQuoteTimer();
      clearResumeState();
      if (this.state.currentStep === 4) this._finishLinkPage();
      return;
    }

    this._stopReceiptCountdown();
    this._clearQuoteTimer();
    clearResumeState();

    const closedAfterSuccess = this.state.currentStep === 4;
    this._settleOnClose();
    const mobile = window.innerWidth <= 480;

    const finish = () => {
      overlay.classList.remove("open");
      document.body.classList.remove("kwespay-open");
      this.state.isOpen = false;
      dispatchWidgetEvent("widgetClosed", {
        completedPayment: closedAfterSuccess,
      });
    };

    if (mobile) {
      container.classList.add("closing");
      setTimeout(() => {
        container.classList.remove("closing");
        finish();
      }, 300);
    } else {
      finish();
    }
  }

  isOpen() {
    return this.state.isOpen;
  }

  updateAmount(newAmount, newCurrency) {
    const amount = parseFloat(newAmount);
    if (isNaN(amount) || amount <= 0) return;
    this.config.amount = amount;
    if (newCurrency && isCurrencyCode(newCurrency)) {
      this.config.currency = newCurrency.trim().toUpperCase();
    }
    const display = `${this._displayAmount} ${this.config.currency}`;
    document
      .querySelectorAll(
        '[id*="paymentAmount"], [id*="summaryFiatAmount"], [id*="txFiatAmount"], [id*="reviewFiatAmount"]'
      )
      .forEach((el) => {
        el.textContent = display;
      });
    dispatchWidgetEvent("amountUpdated", {
      amount: this.config.amount,
      currency: this.config.currency,
    });
  }

  getState() {
    return { ...this.state, config: { ...this.config } };
  }

  destroy() {
    this._stopReceiptCountdown();
    this._clearQuoteTimer();
    document.body.classList.remove("kwespay-open");

    this.walletService?.disconnect();
    if (this.suiWalletService?.isConnected()) {
      this.suiWalletService.disconnect();
    }

    if (this._activeSuiTransport?.isConnected()) {
      this._activeSuiTransport.disconnect();
    }

    if (this.stellarWalletService?.isConnected()) {
      this.stellarWalletService.disconnect();
    }

    if (this.nearWalletService?.isConnected() && !this.nearWalletService.hasExternalWallet()) {
      this.nearWalletService.disconnect();
    }

    document.getElementById("kwespay-widget-overlay")?.remove();
    document.getElementById("kwespay-widget-styles")?.remove();

    if (!this._finalised) {
      this._paymentReject?.(
        Object.assign(new Error("Widget destroyed"), {
          code: "WIDGET_DESTROYED",
        })
      );
    }

    this.state = null;
    this.config = null;
    this.walletService = null;
    this.suiWalletService = null;
    this.suiMobileTransport = null;
    this._activeSuiTransport = null;
    this._activeEvmTransport = null;
    this.stellarWalletService = null;
    this._activeStellarTransport = null;
    this.nearWalletService = null;
    this.paymentService = null;
    dispatchWidgetEvent("widgetDestroyed", {});
  }
}

Object.assign(
  KwesPayWidget.prototype,
  DomMethods,
  NavMethods,
  APIKeyMethods,
  NetworkMethods,
  WalletMethods,
  SuiWalletMethods,
  StellarWalletMethods,
  NearWalletMethods,
  WalletConnectUIMethods,
  ResumeMethods,
  QuoteMethods,
  PaymentMethods,
  LinkMethods,
  CrossChainMethods
);

export default KwesPayWidget;
