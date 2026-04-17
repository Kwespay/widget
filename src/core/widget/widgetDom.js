import { WIDGET_STYLES } from "../../ui/styles.js";
import { getStepTemplates } from "../../ui/template.js";
import { dispatchWidgetEvent } from "../../utils/helpers.js";

export const DomMethods = {
  _init() {
    this._injectFonts();
    this._injectStyles();
    this._createWidgetDOM();
  },

  _injectFonts() {
    if (
      !document.querySelector(
        'link[href*="fonts.googleapis.com/css2?family=Syne"]'
      )
    ) {
      const link = document.createElement("link");
      link.href =
        "https://fonts.googleapis.com/css2?family=Syne:wght@400;500;600;700;800&family=DM+Mono:wght@300;400;500&family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap";
      link.rel = "stylesheet";
      document.head.appendChild(link);
    }
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

    const closeBtn = document.createElement("button");
    closeBtn.className = "kwespay-close-btn";
    closeBtn.innerHTML = "×";
    closeBtn.onclick = () => this.close();
    overlay.appendChild(closeBtn);

    const container = document.createElement("div");
    container.className = "kwespay-container";
    container.id = "kwespay-widget-container";
    container.innerHTML = getStepTemplates(
      this.config.amount,
      this.config.currency
    );

    overlay.appendChild(container);
    document.body.appendChild(overlay);

    this._setupEventListeners();
    this._setupSwipeToClose(container);

    // Clicking outside the container does NOT close the widget (intentional)
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

  _setupEventListeners() {
    document
      .getElementById("kwespay-retryInitBtn")
      ?.addEventListener("click", () => this._validateAPIKey());

    this._renderNetworkList();

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
        await this.walletService.disconnect();
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
        await this.walletService.disconnect();
        this._clearQuoteTimer();
        dispatchWidgetEvent("paymentCancelled", {
          reason: "user_cancelled_review",
        });
        this._goToStep(1);
      });

    document
      .getElementById("kwespay-retryPayment")
      ?.addEventListener("click", async () => {
        if (this.walletService.isConnected()) {
          await this._loadReviewStep();
          this._goToStep(3);
        } else {
          await this._handleWalletConnection();
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
