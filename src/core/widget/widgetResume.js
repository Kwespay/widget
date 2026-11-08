import { escapeHtml, safeImageUrl } from "../../utils/helpers.js";

import {
  clearResumeState,
  saveResumeState,
} from "../../utils/mobileResume.js";
import SuiWalletService from "../../services/Suiwalletservice.js";
import { ensureBuffer } from "../../utils/nodeGlobals.js";

export const ResumeMethods = {
  _persistResumeState(ecosystem) {
    if (!this.state.selectedNetwork || !this.state.selectedToken) return;
    saveResumeState({
      config: {
        apiKey: this.config.apiKey,
        paymentLink: this.config.paymentLink,
        presentation: this.config.presentation,
        customer: this.config.customer,
        linkAttemptKey: this.paymentService.idempotencyKey ?? null,
        graphqlEndpoint: this.config.graphqlEndpoint,
        vendorId: this.config.vendorId,
        amount: this.config.amount,
        currency: this.config.currency,
        acceptedTokens: this.config.acceptedTokens,
        projectId: this.config.projectId,
        appName: this.config.appName,
      },
      flow: {
        network: this.state.selectedNetwork,
        token: this.state.selectedToken,
        ecosystem,
        chainId: this.state.selectedChainId,
        address: this.state.payerWalletAddress ?? null,
      },
    });
  },

  _renderResumeConnectingStep() {
    this._removeCustomStep("kwespay-step-resuming");
    const container = document.getElementById("kwespay-widget-container");
    if (!container) return;
    const step = document.createElement("div");
    step.className = "step";
    step.id = "kwespay-step-resuming";
    step.innerHTML = `
      <div class="kp-topbar">
        <div class="kp-topbar-brand">
          <span class="kp-topbar-name">Reconnecting…</span>
        </div>
      </div>
      <div class="content-scroll" style="flex:1;display:flex;align-items:center;justify-content:center">
        <div style="width:30px;height:30px;border:3px solid var(--kp-border);border-top-color:var(--kp-accent);border-radius:50%;animation:kpSpin 0.85s linear infinite"></div>
      </div>
    `;
    container.appendChild(step);
    this._goToStep("resuming");
  },

  async _resumeMobileFlow(flow) {
    const network = this._networkConfig(flow?.network);
    const tokenCfg = this._tokenConfigs(flow?.network).find(
      (t) => t.symbol === flow?.token
    );

    if (!network || !tokenCfg) {
      clearResumeState();
      if (this._isCurrentInstance()) {
        this._removeCustomStep("kwespay-step-resuming");
        this._renderNetworkList();
        this._goToStep(1);
      }
      return false;
    }

    if (!document.getElementById("kwespay-step-resuming")) {
      this._renderResumeConnectingStep();
    }

    this.state.selectedNetwork = flow.network;
    this.state.selectedNetworkName = network.name;
    this.state.selectedChainId = network.chainId;
    this.state.selectedRpcUrl = network.rpcUrl;
    this.state.selectedContractAddress = network.contractAddress;
    this.state.selectedNetworkConfig = network;
    this.state.selectedToken = tokenCfg.symbol;
    this.state.selectedTokenConfig = tokenCfg;

    const ecosystem = network.ecosystem;
    let connected = false;

    try {
      if (ecosystem === "evm") {
        await ensureBuffer();
        const { default: EvmMobileTransport } = await import(
          "../../services/EvmMobileTransport.js"
        );
        const transport = EvmMobileTransport.get(this.config.projectId);
        const restored = await transport.restore(
          network.chainId,
          network.rpcUrl
        );
        if (restored?.address) {
          this._activeEvmTransport = transport;
          this.walletService.useExternalProvider(
            transport.getProvider(),
            restored.address,
            "evm-wc"
          );
          this.state.payerWalletAddress = restored.address;
          connected = true;
        }
      } else if (ecosystem === "sui") {
        await ensureBuffer();
        const { default: SuiMobileTransport } = await import(
          "../../services/SuiMobileTransport.js"
        );
        const transport = SuiMobileTransport.get(this.config.projectId);
        const restored = await transport.restore(network.chainId);
        if (restored?.address) {
          this.suiMobileTransport = transport;
          this._activeSuiTransport = transport;
          this.state.payerWalletAddress = restored.address;
          connected = true;
        } else {
          const address = await this._trySlushSilentRestore(network.chainId);
          if (address) {
            this._activeSuiTransport = null;
            this.state.payerWalletAddress = address;
            connected = true;
          }
        }
      } else if (ecosystem === "stellar") {
        await ensureBuffer();
        const { default: StellarMobileTransport } = await import(
          "../../services/StellarMobileTransport.js"
        );
        const transport = StellarMobileTransport.get(this.config.projectId);
        const restored = await transport.restore(network.chainId);
        if (restored?.address) {
          this._activeStellarTransport = transport;
          this.state.payerWalletAddress = restored.address;
          connected = true;
        }
      }
    } catch {}

    if (!this._isCurrentInstance()) {
      clearResumeState();
      return connected;
    }

    this._removeCustomStep("kwespay-step-resuming");

    if (connected) {
      const shortAddr = this.state.payerWalletAddress
        ? `${this.state.payerWalletAddress.slice(0, 6)}...${this.state.payerWalletAddress.slice(-4)}`
        : "";
      const addressEl = document.getElementById(
        "kwespay-connectedWalletAddress"
      );
      if (addressEl && shortAddr) addressEl.textContent = shortAddr;
      const networkEl = document.getElementById("kwespay-summaryNetwork");
      if (networkEl) networkEl.textContent = this.state.selectedNetworkName;
      const tokenEl = document.getElementById("kwespay-summaryToken");
      if (tokenEl) tokenEl.textContent = this.state.selectedToken;

      this._goToStep(3);
      try {
        await this._loadReviewStep();
      } catch {}
      clearResumeState();
      return true;
    }

    clearResumeState();

    const nameEl = document.getElementById("kwespay-selectedNetworkName");
    if (nameEl) {
      nameEl.textContent = `${network.name} ${
        network.type === "mainnet" ? "Mainnet" : "Testnet"
      }`;
    }
    const iconEl = document.getElementById("kwespay-selectedNetworkIcon");
    if (iconEl) {
      iconEl.innerHTML = `<img src="${safeImageUrl(network.logo)}" alt="${escapeHtml(network.name)}" />`;
    }
    this._renderTokenList();
    document
      .querySelector(
        `#kwespay-tokenList .token-item[data-token-symbol="${CSS.escape(tokenCfg.symbol)}"]`
      )
      ?.classList.add("selected");

    this._goToStep(2);
    const continueBtn = document.getElementById(
      "kwespay-continueToWalletConnect"
    );
    if (continueBtn) continueBtn.disabled = false;
    return false;
  },

  async _trySlushSilentRestore(chainId) {
    try {
      if (!this.suiWalletService) {
        this.suiWalletService = new SuiWalletService();
      }
      await this.suiWalletService.ensureSlushWebWallet(
        this.config?.appName || this.config?.vendorName || document.title
      );
      const found = await this.suiWalletService.discoverWallets();
      const slush = found.find((w) =>
        w.name.toLowerCase().includes("slush")
      );
      if (!slush) return null;
      const conn = await this.suiWalletService.connect(slush, chainId, {
        silent: true,
      });
      return conn?.address ?? null;
    } catch {
      return null;
    }
  },
};
