import {
  DEFAULT_CONFIG,
  SUPPORTED_CURRENCIES,
  STABLECOIN_SYMBOLS,
} from "../config/constants.js";
import WalletService from "../services/walletService.js";
import PaymentService from "../services/paymentService.js";
import { dispatchWidgetEvent } from "../utils/helpers.js";

import { DomMethods } from "./widget/widgetDom.js";
import { NavMethods } from "./widget/widgetNav.js";
import { APIKeyMethods } from "./widget/widgetAPIkey.js";
import { NetworkMethods } from "./widget/widgetNetwork.js";
import { WalletMethods } from "./widget/widgetWallet.js";
import { QuoteMethods } from "./widget/widgetQuote.js";
import { PaymentMethods } from "./widget/widgetPayment.js";

function resolveAcceptedTokens(input) {
  if (!input) return null;
  if (input === "stablecoins") return STABLECOIN_SYMBOLS;
  if (Array.isArray(input) && input.length)
    return input.map((t) => t.toUpperCase());
  return null;
}

class KwesPayWidget {
  constructor(config) {
    if (!config.apiKey) throw new Error("[KwesPayWidget] apiKey is required");
    if (!config.vendorId)
      throw new Error("[KwesPayWidget] vendorId is required");
    if (!config.amount || parseFloat(config.amount) <= 0)
      throw new Error("[KwesPayWidget] Valid amount is required");

    this.config = {
      apiKey: config.apiKey,
      vendorId: config.vendorId,
      amount: parseFloat(config.amount),
      currency: config.currency || DEFAULT_CONFIG.currency,
      graphqlEndpoint: DEFAULT_CONFIG.graphqlEndpoint,
      acceptedTokens: resolveAcceptedTokens(config.acceptedTokens),
      // Legacy constructor callbacks — still supported for backward compat
      onPaymentSuccess: config.onPaymentSuccess ?? null,
      onPaymentConfirmed: config.onPaymentConfirmed ?? null,
      onPaymentUnconfirmed: config.onPaymentUnconfirmed ?? null,
      onPaymentError: config.onPaymentError ?? null,
    };

    if (!Object.values(SUPPORTED_CURRENCIES).includes(this.config.currency)) {
      throw new Error(
        `[KwesPayWidget] Unsupported currency: ${this.config.currency}`
      );
    }

    this.walletService = new WalletService();
    this.paymentService = new PaymentService(
      this.config.apiKey,
      this.config.graphqlEndpoint
    );

    this.state = {
      isOpen: false,
      currentStep: 0,
      selectedNetwork: null,
      selectedNetworkName: "",
      selectedChainId: null,
      selectedRpcUrl: null,
      selectedContractAddress: null,
      selectedToken: null,
      selectedTokenConfig: null,
      vendorInfo: null,
      keyAllowedNetworks: null,
      keyAllowedTokens: null,
      currentPayload: null,
      quoteTimerInterval: null,
      wcUri: null,
    };

    // Internal Promise machinery — reset each open() call
    this._paymentResolve = null;
    this._paymentReject = null;
    this._finalised = false;

    this._init();
  }

  open() {
    // Fresh promise + guard for every payment attempt
    this._finalised = false;
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


  _finalisePayment(payload) {
    if (this._finalised) return;
    this._finalised = true;

    // Legacy surface — still fires so existing DOM-event integrations keep working
    dispatchWidgetEvent("paymentConfirmed", payload);
    this.config.onPaymentConfirmed?.(payload);

    this._paymentResolve?.(payload);
    this.close();
  }


  _failPayment(message, errorType) {
    // Legacy surface
    const errorPayload = { error: message, errorType };
    dispatchWidgetEvent("paymentError", errorPayload);
    this.config.onPaymentError?.(errorPayload);

    const err = Object.assign(new Error(message), { code: errorType });
    this._paymentReject?.(err);
  }

  close() {
    const overlay = document.getElementById("kwespay-widget-overlay");
    const container = document.getElementById("kwespay-widget-container");
    if (!overlay || !container) return;

    this._clearQuoteTimer();
    const closedAfterSuccess = this.state.currentStep === 5;
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
    if (
      newCurrency &&
      Object.values(SUPPORTED_CURRENCIES).includes(newCurrency)
    ) {
      this.config.currency = newCurrency;
    }
    document
      .querySelectorAll(
        '[id*="paymentAmount"], [id*="summaryFiatAmount"], [id*="txFiatAmount"], [id*="reviewFiatAmount"]'
      )
      .forEach((el) => {
        el.textContent = `${this.config.amount} ${this.config.currency}`;
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
    this._clearQuoteTimer();
    document.body.classList.remove("kwespay-open");
    this.walletService?.disconnect();
    document.getElementById("kwespay-widget-overlay")?.remove();
    document.getElementById("kwespay-widget-styles")?.remove();

    // Reject the open() promise if destroy() is called mid-payment
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
  QuoteMethods,
  PaymentMethods
);

export default KwesPayWidget;
