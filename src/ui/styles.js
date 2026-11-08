export const WIDGET_STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

  * { margin: 0; padding: 0; box-sizing: border-box; }

  :root {
    --kp-bg:           #0a0a0f;
    --kp-surface:      #0f0f18;
    --kp-surface-2:    #16161f;
    --kp-border:       rgba(255,255,255,0.06);
    --kp-border-active: rgba(99,102,241,0.5);
    --kp-accent:       #6366f1;
    --kp-accent-dim:   rgba(99,102,241,0.1);
    --kp-accent-glow:  rgba(99,102,241,0.25);
    --kp-green:        #10b981;
    --kp-red:          #f43f5e;
    --kp-text:         #f1f0ff;
    --kp-muted:        #6b6a80;
    --kp-mono:         'Inter', monospace;
    --kp-sans:         'Inter', sans-serif;
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
    top: 12px; right: 12px;
    background: rgba(255,255,255,0.06);
    border: 1px solid var(--kp-border);
    color: var(--kp-muted);
    width: 28px; height: 28px;
    border-radius: 7px;
    cursor: pointer;
    display: flex; align-items: center; justify-content: center;
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
    width: 1em;
    height: 1em;
    display: inline-block;
    vertical-align: middle;
    flex-shrink: 0;
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

  .kp-instant .step.active { animation: none; opacity: 1; }
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
    display: flex; align-items: center; justify-content: center;
    width: 28px; height: 28px;
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
    flex-shrink: 0;
  }

  @keyframes kpPulse {
    0%, 100% { opacity: 1; }
    50%       { opacity: 0.4; }
  }

  .kp-topbar-name {
    font-size: 13px;
    font-weight: 600;
    color: var(--kp-text);
    letter-spacing: -0.01em;
  }

  .kp-topbar-secure {
    display: flex; align-items: center; gap: 5px;
    font-family: var(--kp-mono);
    font-size: 10px;
    color: var(--kp-muted);
    letter-spacing: 0.04em;
    font-weight: 500;
  }

  .kp-topbar-secure .material-symbols-outlined { font-size: 13px; color: var(--kp-green); }
  .kp-topbar-secure svg { width: 13px; height: 13px; color: var(--kp-green); }
  .kp-topbar-secure strong { font-weight: 600; color: var(--kp-text); }


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
    display: flex; align-items: center; justify-content: space-between;
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
    height: 2px; flex: 1;
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
    display: flex; flex-direction: column; gap: 6px;
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

  .kp-steps {
    list-style: none;
    margin: 4px 0 18px;
    padding: 14px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    background: var(--kp-surface);
    border: 1px solid var(--kp-border);
    border-radius: 12px;
  }
  .kp-steps li {
    display: flex;
    align-items: flex-start;
    gap: 11px;
    font-family: var(--kp-sans);
    font-size: 13px;
    line-height: 1.45;
    color: var(--kp-muted);
  }
  .kp-step-num {
    flex: 0 0 auto;
    width: 20px;
    height: 20px;
    margin-top: 1px;
    border-radius: 50%;
    background: var(--kp-accent-dim);
    color: var(--kp-accent);
    font-family: var(--kp-mono);
    font-size: 11px;
    font-weight: 600;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .kp-step-text { flex: 1 1 auto; min-width: 0; }
  .kp-step-text strong { color: var(--kp-text); font-weight: 600; }

  .list-item {
    display: flex; align-items: center; gap: 12px;
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

  .item-icon img { width: 28px; height: 28px; object-fit: contain; }
  .item-info { display: flex; flex-direction: column; flex: 1; }
  .item-name-row { display: flex; align-items: center; gap: 7px; }

  .item-name { font-size: 13px; font-weight: 600; color: var(--kp-text); }

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
    display: flex; align-items: center; gap: 12px;
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

  .token-item:hover {
    border-color: var(--kp-border-active);
    background: var(--kp-accent-dim);
  }

  .token-item.selected {
    background: var(--kp-accent-dim);
    border-color: var(--kp-accent);
  }

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
    overflow: hidden; flex-shrink: 0;
    display: flex; align-items: center; justify-content: center;
  }

  .token-icon img { width: 22px; height: 22px; object-fit: contain; }
  .kp-logo-fallback { font-size: 13px; font-weight: 700; color: var(--kp-text); line-height: 1; }
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
    display: flex; align-items: center; justify-content: center; gap: 6px;
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
    display: flex; flex-direction: column;
    align-items: center; justify-content: center;
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


  .kp-onchain-badge {
    display: inline-flex; align-items: center; gap: 5px;
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

  .kp-confirmed-bar {
    display: flex; align-items: center; justify-content: center; gap: 6px;
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

  /* Reassuring strip below the error message */
  .kp-error-hint {
    display: flex; align-items: flex-start; gap: 7px;
    margin-top: 16px;
    padding: 10px 14px;
    border-radius: 10px;
    background: rgba(255,255,255,0.03);
    border: 1px solid var(--kp-border);
    font-family: var(--kp-mono);
    font-size: 11px;
    color: var(--kp-muted);
    line-height: 1.55;
    max-width: 280px;
    text-align: left;
  }


  .network-status { padding: 14px 20px 0; }

  .status-card {
    display: flex; align-items: center; gap: 10px;
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
    display: flex; justify-content: space-between; align-items: center;
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
  .kp-detail-val.green  { color: var(--kp-green); }

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
    display: flex; justify-content: space-between; align-items: center;
    padding: 10px 16px;
    border-bottom: 1px solid var(--kp-border);
  }

  .tx-row:last-child { border-bottom: none; }

  .tx-label  { font-family: var(--kp-mono); color: var(--kp-muted); font-size: 10px; letter-spacing: 0.02em; font-weight: 400; }
  .tx-value  { color: var(--kp-text); font-size: 11px; font-weight: 500; font-family: var(--kp-mono); }
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


  /* Full-width track that drains left-to-right */
  .kp-countdown-track {
    width: 100%;
    height: 3px;
    border-radius: 999px;
    background: var(--kp-surface-2);
    overflow: hidden;
    margin-bottom: 6px;
  }

  .kp-countdown-bar {
    height: 100%;
    width: 100%;
    border-radius: 999px;
    background: var(--kp-accent);
    /* smooth drain: transition only width changes */
    transition: width 0.9s linear, background 0.4s ease;
  }

  .kp-countdown-label {
    font-family: var(--kp-mono);
    font-size: 10px;
    color: var(--kp-muted);
    text-align: center;
    letter-spacing: 0.04em;
    font-weight: 400;
    margin-bottom: 2px;
  }


  .mobile-instruction {
    background: var(--kp-accent-dim);
    border: 1px solid rgba(99,102,241,0.2);
    border-radius: 10px;
    padding: 12px;
    margin: 12px 0 0;
    display: flex; align-items: flex-start; gap: 10px;
  }

  .mobile-instruction-icon { color: var(--kp-accent); font-size: 18px; flex-shrink: 0; margin-top: 1px; }
  .mobile-instruction-text { flex: 1; }
  .mobile-instruction-title { color: var(--kp-text); font-size: 12px; font-weight: 600; margin-bottom: 3px; }
  .mobile-instruction-desc  { color: var(--kp-muted); font-size: 11px; line-height: 1.5; font-weight: 400; }


  .kp-quote-timer {
    display: flex; align-items: center; gap: 5px;
    font-family: var(--kp-mono);
    font-size: 10px;
    color: var(--kp-muted);
    margin-top: 6px;
    font-weight: 400;
  }

  .kp-quote-timer .material-symbols-outlined { font-size: 12px; }
  .kp-quote-timer.urgent  { color: #fb923c; }
  .kp-quote-timer.expired { color: var(--kp-red); }


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
    to   { transform: translateY(0);    opacity: 1; }
  }

  @keyframes kpSheetDown {
    from { transform: translateY(0);    opacity: 1; }
    to   { transform: translateY(100%); opacity: 0; }
  }

  body.kwespay-page.kwespay-open { touch-action: auto; }

  .kwespay-overlay.kp-page {
    background: #050508;
    backdrop-filter: none;
    padding: 32px 16px;
    overflow-y: auto;
  }

  .kwespay-overlay.kp-page .kwespay-container {
    margin: auto;
    height: min(720px, calc(100dvh - 64px));
    max-height: none;
  }

  @media (max-width: 480px) {
    .kwespay-overlay.kp-page {
      padding: 0;
      align-items: stretch;
      background: var(--kp-bg);
    }

    .kwespay-overlay.kp-page .kwespay-container {
      width: 100%;
      max-width: 100%;
      height: 100dvh;
      min-height: 100dvh;
      max-height: 100dvh;
      border: none;
      border-radius: 0;
      box-shadow: none;
      animation: none;
      padding-bottom: env(safe-area-inset-bottom);
    }
  }

  .kp-branded .action-btn:not(.secondary) { color: var(--kp-on-accent, #fff); }
  .kp-branded .action-btn:not(.secondary):hover { background: var(--kp-accent); filter: brightness(1.08); }

  .kp-merchant-logo {
    width: 28px; height: 28px;
    border-radius: 8px;
    object-fit: contain;
    padding: 3px;
    background: #fff;
    box-shadow: 0 0 0 1px rgba(255,255,255,0.08), 0 1px 2px rgba(0,0,0,0.4);
    flex-shrink: 0;
  }

  .kp-merchant-initials {
    padding: 0;
  }

  .kp-merchant-initials {
    display: inline-flex; align-items: center; justify-content: center;
    background: var(--kp-accent);
    color: var(--kp-on-accent, #fff);
    font-size: 10.5px;
    font-weight: 700;
    letter-spacing: 0.02em;
  }

  .kp-link-strip {
    padding: 14px 20px 0;
    flex-shrink: 0;
  }

  .kp-link-strip-title {
    font-size: 14px;
    font-weight: 600;
    color: var(--kp-text);
    letter-spacing: -0.01em;
    line-height: 1.35;
    overflow-wrap: anywhere;
  }

  .kp-link-strip-meta {
    margin-top: 2px;
    font-size: 11px;
    color: var(--kp-muted);
  }

  .kp-link-hero {
    position: relative;
    margin: 4px 0 0;
  }

  .kp-link-cover {
    position: relative;
    aspect-ratio: 16 / 9;
    border-radius: 16px;
    overflow: hidden;
    background: var(--kp-surface);
    box-shadow: inset 0 0 0 1px rgba(255,255,255,0.06);
  }

  .kp-link-cover::after {
    content: '';
    position: absolute; inset: 0;
    border-radius: inherit;
    box-shadow: inset 0 0 0 1px rgba(255,255,255,0.08);
    pointer-events: none;
  }

  .kp-link-cover img {
    width: 100%; height: 100%;
    object-fit: cover;
    display: block;
    opacity: 0;
    transform: scale(1.025);
    transition: opacity 0.5s ease, transform 0.9s cubic-bezier(0.16, 1, 0.3, 1);
  }

  .kp-link-cover img.is-loaded { opacity: 1; transform: none; }

  .kp-link-identity {
    position: relative;
    display: flex; align-items: flex-end; gap: 12px;
    margin: 4px 0 18px;
  }

  .kp-link-identity.on-cover {
    margin-top: -26px;
    padding-left: 14px;
  }

  .kp-link-identity-name {
    min-width: 0;
    padding-bottom: 2px;
    font-size: 15px;
    font-weight: 600;
    line-height: 1.3;
    color: var(--kp-text);
    letter-spacing: -0.01em;
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }

  .kp-link-badge {
    width: 56px; height: 56px;
    border-radius: 16px;
    background: #fff;
    padding: 7px;
    object-fit: contain;
    box-shadow: 0 0 0 1px rgba(255,255,255,0.1), 0 6px 18px rgba(0,0,0,0.35);
  }

  .kp-link-identity.on-cover .kp-link-badge {
    box-shadow: 0 0 0 3px var(--kp-bg), 0 0 0 4px rgba(255,255,255,0.08), 0 8px 20px rgba(0,0,0,0.35);
  }

  .kp-link-badge.kp-merchant-initials {
    display: inline-flex; align-items: center; justify-content: center;
    padding: 0;
    font-size: 18px;
    font-weight: 700;
    letter-spacing: 0.01em;
  }

  .kp-link-strip {
    display: flex; align-items: center; gap: 12px;
  }

  .kp-link-strip-thumb {
    width: 40px; height: 40px;
    border-radius: 10px;
    object-fit: cover;
    flex-shrink: 0;
    box-shadow: inset 0 0 0 1px rgba(255,255,255,0.08);
    background: var(--kp-surface);
  }

  .kp-link-strip-text { min-width: 0; }

  @media (prefers-reduced-motion: reduce) {
    .kp-link-cover img { transition: none; transform: none; }
  }

  .kp-link-eyebrow {
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--kp-accent);
    margin-bottom: 6px;
  }

  .kp-link-title {
    font-size: 20px;
    font-weight: 700;
    color: var(--kp-text);
    letter-spacing: -0.02em;
    line-height: 1.25;
    overflow-wrap: anywhere;
  }

  .kp-link-desc {
    margin-top: 8px;
    font-size: 13px;
    line-height: 1.6;
    color: var(--kp-muted);
    white-space: pre-line;
    overflow-wrap: anywhere;
  }

  .kp-link-meta {
    display: flex; align-items: center; gap: 6px;
    margin-top: 10px;
    font-size: 12px;
    color: var(--kp-text);
  }

  .kp-link-meta .material-symbols-outlined { font-size: 15px; color: var(--kp-muted); }

  .kp-link-progress { margin-top: 16px; }

  .kp-link-progress-row {
    display: flex; justify-content: space-between; gap: 12px;
    font-size: 12px;
    color: var(--kp-muted);
  }

  .kp-link-progress-row span:first-child { color: var(--kp-text); font-weight: 600; }

  .kp-link-progress-track {
    margin-top: 8px;
    height: 6px;
    border-radius: 999px;
    background: var(--kp-surface-2);
    overflow: hidden;
  }

  .kp-link-progress-fill {
    height: 100%;
    border-radius: 999px;
    background: var(--kp-accent);
    transition: width 0.7s cubic-bezier(0.16, 1, 0.3, 1);
  }

  .kp-link-progress-note { margin-top: 6px; font-size: 11px; color: var(--kp-muted); }

  .kp-link-section {
    margin-top: 18px;
    padding-top: 16px;
    border-top: 1px solid var(--kp-border);
  }

  .kp-link-fixed .kp-amount-value { font-size: 28px; }

  .kp-field + .kp-field, .kp-link-fixed + .kp-field { margin-top: 14px; }

  .kp-field-label {
    display: flex; justify-content: space-between; align-items: baseline;
    font-size: 12px;
    font-weight: 500;
    color: var(--kp-text);
    margin-bottom: 7px;
  }

  .kp-field-optional { font-size: 11px; color: var(--kp-muted); font-weight: 400; }

  .kp-input {
    width: 100%;
    height: 46px;
    padding: 0 14px;
    border-radius: 12px;
    border: 1px solid var(--kp-border);
    background: var(--kp-surface);
    color: var(--kp-text);
    font-family: var(--kp-sans);
    font-size: 16px;
    outline: none;
    transition: border-color 0.15s, box-shadow 0.15s;
  }

  #kwespay-widget-overlay { color-scheme: dark; }
  .kp-input::placeholder { color: var(--kp-muted); }
  .kp-input:-webkit-autofill,
  .kp-input:-webkit-autofill:hover,
  .kp-input:-webkit-autofill:focus {
    -webkit-text-fill-color: var(--kp-text);
    caret-color: var(--kp-text);
    -webkit-box-shadow: 0 0 0 1000px var(--kp-surface) inset;
    box-shadow: 0 0 0 1000px var(--kp-surface) inset;
    transition: background-color 9999s ease-out 0s;
  }
  .kp-input:-webkit-autofill:focus {
    -webkit-box-shadow: 0 0 0 1000px var(--kp-surface) inset, 0 0 0 3px var(--kp-accent-dim);
    box-shadow: 0 0 0 1000px var(--kp-surface) inset, 0 0 0 3px var(--kp-accent-dim);
  }
  .kp-input:focus { border-color: var(--kp-border-active); box-shadow: 0 0 0 3px var(--kp-accent-dim); }
  .kp-input[aria-invalid="true"] { border-color: rgba(244,63,94,0.6); }

  .kp-input-wrap {
    display: flex; align-items: center;
    height: 50px;
    border-radius: 12px;
    border: 1px solid var(--kp-border);
    background: var(--kp-surface);
    transition: border-color 0.15s, box-shadow 0.15s;
  }

  .kp-input-wrap:focus-within { border-color: var(--kp-border-active); box-shadow: 0 0 0 3px var(--kp-accent-dim); }
  .kp-input-wrap .kp-input { border: none; background: transparent; box-shadow: none; height: 100%; padding-left: 8px; font-size: 20px; font-weight: 700; letter-spacing: -0.02em; }
  .kp-input-wrap .kp-input:focus { box-shadow: none; }
  .kp-input-wrap:has(.kp-input[aria-invalid="true"]) { border-color: rgba(244,63,94,0.6); }

  .kp-input-prefix {
    padding-left: 14px;
    font-size: 13px;
    font-weight: 600;
    color: var(--kp-muted);
  }

  .kp-suggest-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 8px;
    margin-bottom: 10px;
  }

  .kp-suggest {
    height: 42px;
    border-radius: 10px;
    border: 1px solid var(--kp-border);
    background: var(--kp-surface);
    color: var(--kp-text);
    font-family: var(--kp-sans);
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    transition: border-color 0.15s, background 0.15s, transform 0.1s;
  }

  .kp-suggest:hover { border-color: var(--kp-border-active); }
  .kp-suggest:active { transform: scale(0.98); }
  .kp-suggest[aria-pressed="true"] { border-color: var(--kp-accent); background: var(--kp-accent-dim); }

  .kp-field-hint { margin-top: 7px; font-size: 11px; color: var(--kp-muted); }
  .kp-field-error { margin-top: 6px; font-size: 12px; color: var(--kp-red); }
  .kp-field-error:empty { display: none; }

  .kp-link-support {
    margin-top: 18px;
    font-size: 12px;
    line-height: 1.6;
    color: var(--kp-muted);
    white-space: pre-line;
  }

  .kp-link-closed-icon { color: var(--kp-muted); margin-bottom: 14px; line-height: 0; }
  .kp-link-closed-icon svg, .kp-link-closed-icon .material-symbols-outlined { width: 32px; height: 32px; font-size: 32px; }
  .kp-link-closed-title {
    margin-top: 6px;
    font-size: 12px;
    color: var(--kp-text);
    text-align: center;
  }

  .kwespay-container :focus-visible { outline: 2px solid var(--kp-accent); outline-offset: 2px; }
  .kwespay-container .kp-input:focus-visible { outline: none; }


  .kp-cc-section { margin-top: 18px; }
  .kp-cc-entry {
    width: 100%; text-align: left; font: inherit; color: inherit;
    border-color: var(--kp-border-active);
    background: linear-gradient(135deg, rgba(99,102,241,0.12), rgba(99,102,241,0.03));
  }
  .kp-cc-entry .item-name { font-size: 14px; }
  .kp-cc-entry .item-info { min-width: 0; }
  .kp-cc-stack { display: flex; flex-shrink: 0; padding-left: 7px; }
  .kp-cc-stack img, .kp-cc-stack .kp-logo-fallback {
    width: 26px; height: 26px; margin-left: -7px; border-radius: 50%; object-fit: cover;
    display: flex; align-items: center; justify-content: center; font-size: 11px;
    background: var(--kp-surface-2); box-shadow: 0 0 0 2px var(--kp-surface);
  }
  .kp-cc-mark { position: relative; width: 36px; height: 36px; flex-shrink: 0; }
  .kp-cc-mark .kp-cc-coin, .kp-cc-mark .kp-logo-fallback {
    width: 36px; height: 36px; border-radius: 50%; object-fit: cover; display: flex;
    align-items: center; justify-content: center; font-size: 14px; font-weight: 600;
    color: var(--kp-text); background: var(--kp-surface-2);
  }
  .kp-cc-mark .kp-cc-chain {
    position: absolute; right: -3px; bottom: -3px; width: 16px; height: 16px; border-radius: 50%;
    object-fit: cover; background: var(--kp-surface-2); box-shadow: 0 0 0 2px var(--kp-surface);
  }
  .kp-cc-primary { border-color: var(--kp-border-active); background: linear-gradient(135deg, rgba(99,102,241,0.12), rgba(99,102,241,0.03)); }
  .kp-cc-wallet-status {
    display: flex; flex-direction: column; gap: 3px; padding: 12px 14px; margin-bottom: 12px; border-radius: 12px;
    background: var(--kp-accent-dim); border: 1px solid var(--kp-border-active); font-size: 12px; color: var(--kp-muted);
  }
  .kp-cc-wallet-status strong { font-size: 13px; color: var(--kp-text); }
  .kp-cc-wallet-status.is-ok { background: rgba(16,185,129,0.08); border-color: rgba(16,185,129,0.35); }
  .kp-cc-wallet-status.is-error { background: rgba(244,63,94,0.08); border-color: rgba(244,63,94,0.35); }
  .kp-cc-wallet-status .kp-cc-copy { align-self: flex-start; margin-top: 8px; }
  .kp-cc-deposit.is-wallet .kp-cc-qr-wrap { display: none; }
  .kp-cc-option { width: 100%; text-align: left; font: inherit; color: inherit; }
  .kp-cc-option.is-disabled { opacity: 0.5; cursor: default; }
  .kp-cc-option.is-disabled:hover { transform: none; border-color: var(--kp-border); background: var(--kp-surface); }
  .kp-cc-search { padding: 12px 20px 0; flex-shrink: 0; }
  .kp-cc-search-box {
    display: flex; align-items: center; gap: 10px; height: 44px; padding: 0 12px;
    background: var(--kp-surface); border: 1px solid var(--kp-border); border-radius: 12px;
    transition: border-color 0.15s;
  }
  .kp-cc-search-box:focus-within { border-color: var(--kp-border-active); }
  .kp-cc-search-icon { width: 16px; height: 16px; flex-shrink: 0; color: var(--kp-muted); }
  .kp-cc-search-input {
    flex: 1; min-width: 0; height: 100%; border: 0; outline: 0; background: transparent;
    color: var(--kp-text); font-family: var(--kp-sans); font-size: 16px;
  }
  .kp-cc-search-box .kp-cc-search-input:focus,
  .kp-cc-search-box .kp-cc-search-input:focus-visible { outline: none !important; box-shadow: none !important; }
  .kp-cc-search-input::placeholder { color: var(--kp-muted); }
  .kp-cc-search-clear {
    flex-shrink: 0; border: 0; background: transparent; padding: 6px 0 6px 6px; cursor: pointer;
    color: var(--kp-muted); font-family: var(--kp-sans); font-size: 12px; font-weight: 500;
  }
  .kp-cc-search-clear:hover { color: var(--kp-text); }
  .kp-cc-search-clear[hidden] { display: none; }
  .kp-cc-token-list { min-height: 200px; }
  .kp-cc-token {
    min-height: 58px; transition: none; content-visibility: auto; contain-intrinsic-size: auto 58px;
  }
  .kp-cc-token:hover { transform: none; }
  .kp-cc-token.is-active { border-color: var(--kp-border-active); background: var(--kp-accent-dim); }
  .kp-cc-token .item-name { overflow-wrap: anywhere; }
  .kp-cc-results {
    position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap;
  }
  .kp-cc-skeleton {
    height: 58px; border-radius: 12px; border: 1px solid var(--kp-border);
    background: linear-gradient(100deg, var(--kp-surface) 30%, var(--kp-surface-2) 50%, var(--kp-surface) 70%);
    background-size: 200% 100%; animation: kpCcShimmer 1.2s linear infinite;
  }
  @keyframes kpCcShimmer { from { background-position: 200% 0; } to { background-position: -200% 0; } }
  @media (prefers-reduced-motion: reduce) { .kp-cc-skeleton { animation: none; } }
  .kp-cc-price { font-size: 13px; font-weight: 600; color: var(--kp-text); white-space: nowrap; }
  .kp-cc-loading { text-align: center; padding: 24px 8px; font-size: 12px; color: var(--kp-muted); }
  .kp-cc-summary {
    display: flex; justify-content: space-between; align-items: baseline;
    padding: 14px; margin-bottom: 18px; border-radius: 12px;
    background: var(--kp-surface); border: 1px solid var(--kp-border);
    font-size: 12px; color: var(--kp-muted);
  }
  .kp-cc-summary strong { font-size: 15px; color: var(--kp-text); }
  .kp-field-help { margin-top: 8px; font-size: 11px; line-height: 1.5; color: var(--kp-muted); }
  .kp-cc-progress { margin-top: 0; flex-direction: row; justify-content: space-between; gap: 8px; padding: 10px 12px; }
  .kp-cc-progress li { font-size: 11px; align-items: center; gap: 6px; }
  .kp-cc-progress .kp-step-num { margin-top: 0; width: 18px; height: 18px; font-size: 10px; }
  .kp-cc-qr-wrap { display: flex; flex-direction: column; align-items: center; gap: 8px; font-size: 11px; color: var(--kp-muted); padding: 4px 0; }
  .kp-cc-progress li.is-active { color: var(--kp-text); }
  .kp-cc-progress li.is-active .kp-step-num { background: var(--kp-accent); color: #fff; }
  .kp-cc-progress li.is-done .kp-step-num { background: rgba(16,185,129,0.15); color: var(--kp-green); }
  .kp-cc-deposit { display: flex; flex-direction: column; gap: 12px; }
  .kp-cc-deposit[hidden], .kp-cc-status[hidden] { display: none; }
  .kp-cc-qr {
    width: 168px; height: 168px; align-self: center; padding: 10px;
    background: #fff; border-radius: 14px; box-sizing: border-box;
  }
  .kp-cc-field {
    padding: 12px 14px; border-radius: 12px;
    background: var(--kp-surface); border: 1px solid var(--kp-border);
  }
  .kp-cc-label { display: block; font-size: 11px; color: var(--kp-muted); margin-bottom: 6px; }
  .kp-cc-value-row { display: flex; align-items: center; gap: 10px; }
  .kp-cc-value { flex: 1; min-width: 0; font-size: 13px; color: var(--kp-text); word-break: break-all; line-height: 1.4; }
  .kp-cc-value.strong { font-size: 16px; font-weight: 700; }
  .kp-cc-value.mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
  .kp-cc-copy {
    flex-shrink: 0; height: 30px; padding: 0 12px; border-radius: 8px; cursor: pointer;
    border: 1px solid var(--kp-border-active); background: var(--kp-accent-dim);
    color: var(--kp-text); font: 600 12px var(--kp-sans);
  }
  .kp-cc-memo { border-color: rgba(251,191,36,0.45); background: rgba(251,191,36,0.06); }
  .kp-cc-memo .kp-cc-label { color: #fbbf24; font-weight: 600; }
  .kp-cc-memo-note { margin-top: 8px; font-size: 11px; line-height: 1.5; color: #fcd34d; }
  .kp-cc-note { font-size: 11px; line-height: 1.5; color: var(--kp-muted); }
  #kwespay-cc-timer { display: flex; justify-content: center; }
  .kp-cc-status { display: flex; flex-direction: column; align-items: center; text-align: center; padding: 24px 0; }

  @media (prefers-reduced-motion: reduce) {
    .kwespay-container, .kwespay-container * { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; }
  }
`;
