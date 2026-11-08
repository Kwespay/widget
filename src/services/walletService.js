export const EVM_MOBILE_WALLETS = [
  {
    name: "MetaMask",
    icon: "https://upload.wikimedia.org/wikipedia/commons/3/36/MetaMask_Fox.svg",
    deepLink: (uri) => `metamask://wc?uri=${encodeURIComponent(uri)}`,
    universalLink: (uri) =>
      `https://metamask.app.link/wc?uri=${encodeURIComponent(uri)}`,
    universalBase: "https://metamask.app.link",
  },
  {
    name: "Trust Wallet",
    icon: "https://trustwallet.com/assets/images/media/assets/TWT.svg",
    deepLink: (uri) => `trust://wc?uri=${encodeURIComponent(uri)}`,
    universalLink: (uri) =>
      `https://link.trustwallet.com/wc?uri=${encodeURIComponent(uri)}`,
    universalBase: "https://link.trustwallet.com",
  },
  {
    name: "Rainbow",
    icon: "https://avatars.githubusercontent.com/u/48327834?s=200&v=4",
    deepLink: (uri) => `rainbow://wc?uri=${encodeURIComponent(uri)}`,
    universalLink: (uri) =>
      `https://rnbwapp.com/wc?uri=${encodeURIComponent(uri)}`,
    universalBase: "https://rnbwapp.com",
  },
  {
    name: "Coinbase Wallet",
    icon: "https://avatars.githubusercontent.com/u/1885080?s=200&v=4",
    deepLink: (uri) => `cbwallet://wc?uri=${encodeURIComponent(uri)}`,
    universalLink: (uri) =>
      `https://go.cb-w.com/wc?uri=${encodeURIComponent(uri)}`,
    universalBase: "https://go.cb-w.com",
  },
];

class WalletService {
  constructor() {
    this.injectedProviders = [];
    this.selectedProvider = null;
    this.connectedAddress = null;
    this.connectionType = null;

    this._accountsChangedHandler = null;
    this._chainChangedHandler = null;

    const methods = [
      "isMobile",
      "isIOS",
      "discoverInjectedWallets",
      "connectInjected",
      "useExternalProvider",
      "getEvmMobileWallets",
      "getActiveChainId",
      "isSessionAlive",
      "switchNetwork",
      "disconnect",
      "_attachProviderListeners",
      "_connectionResult",
      "isConnected",
      "getAddress",
      "getProvider",
    ];
    methods.forEach((m) => {
      this[m] = this[m].bind(this);
    });
  }

  isMobile() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      navigator.userAgent
    );
  }

  getEvmMobileWallets() {
    return EVM_MOBILE_WALLETS;
  }

  isIOS() {
    return /iPhone|iPad|iPod/i.test(navigator.userAgent);
  }

  async getActiveChainId() {
    const provider = this.selectedProvider;
    if (!provider) return null;

    try {
      const raw = await provider.request({ method: "eth_chainId" });
      const chainId = parseInt(raw, 16);
      return chainId;
    } catch (err) {
      return null;
    }
  }

  async isSessionAlive() {
    if (!this.selectedProvider) return false;
    try {
      await this.selectedProvider.request({ method: "eth_chainId" });
      return true;
    } catch {
      return false;
    }
  }

  discoverInjectedWallets() {
    return new Promise((resolve) => {
      this.injectedProviders = [];

      const handler = (event) => {
        const { info, provider } = event.detail ?? {};
        if (!info || !provider) return;
        const dup = this.injectedProviders.some(
          (p) => p.info.uuid === info.uuid
        );
        if (!dup) this.injectedProviders.push({ info, provider });
      };

      window.addEventListener("eip6963:announceProvider", handler);
      window.dispatchEvent(new Event("eip6963:requestProvider"));

      setTimeout(() => {
        window.removeEventListener("eip6963:announceProvider", handler);

        if (this.injectedProviders.length === 0 && window.ethereum) {
          this.injectedProviders.push({
            info: {
              uuid: "legacy",
              name: window.ethereum.isMetaMask ? "MetaMask" : "Browser Wallet",
              icon: window.ethereum.isMetaMask
                ? "https://upload.wikimedia.org/wikipedia/commons/3/36/MetaMask_Fox.svg"
                : null,
            },
            provider: window.ethereum,
          });
        }

        resolve(this.injectedProviders);
      }, 300);
    });
  }

  async connectInjected(index) {
    const entry = this.injectedProviders[index];
    if (!entry)
      throw new Error(`[WalletService] No injected provider at index ${index}`);

    let accounts;
    try {
      accounts = await entry.provider.request({
        method: "eth_requestAccounts",
      });
    } catch (err) {
      if (err.code === 4001) {
        const e = new Error("User rejected the connection");
        e.code = "USER_CANCELLED";
        throw e;
      }
      throw err;
    }

    if (!accounts?.length) {
      const e = new Error("No accounts returned");
      e.code = "USER_CANCELLED";
      throw e;
    }

    this.selectedProvider = entry.provider;
    this.connectedAddress = accounts[0];
    this.connectionType = "injected";

    this._attachProviderListeners(entry.provider);

    return this._connectionResult();
  }

  useExternalProvider(provider, address, connectionType = "walletconnect") {
    if (!provider) throw new Error("[WalletService] No external provider given");

    this.selectedProvider = provider;
    this.connectedAddress = address;
    this.connectionType = connectionType;

    this._attachProviderListeners(provider);

    return this._connectionResult();
  }

  async switchNetwork(
    chainId,
    networkName,
    rpcUrl,
    tokenSymbol,
    tokenDecimals
  ) {
    const provider = this.selectedProvider;
    if (!provider) throw new Error("[WalletService] No provider connected");

    const targetHex = "0x" + chainId.toString(16);

    try {
      await provider.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: targetHex }],
      });
    } catch (err) {
      if (err.code === 4902 || err.code === -32603) {
        await provider.request({
          method: "wallet_addEthereumChain",
          params: [
            {
              chainId: targetHex,
              chainName: networkName,
              rpcUrls: [rpcUrl],
              nativeCurrency: {
                name: tokenSymbol,
                symbol: tokenSymbol,
                decimals: tokenDecimals,
              },
            },
          ],
        });
      } else {
        throw err;
      }
    }
  }

  _attachProviderListeners(provider) {
    this._accountsChangedHandler = (accounts) => {
      this.connectedAddress = accounts[0] ?? null;
    };

    this._chainChangedHandler = (chain) => {};

    provider.on("accountsChanged", this._accountsChangedHandler);
    provider.on("chainChanged", this._chainChangedHandler);
  }

  async disconnect() {
    if (this.selectedProvider) {
      try {
        this.selectedProvider.removeListener?.(
          "accountsChanged",
          this._accountsChangedHandler
        );
      } catch (_) {}
      try {
        this.selectedProvider.removeListener?.(
          "chainChanged",
          this._chainChangedHandler
        );
      } catch (_) {}
    }

    this.selectedProvider = null;
    this.connectedAddress = null;
    this.connectionType = null;
  }

  _connectionResult() {
    return {
      address: this.connectedAddress,
      shortAddress: this._truncate(this.connectedAddress),
      provider: this.selectedProvider,
      connectionType: this.connectionType,
    };
  }

  _truncate(addr) {
    if (!addr) return "";
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  }

  isConnected() {
    return !!this.connectedAddress;
  }
  getAddress() {
    return this.connectedAddress;
  }
  getProvider() {
    return this.selectedProvider;
  }
}

export default WalletService;
