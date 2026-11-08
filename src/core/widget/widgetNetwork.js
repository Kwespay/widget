import { escapeHtml, safeImageUrl } from "../../utils/helpers.js";
import { icon } from "../../ui/icons.js";

function logoMarkup(src, label) {
  const first = String(label ?? "").trim().charAt(0).toUpperCase();
  const initial = /[A-Z0-9]/.test(first) ? first : "•";
  const url = safeImageUrl(src);
  if (!url) return `<span class="kp-logo-fallback">${initial}</span>`;
  return `<img src="${url}" alt="${escapeHtml(label)}" data-kp-fallback="${initial}" />`;
}

export const NetworkMethods = {
  _renderNetworkList() {
    const mainnetList = document.getElementById("kwespay-mainnetList");
    const testnetList = document.getElementById("kwespay-testnetList");
    const testnetSection = document.getElementById("kwespay-testnetSection");
    if (!mainnetList || !testnetList) return;

    if (!this.state.merchantConfig) return;

    mainnetList.innerHTML = "";
    testnetList.innerHTML = "";

    const enabledNetworks = this._resolveEnabledNetworks();

    let hasTestnet = false;

    enabledNetworks.forEach((networkKey) => {
      const network = this._networkConfig(networkKey);
      if (!network) return;

      const listItem = document.createElement("div");
      listItem.className = "list-item";
      listItem.innerHTML = `
        <div class="item-icon">${logoMarkup(network.logo, network.name)}</div>
        <div class="item-info">
          <div class="item-name-row">
            <p class="item-name">${escapeHtml(network.name)}</p>
          </div>
        </div>
        ${icon("chevron_right", "item-chevron")}
      `;
      listItem.addEventListener("click", () =>
        this._handleNetworkSelection(networkKey, network)
      );

      if (network.type === "mainnet") {
        mainnetList.appendChild(listItem);
      } else {
        testnetList.appendChild(listItem);
        hasTestnet = true;
      }
    });

    if (testnetSection) {
      testnetSection.style.display = hasTestnet ? "block" : "none";
    }

    if (mainnetList.children.length === 0 && !hasTestnet) {
      mainnetList.innerHTML = `<div style="text-align:center;padding:24px;font-family:var(--kp-mono);font-size:11px;color:var(--kp-muted)">No networks available for this merchant.</div>`;
    }

    this._renderCrossChainEntry?.();
  },

  _renderTokenList() {
    if (!this.state.selectedNetwork) return;
    const tokenList = document.getElementById("kwespay-tokenList");
    if (!tokenList) return;

    const acceptedSymbols = this._resolveAcceptedTokensForNetwork(
      this.state.selectedNetwork
    );

    const allTokenMeta = this._tokenConfigs(this.state.selectedNetwork);
    const tokens = allTokenMeta.filter((t) =>
      acceptedSymbols.includes(t.symbol.toUpperCase())
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
          <div class="token-icon">${logoMarkup(token.icon, token.symbol)}</div>
          <div class="token-info">
            <p class="token-symbol">${escapeHtml(token.displaySymbol ?? token.symbol)}</p>
            <p class="token-name">${escapeHtml(token.name)}</p>
          </div>
        </div>
        ${icon("chevron_right", "token-chevron")}
      `;
      tokenItem.addEventListener("click", () =>
        this._handleTokenSelection(token)
      );
      tokenList.appendChild(tokenItem);
    });
  },

  _resolveEnabledNetworks() {
    const merchantConfig = this.state.merchantConfig;

    if (!merchantConfig) {
      return [];
    }

    let networks = merchantConfig.networkTokenMap.map((n) => n.network);

    if (this.state.keyAllowedNetworks) {
      const keySet = new Set(
        this.state.keyAllowedNetworks.map((n) => n.toLowerCase())
      );
      networks = networks.filter((n) => keySet.has(n.toLowerCase()));
    }

    if (this.config.acceptedTokens) {
      const configTokenSet = new Set(
        this.config.acceptedTokens.map((t) => t.toUpperCase())
      );
      networks = networks.filter((networkKey) => {
        const sdkTokens = this._resolveAcceptedTokensForNetwork(networkKey);
        return sdkTokens.some((t) => configTokenSet.has(t));
      });
    }

    return networks.filter((n) => !!this._networkConfig(n)?.contractAddress);
  },

  _networkConfig(key) {
    return this.state.catalog?.[key]?.network ?? null;
  },

  _tokenConfigs(key) {
    return this.state.catalog?.[key]?.tokens ?? [];
  },

  _resolveAcceptedTokensForNetwork(networkKey) {
    const merchantConfig = this.state.merchantConfig;

    if (!merchantConfig) return [];

    const entry = merchantConfig.networkTokenMap.find(
      (n) => n.network === networkKey
    );
    if (!entry) return [];

    let tokens = entry.tokens.map((t) => t.toUpperCase());

    if (this.state.keyAllowedTokens) {
      const keySet = new Set(
        this.state.keyAllowedTokens.map((t) => t.toUpperCase())
      );
      tokens = tokens.filter((t) => keySet.has(t));
    }

    if (this.config.acceptedTokens) {
      const configSet = new Set(
        this.config.acceptedTokens.map((t) => t.toUpperCase())
      );
      tokens = tokens.filter((t) => configSet.has(t));
    }

    return tokens;
  },

  async _handleNetworkSelection(key, network) {
    this.state.selectedNetwork = key;
    this.state.selectedNetworkName = network.name;
    this.state.selectedChainId = network.chainId;
    this.state.selectedRpcUrl = network.rpcUrl;
    this.state.selectedContractAddress = network.contractAddress;
    this.state.selectedNetworkConfig = network;
    this.state.selectedToken = null;
    this.state.selectedTokenConfig = null;

    const nameEl = document.getElementById("kwespay-selectedNetworkName");
    if (nameEl) {
      const env = network.type === "mainnet" ? "Mainnet" : "Testnet";
      nameEl.textContent = network.name.toLowerCase().includes(env.toLowerCase())
        ? network.name
        : `${network.name} ${env}`;
    }

    const iconEl = document.getElementById("kwespay-selectedNetworkIcon");
    if (iconEl) {
      iconEl.innerHTML = logoMarkup(network.logo, network.name);
    }

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
        `#kwespay-tokenList .token-item[data-token-symbol="${CSS.escape(token.symbol)}"]`
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
