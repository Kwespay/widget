import { WIDGET_STYLES } from "../../ui/styles.js";
import { getStepTemplates } from "../../ui/template.js";
import { dispatchWidgetEvent } from "../../utils/helpers.js";

export const DomMethods = {
  _init() {
    this._injectFonts();
    this._injectStyles();
    this._createWidgetDOM();
  },

  _isCurrentInstance() {
    const overlay = document.getElementById("kwespay-widget-overlay");
    return !!overlay && overlay.dataset.kwespayInstance === this._instanceId;
  },

  _injectFonts() {
    if (document.getElementById("kwespay-widget-fonts")) return;
    const style = document.createElement("style");
    style.id = "kwespay-widget-fonts";
    document.head.appendChild(style);
    import("../../ui/interFont.js")
      .then(({ INTER_FONT_FACE }) => {
        style.textContent = INTER_FONT_FACE;
      })
      .catch(() => {});
  },

  _injectStyles() {
    if (!document.getElementById("kwespay-widget-styles")) {
      const style = document.createElement("style");
      style.id = "kwespay-widget-styles";
      style.textContent = WIDGET_STYLES;
      document.head.appendChild(style);
    }
  },

  _createWidgetDOM() {
    document.getElementById("kwespay-widget-overlay")?.remove();

    const overlay = document.createElement("div");
    overlay.className = "kwespay-overlay";
    overlay.id = "kwespay-widget-overlay";
    overlay.dataset.kwespayInstance = this._instanceId;
    if (this.config.presentation === "page") {
      overlay.classList.add("kp-page");
      document.body.classList.add("kwespay-page");
    }

    const container = document.createElement("div");
    container.className = "kwespay-container";
    container.id = "kwespay-widget-container";

    const closeBtn = document.createElement("button");
    closeBtn.className = "kwespay-close-btn";
    closeBtn.innerHTML = "×";
    closeBtn.onclick = () => this.close();
    if (this.config.presentation !== "page") container.appendChild(closeBtn);

    const stepsWrapper = document.createElement("div");
    stepsWrapper.className = "kwespay-steps-wrapper";
    stepsWrapper.innerHTML = getStepTemplates(
      this._displayAmount,
      this.config.currency
    );
    container.appendChild(stepsWrapper);

    overlay.appendChild(container);
    overlay.addEventListener(
      "error",
      (event) => {
        const img = event.target;
        if (!(img instanceof HTMLImageElement)) return;
        const initial = img.dataset.kpFallback;
        if (initial === undefined) {
          img.style.display = "none";
          return;
        }
        const span = document.createElement("span");
        span.className = "kp-logo-fallback";
        span.textContent = initial;
        img.replaceWith(span);
      },
      true
    );
    document.body.appendChild(overlay);

    this._setupEventListeners();
    if (this.config.presentation !== "page") this._setupSwipeToClose(container);
  },

  _setupSwipeToClose(container) {
    let _touchStartY = 0,
      _touchCurrentY = 0,
      _isDragging = false;

    container.addEventListener(
      "touchstart",
      (e) => {
        const touch = e.touches[0];
        const offset = touch.clientY - container.getBoundingClientRect().top;
        if (offset <= 40) {
          _touchStartY = touch.clientY;
          _touchCurrentY = touch.clientY;
          _isDragging = true;
          container.style.transition = "none";
        }
      },
      { passive: true }
    );

    container.addEventListener(
      "touchmove",
      (e) => {
        if (!_isDragging) return;
        _touchCurrentY = e.touches[0].clientY;
        const delta = _touchCurrentY - _touchStartY;
        if (delta > 0) container.style.transform = `translateY(${delta}px)`;
      },
      { passive: true }
    );

    container.addEventListener("touchend", () => {
      if (!_isDragging) return;
      _isDragging = false;
      container.style.transition = "";
      const delta = _touchCurrentY - _touchStartY;
      if (delta > 120) this.close();
      else container.style.transform = "translateY(0)";
    });
  },

  async _disconnectActiveWallet() {
    const ecosystem = this.state.selectedNetworkConfig?.ecosystem;
    if (ecosystem === "sui") {
      await this._disconnectSuiWallet();
    } else if (ecosystem === "stellar") {
      await this._disconnectStellarWallet();
    } else if (ecosystem === "near") {
      await this._disconnectNearWallet();
    } else {
      await this.walletService.disconnect();
      if (this._activeEvmTransport?.isConnected()) {
        await this._activeEvmTransport.disconnect();
      }
      this._activeEvmTransport = null;
    }
  },

  _setupEventListeners() {
    document
      .getElementById("kwespay-retryInitBtn")
      ?.addEventListener("click", () => this._validateAPIKey());

    document.getElementById("kwespay-back2")?.addEventListener("click", () => {
      this.state.selectedToken = null;
      this.state.selectedTokenConfig = null;
      const btn = document.getElementById("kwespay-continueToWalletConnect");
      if (btn) btn.disabled = true;
      this._goToStep(1);
    });

    document
      .getElementById("kwespay-back3")
      ?.addEventListener("click", async () => {
        await this._disconnectActiveWallet();
        this._clearQuoteTimer();
        this._goToStep(2);
      });

    document
      .getElementById("kwespay-continueToWalletConnect")
      ?.addEventListener("click", async () => {
        await this._handleWalletConnection();
      });

    document
      .getElementById("kwespay-proceedToPayment")
      ?.addEventListener("click", async () => {
        await this._handlePaymentProcessing();
      });

    document
      .getElementById("kwespay-cancelConnection")
      ?.addEventListener("click", async () => {
        await this._disconnectActiveWallet();
        this._clearQuoteTimer();
        dispatchWidgetEvent("paymentCancelled", {
          reason: "user_cancelled_review",
        });
        this._goToStep(1);
      });

    document
      .getElementById("kwespay-retryPayment")
      ?.addEventListener("click", async () => {
        const ecosystem = this.state.selectedNetworkConfig?.ecosystem;

        if (ecosystem === "sui") {
          if (this.suiWalletService?.isConnected()) {
            await this._loadReviewStep();
            this._goToStep(3);
          } else {
            await this._handleSuiWalletConnection();
          }
        } else if (ecosystem === "stellar") {
          if (this.stellarWalletService?.isConnected()) {
            await this._loadReviewStep();
            this._goToStep(3);
          } else {
            await this._handleStellarWalletConnection();
          }
        } else if (ecosystem === "near") {
          if (this.nearWalletService?.isConnected()) {
            await this._loadReviewStep();
            this._goToStep(3);
          } else {
            await this._handleNearWalletConnection();
          }
        } else {
          if (this.walletService.isConnected()) {
            await this._loadReviewStep();
            this._goToStep(3);
          } else {
            await this._handleWalletConnection();
          }
        }
      });

    document
      .getElementById("kwespay-closeSuccessBtn")
      ?.addEventListener("click", () => this.close());

    document
      .getElementById("kwespay-backToStartBtn")
      ?.addEventListener("click", () => {
        dispatchWidgetEvent("paymentCancelled", {
          reason: "user_started_over",
        });
        this.paymentService.startNewAttempt?.();
        this._reset();
        this._goToStep(1);
      });

    const networkSearch = document.getElementById("kwespay-networkSearch");
    if (networkSearch) {
      networkSearch.addEventListener("input", (e) => {
        const term = e.target.value.toLowerCase();
        document
          .querySelectorAll(".kwespay-container .list-item")
          .forEach((item) => {
            const name = item
              .querySelector(".item-name")
              ?.textContent.toLowerCase();
            if (name)
              item.style.display = name.includes(term) ? "flex" : "none";
          });
      });
    }

    const tokenSearch = document.getElementById("kwespay-tokenSearch");
    if (tokenSearch) {
      tokenSearch.addEventListener("input", (e) => {
        const term = e.target.value.toLowerCase();
        document
          .querySelectorAll("#kwespay-tokenList .token-item")
          .forEach((item) => {
            const name = item
              .querySelector(".token-name")
              ?.textContent.toLowerCase();
            const symbol = item
              .querySelector(".token-symbol")
              ?.textContent.toLowerCase();
            if (name && symbol) {
              item.style.display =
                name.includes(term) || symbol.includes(term) ? "flex" : "none";
            }
          });
      });
    }
  },
};
