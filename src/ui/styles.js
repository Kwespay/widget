export const WIDGET_STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

  * { margin: 0; padding: 0; box-sizing: border-box; }

  :root {
    --kp-bg: #0a0a0f;
    --kp-surface: #0f0f18;
    --kp-surface-2: #16161f;
    --kp-border: rgba(255,255,255,0.06);
    --kp-border-active: rgba(99,102,241,0.5);
    --kp-accent: #6366f1;
    --kp-accent-dim: rgba(99,102,241,0.1);
    --kp-accent-glow: rgba(99,102,241,0.25);
    --kp-green: #10b981;
    --kp-red: #f43f5e;
    --kp-text: #f1f0ff;
    --kp-muted: #6b6a80;
    --kp-mono: 'Inter', monospace;
    --kp-sans: 'Inter', sans-serif;
  }

  body.kwespay-open {
    overflow: hidden;
    touch-action: none;
  }

  .kwespay-overlay {
    position: fixed;
    top: 0; left: 0; right: 0; bottom: 0;
    background: rgba(0,0,0,0.75);
    backdrop-filter: blur(8px) saturate(1.2);
    display: none;
    align-items: center;
    justify-content: center;
    z-index: 999999;
    padding: 20px;
    font-family: var(--kp-sans);
  }

  .kwespay-overlay.open { display: flex; }

  .kwespay-close-btn {
    position: absolute;
    top: 12px;
    right: 12px;
    background: rgba(255,255,255,0.06);
    border: 1px solid var(--kp-border);
    color: var(--kp-muted);
    width: 28px;
    height: 28px;
    border-radius: 7px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 16px;
    transition: all 0.15s;
    z-index: 10;
  }

  .kwespay-close-btn:hover {
    background: rgba(255,255,255,0.1);
    color: var(--kp-text);
    border-color: var(--kp-border-active);
  }

  .kwespay-steps-wrapper {
    position: relative;
    flex: 1;
    overflow: hidden;
  }

  .material-symbols-outlined {
    font-variation-settings: "FILL" 0, "wght" 400, "GRAD" 0, "opsz" 24;
  }

  .kwespay-container {
    position: relative;
    display: flex;
    height: 640px;
    max-height: 92vh;
    min-height: 520px;
    width: 100%;
    max-width: 390px;
    flex-direction: column;
    background: var(--kp-bg);
    border: 1px solid var(--kp-border);
    box-shadow:
      0 0 0 1px rgba(255,255,255,0.03),
      0 32px 64px rgba(0,0,0,0.9),
      0 0 80px rgba(99,102,241,0.06);
    overflow: hidden;
    border-radius: 20px;
    font-family: var(--kp-sans);
    animation: kpSlideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
  }

  @keyframes kpSlideUp {
    from { opacity: 0; transform: translateY(20px) scale(0.98); }
    to   { opacity: 1; transform: translateY(0) scale(1); }
  }

  .step {
    position: absolute;
    top: 0; left: 0; right: 0; bottom: 0;
    display: none;
    opacity: 0;
  }

  .step.active {
    display: flex;
    flex-direction: column;
    overflow: hidden;
    animation: kpFadeIn 0.2s ease forwards;
  }

  .step.exiting {
    animation: kpFadeOut 0.15s ease forwards;
  }

  @keyframes kpFadeIn {
    from { opacity: 0; transform: translateY(6px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  @keyframes kpFadeOut {
    from { opacity: 1; }
    to   { opacity: 0; }
  }

  .kp-topbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 20px;
    border-bottom: 1px solid var(--kp-border);
    flex-shrink: 0;
  }

  .kp-topbar-brand {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .kp-back-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border-radius: 7px;
    background: rgba(255,255,255,0.04);
    border: 1px solid var(--kp-border);
    color: var(--kp-muted);
    cursor: pointer;
    transition: all 0.15s;
    flex-shrink: 0;
    margin-right: 4px;
  }

  .kp-back-btn:hover {
    background: rgba(255,255,255,0.08);
    color: var(--kp-text);
    border-color: rgba(255,255,255,0.12);
  }

  .kp-back-btn .material-symbols-outlined { font-size: 16px; }

  .kp-topbar-dot {
    width: 7px; height: 7px;
    border-radius: 50%;
    background: var(--kp-accent);
    box-shadow: 0 0 8px var(--kp-accent-glow);
    animation: kpPulse 2s ease infinite;
  }

  @keyframes kpPulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }

  .kp-topbar-name {
    font-size: 13px;
    font-weight: 600;
    color: var(--kp-text);
    letter-spacing: -0.01em;
  }

  .kp-topbar-secure {
    display: flex;
    align-items: center;
    gap: 5px;
    font-family: var(--kp-mono);
    font-size: 10px;
    color: var(--kp-muted);
    letter-spacing: 0.04em;
    font-weight: 500;
  }

  .kp-topbar-secure .material-symbols-outlined {
    font-size: 13px;
    color: var(--kp-green);
  }

  .kp-amount-block {
    padding: 20px 20px 16px;
    border-bottom: 1px solid var(--kp-border);
    flex-shrink: 0;
  }

  .kp-amount-label {
    font-family: var(--kp-mono);
    font-size: 10px;
    color: var(--kp-muted);
    letter-spacing: 0.08em;
    text-transform: uppercase;
    margin-bottom: 6px;
    font-weight: 500;
  }

  .kp-amount-value {
    font-size: 32px;
    font-weight: 700;
    color: var(--kp-text);
    letter-spacing: -0.03em;
    line-height: 1;
  }

  .kp-amount-hint {
    font-family: var(--kp-mono);
    font-size: 11px;
    color: var(--kp-muted);
    margin-top: 6px;
    min-height: 16px;
    font-weight: 400;
  }

  .kp-amount-crypto {
    font-family: var(--kp-mono);
    font-size: 12px;
    color: var(--kp-accent);
    margin-top: 6px;
    min-height: 16px;
    transition: opacity 0.2s;
    font-weight: 500;
  }

  .kp-amount-crypto.loading { opacity: 0.4; }

  .progress-section {
    padding: 14px 20px 12px;
    border-bottom: 1px solid var(--kp-border);
    flex-shrink: 0;
  }

  .progress-info {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 8px;
  }

  .progress-step {
    font-family: var(--kp-mono);
    font-size: 10px;
    color: var(--kp-muted);
    letter-spacing: 0.06em;
    font-weight: 500;
  }

  .progress-label {
    font-size: 11px;
    font-weight: 600;
    color: var(--kp-accent);
    letter-spacing: 0.02em;
    text-transform: uppercase;
  }

  .progress-bars { display: flex; width: 100%; gap: 5px; }

  .progress-bar {
    height: 2px;
    flex: 1;
    border-radius: 999px;
    background: var(--kp-surface-2);
    transition: background 0.3s ease;
  }

  .progress-bar.active {
    background: var(--kp-accent);
    box-shadow: 0 0 8px var(--kp-accent-glow);
  }

  .section-hint {
    font-size: 12px;
    color: var(--kp-muted);
    margin-bottom: 14px;
    line-height: 1.6;
    font-weight: 400;
  }

  .content-scroll {
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
    padding: 16px 20px;
    -webkit-overflow-scrolling: touch;
  }

  .content-scroll::-webkit-scrollbar { width: 3px; }
  .content-scroll::-webkit-scrollbar-track { background: transparent; }
  .content-scroll::-webkit-scrollbar-thumb {
    background: rgba(99,102,241,0.2);
    border-radius: 10px;
  }

  .item-list {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin-bottom: 6px;
  }

  .kp-testnet-section { margin-top: 20px; }

  .kp-section-divider {
    font-family: var(--kp-mono);
    font-size: 10px;
    color: var(--kp-muted);
    letter-spacing: 0.08em;
    text-transform: uppercase;
    margin-bottom: 10px;
    padding-bottom: 8px;
    border-bottom: 1px solid var(--kp-border);
    font-weight: 500;
  }

  .list-item {
    display: flex;
    align-items: center;
    gap: 12px;
    background: var(--kp-surface);
    padding: 12px 14px;
    border-radius: 12px;
    border: 1px solid var(--kp-border);
    cursor: pointer;
    transition: all 0.15s;
  }

  .list-item:hover {
    border-color: var(--kp-border-active);
    background: var(--kp-accent-dim);
    transform: translateX(2px);
  }

  .item-icon {
    width: 36px; height: 36px;
    border-radius: 10px;
    display: flex; align-items: center; justify-content: center;
    background: var(--kp-surface-2);
    overflow: hidden;
    border: 1px solid var(--kp-border);
    flex-shrink: 0;
  }

  .item-icon img { width: 22px; height: 22px; object-fit: contain; }
  .item-info { display: flex; flex-direction: column; flex: 1; }
  .item-name-row { display: flex; align-items: center; gap: 7px; }

  .item-name {
    font-size: 13px;
    font-weight: 600;
    color: var(--kp-text);
  }

  .item-badge {
    padding: 1px 6px;
    border-radius: 4px;
    font-size: 9px;
    font-weight: 600;
    font-family: var(--kp-mono);
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }

  .badge-testnet {
    background: rgba(251,146,60,0.08);
    color: #fb923c;
    border: 1px solid rgba(251,146,60,0.2);
  }

  .item-desc {
    font-family: var(--kp-mono);
    font-size: 10px;
    color: var(--kp-muted);
    margin-top: 3px;
    font-weight: 400;
  }

  .item-chevron { color: var(--kp-muted); font-size: 16px; }

  .token-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 13px 14px;
    cursor: pointer;
    transition: all 0.15s;
    border: 1px solid var(--kp-border);
    border-radius: 12px;
    margin-bottom: 6px;
    background: var(--kp-surface);
    position: relative;
    overflow: hidden;
  }

  .token-item:last-child { margin-bottom: 0; }
  .token-item:hover { border-color: var(--kp-border-active); background: var(--kp-accent-dim); }
  .token-item.selected { background: var(--kp-accent-dim); border-color: var(--kp-accent); }
  .token-item.selected::after {
    content: '';
    position: absolute; inset: 0;
    background: linear-gradient(90deg, rgba(99,102,241,0.08) 0%, transparent 100%);
    pointer-events: none;
  }
  .token-item.selected .token-symbol { color: var(--kp-accent); }

  .token-left { display: flex; align-items: center; gap: 12px; flex: 1; }

  .token-icon {
    width: 36px; height: 36px;
    border-radius: 10px;
    background: var(--kp-surface-2);
    border: 1px solid var(--kp-border);
    overflow: hidden;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .token-icon img { width: 22px; height: 22px; object-fit: contain; }
  .token-info { display: flex; flex-direction: column; justify-content: center; }

  .token-symbol {
    color: var(--kp-text);
    font-size: 13px;
    font-weight: 600;
    line-height: 1;
    margin-bottom: 3px;
    transition: color 0.15s;
  }

  .token-name {
    font-family: var(--kp-mono);
    color: var(--kp-muted);
    font-size: 10px;
    line-height: 1;
    font-weight: 400;
  }

  .token-chevron { color: var(--kp-muted); font-size: 16px; flex-shrink: 0; }
  #kwespay-tokenList { display: flex; flex-direction: column; }

  .bottom-action {
    padding: 12px 20px 16px;
    background: var(--kp-bg);
    border-top: 1px solid var(--kp-border);
    flex-shrink: 0;
  }

  .action-btn {
    width: 100%;
    padding: 13px;
    border-radius: 12px;
    background: var(--kp-accent);
    color: white;
    font-weight: 600;
    font-size: 14px;
    border: none;
    cursor: pointer;
    transition: all 0.15s;
    font-family: var(--kp-sans);
    letter-spacing: -0.01em;
    position: relative;
    overflow: hidden;
  }

  .action-btn::before {
    content: '';
    position: absolute; inset: 0;
    background: linear-gradient(135deg, rgba(255,255,255,0.1) 0%, transparent 60%);
    pointer-events: none;
  }

  .action-btn:hover { background: #5254cc; box-shadow: 0 0 20px var(--kp-accent-glow); }
  .action-btn:active { transform: scale(0.99); }

  .action-btn.secondary {
    background: var(--kp-surface);
    border: 1px solid var(--kp-border);
    color: var(--kp-muted);
  }

  .action-btn.secondary::before { display: none; }
  .action-btn.secondary:hover {
    background: var(--kp-surface-2);
    border-color: var(--kp-border-active);
    color: var(--kp-text);
    box-shadow: none;
  }

  .action-btn:disabled { opacity: 0.3; cursor: not-allowed; box-shadow: none; }

  .kp-footer {
    padding: 10px 20px 12px;
    background: var(--kp-bg);
    border-top: 1px solid var(--kp-border);
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    flex-shrink: 0;
  }

  .kp-footer-lock { font-size: 11px; color: var(--kp-green); }

  .kp-footer-text {
    font-family: var(--kp-mono);
    font-size: 10px;
    color: var(--kp-muted);
    letter-spacing: 0.02em;
    font-weight: 400;
  }

  .kp-footer-text span { color: var(--kp-text); font-weight: 500; }

  .loading-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 24px 20px;
    flex: 1;
  }

  .spinner-wrapper {
    position: relative;
    width: 64px; height: 64px;
    display: flex; align-items: center; justify-content: center;
    margin-bottom: 20px;
  }

  .spinner-ring {
    position: absolute;
    width: 64px; height: 64px;
    border-radius: 50%;
    border: 2px solid transparent;
    border-top-color: var(--kp-accent);
    animation: kpSpin 0.85s linear infinite;
  }

  .spinner-ring-2 {
    position: absolute;
    width: 48px; height: 48px;
    border-radius: 50%;
    border: 2px solid transparent;
    border-bottom-color: rgba(99,102,241,0.3);
    animation: kpSpin 1.2s linear infinite reverse;
  }

  /* Soft green spinner for confirming sub-view */
  .kp-spin-soft.spinner-ring {
    border-top-color: rgba(16,185,129,0.55);
    animation-duration: 1.6s;
  }

  .kp-spin-soft.spinner-ring-2 {
    border-bottom-color: rgba(16,185,129,0.18);
    animation-duration: 2.2s;
  }

  .kp-spinner-icon-green {
    background: rgba(16,185,129,0.08) !important;
    border-color: rgba(16,185,129,0.15) !important;
  }

  @keyframes kpSpin { to { transform: rotate(360deg); } }

  .spinner-icon {
    z-index: 10;
    width: 32px; height: 32px;
    background: var(--kp-accent-dim);
    border-radius: 8px;
    display: flex; align-items: center; justify-content: center;
    border: 1px solid rgba(99,102,241,0.2);
  }

  .spinner-icon .material-symbols-outlined { font-size: 18px; color: var(--kp-accent); }

  .headline {
    color: var(--kp-text);
    font-size: 18px;
    font-weight: 700;
    line-height: 1.3;
    text-align: center;
    margin-bottom: 8px;
    letter-spacing: -0.02em;
  }

  .body-text {
    color: var(--kp-muted);
    font-size: 13px;
    line-height: 1.6;
    text-align: center;
    padding: 0 8px;
    margin-bottom: 8px;
    font-weight: 400;
  }

  /* "Transaction sent on-chain" pill shown during confirming sub-view */
  .kp-onchain-badge {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    margin-top: 14px;
    padding: 6px 14px;
    border-radius: 20px;
    background: rgba(16,185,129,0.08);
    border: 1px solid rgba(16,185,129,0.18);
    font-family: var(--kp-mono);
    font-size: 10px;
    color: var(--kp-green);
    letter-spacing: 0.04em;
    font-weight: 500;
  }

  .kp-onchain-badge .material-symbols-outlined { font-size: 12px; color: var(--kp-green); }

  /* Thin green confirmation bar at top of success sub-view */
  .kp-confirmed-bar {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 8px 20px;
    background: rgba(16,185,129,0.06);
    border-bottom: 1px solid rgba(16,185,129,0.12);
    font-family: var(--kp-mono);
    font-size: 10px;
    color: var(--kp-green);
    letter-spacing: 0.04em;
    font-weight: 500;
    flex-shrink: 0;
  }

  .success-icon {
    width: 64px; height: 64px;
    border-radius: 16px;
    background: rgba(16,185,129,0.1);
    border: 1px solid rgba(16,185,129,0.2);
    display: flex; align-items: center; justify-content: center;
    margin-bottom: 16px;
  }

  .success-icon .material-symbols-outlined { font-size: 36px; color: var(--kp-green); }

  .error-icon {
    width: 64px; height: 64px;
    border-radius: 16px;
    background: rgba(244,63,94,0.1);
    border: 1px solid rgba(244,63,94,0.2);
    display: flex; align-items: center; justify-content: center;
    margin-bottom: 16px;
  }

  .error-icon .material-symbols-outlined { font-size: 36px; color: var(--kp-red); }

  .network-status { padding: 14px 20px 0; }

  .status-card {
    display: flex;
    align-items: center;
    gap: 10px;
    background: var(--kp-accent-dim);
    border: 1px solid rgba(99,102,241,0.2);
    border-radius: 10px;
    padding: 10px 14px;
  }

  .status-icon {
    width: 24px; height: 24px;
    border-radius: 6px;
    background: var(--kp-surface-2);
    overflow: hidden; flex-shrink: 0;
    display: flex; align-items: center; justify-content: center;
  }

  .status-icon img { width: 16px; height: 16px; object-fit: contain; }
  .status-text { color: var(--kp-accent); font-size: 12px; font-weight: 600; flex: 1; }

  .kp-review-body { flex: 1; overflow-y: auto; padding: 16px 20px; }
  .kp-review-body::-webkit-scrollbar { width: 3px; }
  .kp-review-body::-webkit-scrollbar-thumb { background: rgba(99,102,241,0.2); border-radius: 10px; }

  .kp-review-amount {
    background: var(--kp-surface);
    border: 1px solid var(--kp-border);
    border-radius: 14px;
    padding: 18px;
    margin-bottom: 12px;
    text-align: center;
  }

  .kp-review-fiat {
    font-size: 28px;
    font-weight: 700;
    color: var(--kp-text);
    letter-spacing: -0.03em;
    line-height: 1;
    margin-bottom: 6px;
  }

  .kp-review-crypto-line {
    font-family: var(--kp-mono);
    font-size: 13px;
    color: var(--kp-accent);
    font-weight: 500;
  }

  .kp-review-crypto-line.loading { opacity: 0.4; }

  .kp-detail-block {
    background: var(--kp-surface);
    border: 1px solid var(--kp-border);
    border-radius: 14px;
    overflow: hidden;
    margin-bottom: 10px;
  }

  .kp-detail-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 11px 16px;
    border-bottom: 1px solid var(--kp-border);
  }

  .kp-detail-row:last-child { border-bottom: none; }

  .kp-detail-key {
    font-family: var(--kp-mono);
    font-size: 11px;
    color: var(--kp-muted);
    letter-spacing: 0.02em;
    font-weight: 400;
  }

  .kp-detail-val {
    font-family: var(--kp-mono);
    font-size: 11px;
    color: var(--kp-text);
    font-weight: 500;
    text-align: right;
  }

  .kp-detail-val.accent { color: var(--kp-accent); }
  .kp-detail-val.green { color: var(--kp-green); }

  .kp-fee-block {
    background: rgba(16,185,129,0.04);
    border: 1px solid rgba(16,185,129,0.1);
    border-radius: 14px;
    overflow: hidden;
    margin-bottom: 10px;
  }

  .kp-fee-block .kp-detail-row { border-bottom-color: rgba(16,185,129,0.08); }

  .kp-fee-header {
    padding: 10px 16px;
    background: rgba(16,185,129,0.06);
    border-bottom: 1px solid rgba(16,185,129,0.1);
    display: flex; align-items: center; gap: 6px;
  }

  .kp-fee-header-text {
    font-family: var(--kp-mono);
    font-size: 10px;
    color: var(--kp-green);
    letter-spacing: 0.06em;
    text-transform: uppercase;
    font-weight: 500;
  }

  .kp-fee-header .material-symbols-outlined { font-size: 13px; color: var(--kp-green); }

  .tx-details {
    width: 100%;
    background: var(--kp-surface);
    border: 1px solid var(--kp-border);
    border-radius: 14px;
    overflow: hidden;
    margin-top: 16px;
  }

  .tx-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 10px 16px;
    border-bottom: 1px solid var(--kp-border);
  }

  .tx-row:last-child { border-bottom: none; }

  .tx-label { font-family: var(--kp-mono); color: var(--kp-muted); font-size: 10px; letter-spacing: 0.02em; font-weight: 400; }
  .tx-value { color: var(--kp-text); font-size: 11px; font-weight: 500; font-family: var(--kp-mono); }
  .tx-hash-row { display: flex; align-items: center; gap: 8px; }

  .explorer-link {
    display: flex; align-items: center; justify-content: center;
    width: 24px; height: 24px;
    background: var(--kp-accent-dim);
    border: 1px solid rgba(99,102,241,0.2);
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.15s;
    flex-shrink: 0;
  }

  .explorer-link:hover { background: rgba(99,102,241,0.2); }
  .explorer-link .material-symbols-outlined { font-size: 12px; color: var(--kp-accent); }

  .mobile-instruction {
    background: var(--kp-accent-dim);
    border: 1px solid rgba(99,102,241,0.2);
    border-radius: 10px;
    padding: 12px;
    margin: 12px 0 0;
    display: flex;
    align-items: flex-start;
    gap: 10px;
  }

  .mobile-instruction-icon { color: var(--kp-accent); font-size: 18px; flex-shrink: 0; margin-top: 1px; }
  .mobile-instruction-text { flex: 1; }
  .mobile-instruction-title { color: var(--kp-text); font-size: 12px; font-weight: 600; margin-bottom: 3px; }
  .mobile-instruction-desc { color: var(--kp-muted); font-size: 11px; line-height: 1.5; font-weight: 400; }

  .kp-quote-timer {
    display: flex;
    align-items: center;
    gap: 5px;
    font-family: var(--kp-mono);
    font-size: 10px;
    color: var(--kp-muted);
    margin-top: 6px;
    font-weight: 400;
  }

  .kp-quote-timer .material-symbols-outlined { font-size: 12px; }
  .kp-quote-timer.urgent { color: #fb923c; }
  .kp-quote-timer.expired { color: var(--kp-red); }

  .kp-mobile-connect-status {
    display: flex;
    align-items: center;
    gap: 12px;
    background: var(--kp-accent-dim);
    border: 1px solid rgba(99,102,241,0.2);
    border-radius: 12px;
    padding: 14px 16px;
    margin-bottom: 4px;
  }

  .kp-mobile-status-icon {
    width: 28px; height: 28px;
    display: flex; align-items: center; justify-content: center;
    flex-shrink: 0;
  }

  .kp-mobile-status-text { flex: 1; }

  .kp-mobile-status-title {
    font-size: 13px;
    font-weight: 600;
    color: var(--kp-text);
    margin-bottom: 2px;
  }

  .kp-mobile-status-desc {
    font-family: var(--kp-mono);
    font-size: 11px;
    color: var(--kp-muted);
  }

  .kp-wallet-option:active {
    transform: scale(0.98);
    background: var(--kp-accent-dim);
    border-color: var(--kp-border-active);
  }

  @media (max-width: 480px) {
    .kwespay-overlay {
      padding: 0;
      align-items: flex-end;
      background: rgba(0,0,0,0.6);
    }

    .kwespay-close-btn { top: 14px; right: 14px; }

    .kwespay-container {
      width: 100vw;
      max-width: 100vw;
      height: calc(100vh - 120px);
      max-height: calc(100vh - 120px);
      min-height: 60vh;
      border-radius: 20px 20px 0 0;
      animation: kpSheetUp 0.32s cubic-bezier(0.16, 1, 0.3, 1) forwards;
      border-bottom: none;
    }

    .kwespay-container.closing {
      animation: kpSheetDown 0.28s ease forwards;
    }

    .kwespay-container::before {
      content: '';
      display: block;
      position: absolute;
      top: 8px; left: 50%;
      transform: translateX(-50%);
      width: 28px; height: 3px;
      border-radius: 2px;
      background: rgba(255,255,255,0.12);
      z-index: 10;
    }
  }

  @keyframes kpSheetUp {
    from { transform: translateY(100%); opacity: 0.8; }
    to   { transform: translateY(0); opacity: 1; }
  }

  @keyframes kpSheetDown {
    from { transform: translateY(0); opacity: 1; }
    to   { transform: translateY(100%); opacity: 0; }
  }
`;
