import { NETWORK_CONFIGS, TOKEN_CONFIGS } from "../../config/constants.js";

export const NetworkMethods = {
  _renderNetworkList() {
    const mainnetList = document.getElementById("kwespay-mainnetList");
    const testnetList = document.getElementById("kwespay-testnetList");
    const testnetSection = document.getElementById("kwespay-testnetSection");
    if (!mainnetList || !testnetList) return;

    mainnetList.innerHTML = "";
    testnetList.innerHTML = "";

    const scopeNetworks = this.state.keyAllowedNetworks
      ? new Set(this.state.keyAllowedNetworks.map((n) => n.toLowerCase()))
      : null;
    const scopeTokens = this._effectiveAllowedTokens();

    let hasTestnet = false;

    Object.entries(NETWORK_CONFIGS).forEach(([key, network]) => {
      if (scopeNetworks && !scopeNetworks.has(key.toLowerCase())) return;
      if (scopeTokens) {
        const networkTokens = (TOKEN_CONFIGS[key] || []).map((t) =>
          t.symbol.toUpperCase()
        );
        if (!scopeTokens.some((t) => networkTokens.includes(t))) return;
      }

      const listItem = document.createElement("div");
      listItem.className = "list-item";
      listItem.innerHTML = `
        <div class="item-icon"><img src="${network.logo}" alt="${network.name}" /></div>
        <div class="item-info">
          <div class="item-name-row">
            <p class="item-name">${network.name}</p>
            
          </div>
       
        </div>
        <span class="material-symbols-outlined item-chevron">chevron_right</span>
      `;
      listItem.addEventListener("click", () =>
        this._handleNetworkSelection(key, network)
      );

      if (network.type === "mainnet") mainnetList.appendChild(listItem);
      else {
        testnetList.appendChild(listItem);
        hasTestnet = true;
      }
    });

    if (testnetSection)
      testnetSection.style.display = hasTestnet ? "block" : "none";
  },

  _renderTokenList() {
    if (!this.state.selectedNetwork) return;
    const tokenList = document.getElementById("kwespay-tokenList");
    if (!tokenList) return;

    const scopeTokens = this._effectiveAllowedTokens();
    let tokens = TOKEN_CONFIGS[this.state.selectedNetwork] || [];
    if (scopeTokens)
      tokens = tokens.filter((t) =>
        scopeTokens.includes(t.symbol.toUpperCase())
      );

    tokenList.innerHTML = "";
    if (tokens.length === 0) {
      tokenList.innerHTML = `<div style="text-align:center;padding:24px;font-family:var(--kp-mono);font-size:11px;color:var(--kp-muted)">No accepted tokens on this network.</div>`;
      return;
    }

    tokens.forEach((token) => {
      const tokenItem = document.createElement("div");
      tokenItem.className = "token-item";
      tokenItem.setAttribute("data-token-symbol", token.symbol);
      tokenItem.innerHTML = `
        <div class="token-left">
          <div class="token-icon"><img src="${token.icon}" alt="${token.symbol}" /></div>
          <div class="token-info">
            <p class="token-symbol">${token.symbol}</p>
            <p class="token-name">${token.name}</p>
          </div>
        </div>
        <span class="material-symbols-outlined token-chevron">chevron_right</span>
      `;
      tokenItem.addEventListener("click", () =>
        this._handleTokenSelection(token)
      );
      tokenList.appendChild(tokenItem);
    });
  },

  _effectiveAllowedTokens() {
    const keyTokens =
      this.state.keyAllowedTokens?.map((t) => t.toUpperCase()) ?? null;
    const configTokens = this.config.acceptedTokens;
    if (!keyTokens && !configTokens) return null;
    if (!keyTokens) return configTokens;
    if (!configTokens) return keyTokens;
    return keyTokens.filter((t) => configTokens.includes(t));
  },

  async _handleNetworkSelection(key, network) {
    this.state.selectedNetwork = key;
    this.state.selectedNetworkName = network.name;
    this.state.selectedChainId = network.chainId;
    this.state.selectedRpcUrl = network.rpcUrl;
    this.state.selectedContractAddress = network.contractAddress;
    this.state.selectedToken = null;
    this.state.selectedTokenConfig = null;

    const nameEl = document.getElementById("kwespay-selectedNetworkName");
    if (nameEl)
      nameEl.textContent = `${network.name} ${
        network.type === "mainnet" ? "Mainnet" : "Testnet"
      }`;

    const iconEl = document.getElementById("kwespay-selectedNetworkIcon");
    if (iconEl)
      iconEl.innerHTML = `<img src="${network.logo}" alt="${network.name}" />`;

    const continueBtn = document.getElementById(
      "kwespay-continueToWalletConnect"
    );
    if (continueBtn) continueBtn.disabled = true;

    this._renderTokenList();
    this._goToStep(2);
  },

  _handleTokenSelection(token) {
    document
      .querySelectorAll("#kwespay-tokenList .token-item")
      .forEach((item) => item.classList.remove("selected"));
    document
      .querySelector(
        `#kwespay-tokenList .token-item[data-token-symbol="${token.symbol}"]`
      )
      ?.classList.add("selected");

    this.state.selectedToken = token.symbol;
    this.state.selectedTokenConfig = token;

    const continueBtn = document.getElementById(
      "kwespay-continueToWalletConnect"
    );
    if (continueBtn) continueBtn.disabled = false;
  },
};
