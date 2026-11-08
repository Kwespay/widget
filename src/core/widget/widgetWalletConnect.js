
import { getErrorMessage, isMobileDevice, escapeHtml, safeImageUrl } from "../../utils/helpers.js";
import { icon } from "../../ui/icons.js";

const WC_DEEPLINK_KEY = "WALLETCONNECT_DEEPLINK_CHOICE";

const URI_WATCHDOG_MS = 20_000;

async function _renderQrInto(el, uri) {
  if (!el) return;
  try {
    const mod = await import("qrcode");
    const QRCode = mod.default ?? mod;
    const svg = await QRCode.toString(uri, {
      type: "svg",
      margin: 1,
      color: { dark: "#0b0b0f", light: "#ffffff" },
    });
    el.innerHTML = svg;
    const svgEl = el.querySelector("svg");
    if (svgEl) {
      svgEl.style.width = "100%";
      svgEl.style.height = "100%";
      svgEl.style.display = "block";
    }
  } catch (err) {
    el.innerHTML = `<div style="font-family:var(--kp-mono);font-size:11px;color:#555;text-align:center;padding:16px">Couldn't draw the code — use a wallet button or copy the link.</div>`;
  }
}

export const WalletConnectUIMethods = {
  async _renderWalletConnectStep(opts) {
    const {
      title = "WalletConnect",
      subtitle = "Scan with your wallet app, or open one below.",
      steps = null,
      mobileWallets = [],
      backToStep = 2,
      start,
      onConnected,
      onError,
    } = opts;

    try {
      localStorage.removeItem(WC_DEEPLINK_KEY);
    } catch (_) {}

    const isMobile = isMobileDevice();

    const guideHtml =
      Array.isArray(steps) && steps.length
        ? `<ol class="kp-steps">${steps
            .map(
              (s, i) =>
                `<li><span class="kp-step-num">${i + 1}</span><span class="kp-step-text">${escapeHtml(s).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")}</span></li>`
            )
            .join("")}</ol>`
        : `<p class="section-hint">${escapeHtml(subtitle)}</p>`;

    const STEP_ID = "kwespay-step-walletconnect";
    this._removeCustomStep(STEP_ID);

    const container = document.getElementById("kwespay-widget-container");
    const step = document.createElement("div");
    step.className = "step";
    step.id = STEP_ID;

    const walletButtons = mobileWallets
      .map(
        (w, i) => `
        <a class="list-item kp-wc-wallet" data-index="${i}" style="cursor:pointer;text-decoration:none;opacity:0.45;pointer-events:none">
          <div class="item-icon">
            <img src="${safeImageUrl(w.icon)}" alt="${escapeHtml(w.name)}" style="width:22px;height:22px;object-fit:contain;border-radius:6px">
          </div>
          <div class="item-info">
            <div class="item-name-row"><p class="item-name">${escapeHtml(w.name)}</p></div>
            <p class="item-desc kp-wc-wallet-desc">Getting secure link…</p>
          </div>
          ${icon("chevron_right", "item-chevron")}
        </a>`
      )
      .join("");

    const qrBlock = `
      <div style="display:flex;justify-content:center;margin:8px 0 16px">
        <div id="kwespay-wc-qr" style="width:200px;height:200px;background:#fff;border-radius:14px;padding:12px;box-sizing:border-box;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 18px rgba(0,0,0,0.25)">
          <div class="kp-wc-spinner" style="width:26px;height:26px;border:3px solid rgba(0,0,0,0.12);border-top-color:var(--kp-accent);border-radius:50%;animation:kpSpin 0.85s linear infinite"></div>
        </div>
      </div>`;

    const copyBlock = `
      <button id="kwespay-wc-copy" class="kp-wc-copy" style="margin-top:14px;width:100%;background:transparent;border:1px solid var(--kp-border,rgba(255,255,255,0.14));color:var(--kp-muted);border-radius:10px;padding:10px;font-family:var(--kp-mono);font-size:11px;cursor:pointer" disabled>
        Copy link
      </button>`;

    const bodyHtml =
      isMobile && walletButtons
        ? `${guideHtml}
           <div class="item-list" id="kwespay-wc-wallets">${walletButtons}</div>
           <div class="kp-section-divider" style="margin-top:18px">Or scan with another device</div>
           ${qrBlock}
           ${copyBlock}`
        : `${guideHtml}
           ${qrBlock}
           ${
             walletButtons
               ? `<div class="kp-section-divider">Or open a wallet app</div>
                  <div class="item-list" id="kwespay-wc-wallets">${walletButtons}</div>`
               : ""
           }
           ${copyBlock}`;

    step.innerHTML = `
      <div class="kp-topbar">
        <div class="kp-topbar-brand">
          <button class="kp-back-btn" id="kwespay-wc-back">
            ${icon("arrow_back")}
          </button>
          <span class="kp-topbar-name">${escapeHtml(title)}</span>
        </div>
      </div>
      <div class="content-scroll" style="padding-top:16px">
        ${bodyHtml}
      </div>
    `;

    container.appendChild(step);

    let currentUri = null;
    let settled = false;

    const back = () => {
      settled = true;
      this._removeCustomStep(STEP_ID);
      this._goToStep(backToStep);
    };
    step.querySelector("#kwespay-wc-back")?.addEventListener("click", back);

    step.querySelectorAll(".kp-wc-wallet").forEach((el) => {
      const idx = parseInt(el.getAttribute("data-index"), 10);
      const wallet = mobileWallets[idx];
      el.addEventListener("click", (e) => {
        e.preventDefault();
        if (!currentUri) return;
        const link =
          wallet.universalLink?.(currentUri) || wallet.deepLink?.(currentUri);
        if (!link) return;

        if (wallet.universalBase) {
          try {
            localStorage.setItem(
              WC_DEEPLINK_KEY,
              JSON.stringify({ href: wallet.universalBase, name: wallet.name })
            );
          } catch (_) {}
        }

        window.open(link, "_blank");
        const desc = el.querySelector(".kp-wc-wallet-desc");
        if (desc) desc.textContent = "Approve in the app, then come back";
      });
    });

    const copyBtn = step.querySelector("#kwespay-wc-copy");
    copyBtn?.addEventListener("click", async () => {
      if (!currentUri) return;
      try {
        await navigator.clipboard.writeText(currentUri);
        copyBtn.textContent = "Copied ✓";
        setTimeout(() => {
          if (copyBtn) copyBtn.textContent = "Copy link";
        }, 1500);
      } catch (_) {}
    });

    this._goToStep("walletconnect");

    const watchdog = setTimeout(() => {
      if (currentUri || settled) return;
      const qrEl = document.getElementById("kwespay-wc-qr");
      if (qrEl) {
        qrEl.innerHTML = `<div style="font-family:var(--kp-mono);font-size:11px;color:#555;text-align:center;padding:14px;line-height:1.5">Taking longer than usual…<br>Check your internet connection,<br>then go back and try again.</div>`;
      }
      step.querySelectorAll(".kp-wc-wallet-desc").forEach((d) => {
        d.textContent = "Connection is slow — check your internet";
      });
    }, URI_WATCHDOG_MS);

    const onUri = (uri) => {
      currentUri = uri;
      clearTimeout(watchdog);
      _renderQrInto(document.getElementById("kwespay-wc-qr"), uri);
      if (copyBtn) copyBtn.disabled = false;
      step.querySelectorAll(".kp-wc-wallet").forEach((el) => {
        el.style.opacity = "1";
        el.style.pointerEvents = "auto";
        const desc = el.querySelector(".kp-wc-wallet-desc");
        if (desc) desc.textContent = "Tap to connect";
      });
    };

    try {
      const connection = await start(onUri);
      clearTimeout(watchdog);
      if (settled) return;
      this._removeCustomStep(STEP_ID);
      await onConnected?.(connection);
    } catch (err) {
      clearTimeout(watchdog);
      if (settled) return;
      this._removeCustomStep(STEP_ID);
      if (err?.code === "USER_CANCELLED") {
        this._goToStep(backToStep);
        return;
      }
      if (onError) onError(err);
      else this._showError("Connection Failed", getErrorMessage(err));
    }
  },
};
