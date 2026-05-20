export function getStepTemplates(fiatAmount, currency) {
  return `
    <!-- Step 0: Initialising -->
    <div class="step active" id="kwespay-step0">
      <div class="kp-topbar">
        <div class="kp-topbar-brand">
          <span class="kp-topbar-name">KwesPay Checkout</span>
        </div>
      </div>
      <div class="loading-container" style="flex:1">
        <div class="spinner-wrapper">
          <div class="spinner-ring"></div>
          <div class="spinner-ring-2"></div>
          <div class="spinner-icon">
            <span class="material-symbols-outlined">shield_lock</span>
          </div>
        </div>
        <h2 class="headline">Initializing</h2>
        <p class="body-text">Establishing a secure payment session.</p>
      </div>
      <div class="kp-footer">
        <span class="material-symbols-outlined kp-footer-lock" style="font-size:12px">lock</span>
        <span class="kp-footer-text">Powered by &middot; <span>KwesPay</span></span>
      </div>
    </div>

    <!-- Step 0.5: API key invalid / network error on init -->
    <div class="step" id="kwespay-step0-invalid">
      <div class="kp-topbar">
        <div class="kp-topbar-brand">
          <span class="kp-topbar-name">KwesPay Checkout</span>
        </div>
      </div>
      <div class="loading-container" style="flex:1">
        <div class="error-icon">
          <span class="material-symbols-outlined">wifi_off</span>
        </div>
        <h2 class="headline">Payment Unavailable</h2>
        <p class="body-text">We couldn't start your payment session. Please try again or contact the store for help.</p>
      </div>
      <div class="bottom-action">
        <button class="action-btn" id="kwespay-retryInitBtn">Try Again</button>
      </div>
    </div>

    <!-- Step 1: Select Network -->
    <div class="step" id="kwespay-step1">
      <div class="kp-topbar">
        <div class="kp-topbar-brand">
          <span class="kp-topbar-name">KwesPay Checkout</span>
        </div>
      </div>
      <div class="kp-amount-block">
        <div class="kp-amount-label">Total due</div>
        <div class="kp-amount-value" id="kwespay-paymentAmount">${fiatAmount} ${currency}</div>
        <div class="kp-amount-hint">Select a network to continue</div>
      </div>
      <div class="progress-section">
        <div class="progress-info">
          <span class="progress-step">01 / 03</span>
          <span class="progress-label">Select Network</span>
        </div>
        <div class="progress-bars">
          <div class="progress-bar active"></div>
          <div class="progress-bar"></div>
          <div class="progress-bar"></div>
        </div>
      </div>
      <div class="content-scroll">
        <p class="section-hint">Choose the blockchain network you want to pay on.</p>
        <div class="item-list" id="kwespay-mainnetList"></div>
        <div class="kp-testnet-section" id="kwespay-testnetSection" style="display:none">
          <div class="kp-section-divider">Testnets</div>
          <div class="item-list" id="kwespay-testnetList"></div>
        </div>
      </div>
    </div>

    <!-- Step 2: Select Token -->
    <div class="step" id="kwespay-step2">
      <div class="kp-topbar">
        <div class="kp-topbar-brand">
          <button class="kp-back-btn" id="kwespay-back2">
            <span class="material-symbols-outlined">arrow_back</span>
          </button>
          <span class="kp-topbar-name">KwesPay Checkout</span>
        </div>
      </div>
      <div class="kp-amount-block">
        <div class="kp-amount-label">Total due</div>
        <div class="kp-amount-value">${fiatAmount} ${currency}</div>
      </div>
      <div class="progress-section">
        <div class="progress-info">
          <span class="progress-step">02 / 03</span>
          <span class="progress-label">Select Token</span>
        </div>
        <div class="progress-bars">
          <div class="progress-bar active"></div>
          <div class="progress-bar active"></div>
          <div class="progress-bar"></div>
        </div>
      </div>
      <div class="network-status">
        <div class="status-card">
          <div class="status-icon" id="kwespay-selectedNetworkIcon"></div>
          <p class="status-text" id="kwespay-selectedNetworkName">—</p>
          <span class="material-symbols-outlined" style="color:var(--kp-accent);font-size:15px">check_circle</span>
        </div>
      </div>
      <div class="content-scroll" style="padding-top:10px">
        <p class="section-hint">Select the token you want to pay with. The exact crypto amount will be confirmed on the next screen.</p>
        <div id="kwespay-tokenList"></div>
      </div>
      <div class="bottom-action">
        <button class="action-btn" id="kwespay-continueToWalletConnect" disabled>Connect Wallet</button>
      </div>
    </div>

    <!-- Step 3: Review & Pay -->
    <div class="step" id="kwespay-step3">
      <div class="kp-topbar">
        <div class="kp-topbar-brand">
          <button class="kp-back-btn" id="kwespay-back3">
            <span class="material-symbols-outlined">arrow_back</span>
          </button>
          <span class="kp-topbar-name">KwesPay Checkout</span>
        </div>
      </div>
      <div class="progress-section">
        <div class="progress-info">
          <span class="progress-step">03 / 03</span>
          <span class="progress-label">Review &amp; Pay</span>
        </div>
        <div class="progress-bars">
          <div class="progress-bar active"></div>
          <div class="progress-bar active"></div>
          <div class="progress-bar active"></div>
        </div>
      </div>
      <div class="kp-review-body">
        <div class="kp-review-amount">
          <div class="kp-review-fiat" id="kwespay-reviewFiatAmount">${fiatAmount} ${currency}</div>
          <div class="kp-review-crypto-line" id="kwespay-reviewCryptoLine">Fetching live quote…</div>
          <div class="kp-quote-timer" id="kwespay-quoteTimer" style="display:none;justify-content:center">
            <span class="material-symbols-outlined">schedule</span>
            <span id="kwespay-quoteTimerText">—</span>
          </div>
        </div>
        <div class="kp-detail-block">
          <div class="kp-detail-row">
            <span class="kp-detail-key">Wallet</span>
            <span class="kp-detail-val" id="kwespay-connectedWalletAddress">—</span>
          </div>
          <div class="kp-detail-row">
            <span class="kp-detail-key">Network</span>
            <span class="kp-detail-val" id="kwespay-summaryNetwork">—</span>
          </div>
          <div class="kp-detail-row">
            <span class="kp-detail-key">Token</span>
            <span class="kp-detail-val accent" id="kwespay-summaryToken">—</span>
          </div>
        </div>
        <div class="kp-fee-block">
          <div class="kp-fee-header">
            <span class="material-symbols-outlined">receipt_long</span>
            <span class="kp-fee-header-text">Fee Breakdown</span>
          </div>
          <div class="kp-detail-row">
            <span class="kp-detail-key">Payment amount</span>
            <span class="kp-detail-val" id="kwespay-feePaymentAmount">—</span>
          </div>
          <div class="kp-detail-row">
            <span class="kp-detail-key">Platform fee (0.25%)</span>
            <span class="kp-detail-val" id="kwespay-feePlatformFee">—</span>
          </div>
          <div class="kp-detail-row">
            <span class="kp-detail-key">Vendor receives</span>
            <span class="kp-detail-val green" id="kwespay-feeVendorAmount">—</span>
          </div>
        </div>
      </div>
      <div class="bottom-action">
        <button class="action-btn" id="kwespay-proceedToPayment">Pay Now</button>
        <button class="action-btn secondary" style="margin-top:8px" id="kwespay-cancelConnection">Cancel</button>
      </div>
    </div>

    <!-- Step 4: Processing / Confirming / Success (mutating sub-views) -->
    <div class="step" id="kwespay-step4">
      <div class="kp-topbar">
        <div class="kp-topbar-brand">
          <div class="kp-topbar-dot" id="kwespay-step4-dot"></div>
          <span class="kp-topbar-name" id="kwespay-step4-title">KwesPay Checkout</span>
        </div>
        
      </div>

      <!-- Sub-view: processing (wallet approval + on-chain) -->
      <div id="kwespay-view-processing" class="loading-container" style="flex:1">
        <div class="spinner-wrapper">
          <div class="spinner-ring"></div>
          <div class="spinner-ring-2"></div>
          <div class="spinner-icon">
            <span class="material-symbols-outlined">payments</span>
          </div>
        </div>
        <h2 class="headline" id="kwespay-processingTitle">Processing Payment</h2>
        <p class="body-text" id="kwespay-processingText">Waiting for wallet confirmation.</p>
        <div class="mobile-instruction" id="kwespay-mobileTransactionInstruction" style="display:none">
          <span class="material-symbols-outlined mobile-instruction-icon">phone_iphone</span>
          <div class="mobile-instruction-text">
            <div class="mobile-instruction-title">Check Your Wallet App</div>
            <div class="mobile-instruction-desc">A confirmation request has been sent to your wallet. Tap Approve to complete the payment.</div>
          </div>
        </div>
      </div>

      <!-- Sub-view: confirming (on-chain done, polling backend) -->
      <div id="kwespay-view-confirming" class="loading-container" style="flex:1;display:none">
        <div class="spinner-wrapper">
          <div class="spinner-ring kp-spin-soft"></div>
          <div class="spinner-ring-2 kp-spin-soft"></div>
          <div class="spinner-icon kp-spinner-icon-green">
            <span class="material-symbols-outlined" style="color:var(--kp-green)">cloud_sync</span>
          </div>
        </div>
        <h2 class="headline">Confirming Payment</h2>
        <p class="body-text" id="kwespay-confirmingText">Waiting for network confirmation.</p>
      </div>

      <!-- Sub-view: success receipt -->
      <div id="kwespay-view-success" style="display:none;flex-direction:column;flex:1;overflow:hidden">

        <!-- Thin green confirmed bar -->
        <div class="kp-confirmed-bar">
          <span class="material-symbols-outlined" style="font-size:13px;color:var(--kp-green)">check_circle</span>
          <span>Payment confirmed on-chain</span>
        </div>

        <!-- Scrollable receipt body -->
        <div class="loading-container" style="flex:1;padding-bottom:0;justify-content:flex-start;padding-top:20px;overflow-y:auto">
          <div class="success-icon">
            <span class="material-symbols-outlined">check_circle</span>
          </div>
          <h2 class="headline">Payment Successful</h2>
          <p class="body-text">Your transaction has been confirmed on-chain.</p>

          <div class="tx-details">
            <div class="tx-row">
              <span class="tx-label">Tx hash</span>
              <div class="tx-hash-row">
                <span class="tx-value" id="kwespay-txHash">—</span>
                <a class="explorer-link" id="kwespay-explorerLink" target="_blank" rel="noopener noreferrer">
                  <span class="material-symbols-outlined">open_in_new</span>
                </a>
              </div>
            </div>
            <div class="tx-row">
              <span class="tx-label">Reference</span>
              <span class="tx-value" id="kwespay-txRef">—</span>
            </div>
            <div class="tx-row">
              <span class="tx-label">Amount paid</span>
              <span class="tx-value" id="kwespay-txFiatAmount">${fiatAmount} ${currency}</span>
            </div>
            <div class="tx-row">
              <span class="tx-label">Crypto amount</span>
              <span class="tx-value" id="kwespay-txCryptoAmount">—</span>
            </div>
            <div class="tx-row">
              <span class="tx-label">Network</span>
              <span class="tx-value" id="kwespay-txNetwork">—</span>
            </div>
            <div class="tx-row">
              <span class="tx-label">Time</span>
              <span class="tx-value" id="kwespay-txTime">—</span>
            </div>
          </div>
        </div>

        <!-- Countdown + Done button -->
        <div class="bottom-action" style="padding-top:10px">
          <!-- Countdown bar -->
          <div class="kp-countdown-track">
            <div class="kp-countdown-bar" id="kwespay-receiptCountdownBar"></div>
          </div>
          <p class="kp-countdown-label" id="kwespay-receiptCountdown">Closing in 10s</p>
          <button class="action-btn" id="kwespay-closeSuccessBtn" style="margin-top:8px">Done</button>
        </div>

        <div class="kp-footer">
          <span class="material-symbols-outlined kp-footer-lock" style="font-size:12px">lock</span>
          <span class="kp-footer-text">Secured by <span>KwesPay</span> &middot; On-chain verified</span>
        </div>
      </div>
    </div>

    <!-- Step 5: Error / Failed -->
    <div class="step" id="kwespay-step5">
      <div class="kp-topbar">
        <div class="kp-topbar-brand">
          <div class="kp-topbar-dot" style="background:var(--kp-red);box-shadow:0 0 8px rgba(244,63,94,0.35);animation:none"></div>
          <span class="kp-topbar-name">Payment Failed</span>
        </div>
      </div>
      <div class="loading-container" style="flex:1">
        <div class="error-icon">
          <span class="material-symbols-outlined">error</span>
        </div>
        <h2 class="headline" id="kwespay-errorTitle">Something went wrong</h2>
        <p class="body-text" id="kwespay-errorMessage">An error occurred while processing your payment.</p>

        <!-- Hint strip — gives context without overwhelming the user -->
        <div class="kp-error-hint">
          <span class="material-symbols-outlined" style="font-size:14px;color:var(--kp-muted)">info</span>
          <span>Your funds have not been charged. You can retry safely.</span>
        </div>
      </div>
      <div class="bottom-action">
        <button class="action-btn" id="kwespay-retryPayment">Try Again</button>
        <button class="action-btn secondary" style="margin-top:8px" id="kwespay-backToStartBtn">Start Over</button>
      </div>
    </div>
  `;
}
