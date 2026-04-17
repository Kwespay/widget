import { EthereumProvider } from "@walletconnect/ethereum-provider";
import { NETWORK_CONFIGS } from "../config/constants.js";

const WC_PROJECT_ID = "3a2347dfc8ba5a336fe715a34644f490";

const MOBILE_WALLETS = [
  {
    name: "MetaMask",
    icon: "https://upload.wikimedia.org/wikipedia/commons/3/36/MetaMask_Fox.svg",
    universalLink: (uri) =>
      `https://metamask.app.link/wc?uri=${encodeURIComponent(uri)}`,
  },
  {
    name: "Trust Wallet",
    icon: "https://trustwallet.com/assets/images/favicon.png",
    universalLink: (uri) =>
      `https://link.trustwallet.com/wc?uri=${encodeURIComponent(uri)}`,
  },
  {
    name: "Rainbow",
    icon: "https://rainbow.me/favicon.ico",
    universalLink: (uri) =>
      `https://rnbwapp.com/wc?uri=${encodeURIComponent(uri)}`,
  },
  {
    name: "Coinbase Wallet",
    icon: "https://www.coinbase.com/favicon.ico",
    universalLink: (uri) =>
      `https://go.cb-w.com/wc?uri=${encodeURIComponent(uri)}`,
  },
];

class WalletService {
  constructor() {
    this.injectedProviders = [];
    this.selectedProvider = null;
    this.wcProvider = null;
    this.connectedAddress = null;
    this.connectionType = null; // "injected" | "walletconnect"

    // True only after the WC "connect" event fires and session is stable.
    // All chain/account reads are unsafe before this is true.
    this._wcSessionReady = false;

    this._accountsChangedHandler = null;
    this._chainChangedHandler = null;
    this._wcSessionRequestSentHandler = null;
    this._onWCUri = null;
    this._onWCConnected = null;
    this._onWCDisconnected = null;

    const methods = [
      "isMobile",
      "isIOS",
      "discoverInjectedWallets",
      "connectInjected",
      "initWalletConnect",
      "connectWalletConnect",
      "getActiveChainId",
      "getApprovedChainIds",
      "isSessionAlive",
      "switchNetwork",
      "disconnect",
      "_openWalletForApproval",
      "_attachProviderListeners",
      "_cleanupWC",
      "_connectionResult",
      "isConnected",
      "getAddress",
      "getProvider",
      "getMobileWallets",
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

  isIOS() {
    return /iPhone|iPad|iPod/i.test(navigator.userAgent);
  }



  /**
   * Live active chain from the wallet via eth_chainId RPC.
   *
   * This is the ONLY reliable source of truth for the active chain.
   * Session namespace account ordering is wallet-defined (MetaMask puts
   * Mainnet first regardless of active chain) and must NOT be used to
   * infer the active chain.
   *
   * @returns {Promise<number|null>}
   */
  async getActiveChainId() {
    const provider = this.selectedProvider;
    if (!provider) return null;

    try {
      const raw = await provider.request({ method: "eth_chainId" });
      const chainId = parseInt(raw, 16);
      console.log("[WalletService] eth_chainId RPC →", chainId);
      return chainId;
    } catch (err) {
      console.error("[WalletService] eth_chainId RPC failed:", err.message);
      return null;
    }
  }

  /**
   * All chain IDs the wallet approved in this WC session.
   * Parsed from session.namespaces.eip155.accounts (CAIP-10).
   * For informational / logging use only.
   *
   * @returns {number[]}
   */
  getApprovedChainIds() {
    if (!this._wcSessionReady) return [];

    const accounts =
      this.wcProvider?.session?.namespaces?.eip155?.accounts ?? [];
    const ids = new Set();

    for (const acct of accounts) {
      const parts = acct.split(":");
      const chainId = parseInt(parts[1], 10);
      if (parts.length >= 3 && !isNaN(chainId) && chainId > 0) {
        ids.add(chainId);
      }
    }

    return [...ids];
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

        console.log(
          `[WalletService] Injected providers found (${this.injectedProviders.length}):`,
          this.injectedProviders.map((p) => p.info.name)
        );
        resolve(this.injectedProviders);
      }, 300);
    });
  }


  async connectInjected(index) {
    const entry = this.injectedProviders[index];
    if (!entry)
      throw new Error(`[WalletService] No injected provider at index ${index}`);

    console.log(`[WalletService] Connecting injected: ${entry.info.name}`);

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
    this._wcSessionReady = false;

    this._attachProviderListeners(entry.provider);

    const activeChain = await this.getActiveChainId();
    console.log(
      `[WalletService] Injected connected — address: ${this.connectedAddress} | chain: ${activeChain}`
    );

    return this._connectionResult();
  }



  async initWalletConnect(onUri, onConnected, onDisconnected) {
    // Tear down any existing provider before creating a new one
    const { EthereumProvider } = await import(
      "@walletconnect/ethereum-provider"
    );
    if (this.wcProvider) {
      try {
        await this.wcProvider.disconnect();
      } catch (_) {}
      this.wcProvider = null;
    }

    this._wcSessionReady = false;

    const allChainIds = Object.values(NETWORK_CONFIGS).map((n) => n.chainId);
    const rpcMap = {};
    Object.values(NETWORK_CONFIGS).forEach((n) => {
      rpcMap[n.chainId] = n.rpcUrl;
    });

    console.log(
      "[WalletService] Initializing WalletConnect — supported chains:",
      allChainIds
    );

    const provider = await EthereumProvider.init({
      projectId: WC_PROJECT_ID,
      optionalChains: allChainIds,
      showQrModal: false,
      rpcMap,
      metadata: {
        name: "KwesPay",
        description: "Crypto payment widget",
        url: window.location.origin,
        icons: ["https://arthuremma2.github.io/img-hosting/kwespay-icon.png"],
      },
    });

    this._onWCUri = onUri;
    this._onWCConnected = onConnected;
    this._onWCDisconnected = onDisconnected;


    provider.on("display_uri", (uri) => {
      if (this._onWCUri) this._onWCUri(uri);
    });

    provider.on("connect", async () => {
      const session = provider.session;
      const accounts = session?.namespaces?.eip155?.accounts ?? [];

      if (accounts.length === 0) {
        console.error(
          "[WalletService] WC connected but session has no accounts"
        );
        return;
      }


      const address = accounts[0].split(":")[2];

      this.wcProvider = provider;
      this.selectedProvider = provider;
      this.connectedAddress = address;
      this.connectionType = "walletconnect";
      this._wcSessionReady = true;

      this._attachProviderListeners(provider);

      // Use live RPC — session account ordering is NOT reliable for active chain
      const activeChain = await this.getActiveChainId();
      const approvedChains = this.getApprovedChainIds();

      console.log(
        `[WalletService] WC session ready — address: ${address} | active chain: ${activeChain} | approved chains: [${approvedChains}]`
      );

      if (this._onWCConnected) this._onWCConnected();
    });


    provider.on("disconnect", () => {
      console.log("[WalletService] WC session disconnected");
      this._cleanupWC();
      if (this._onWCDisconnected) this._onWCDisconnected();
    });

  
    provider.on("chainChanged", (chainId) => {
      if (this._wcSessionReady) {
        console.log(
          "[WalletService] WC chainChanged event — new chain:",
          parseInt(chainId, 16)
        );
      }
    });


    this._wcSessionRequestSentHandler = () => {
      if (!this.isMobile()) return;
      console.log(
        "[WalletService] session_request_sent — opening wallet for approval"
      );
      this._openWalletForApproval();
    };
    provider.on("session_request_sent", this._wcSessionRequestSentHandler);

    this.wcProvider = provider;
    return provider;
  }



  async connectWalletConnect(targetChainId) {
    if (!this.wcProvider)
      throw new Error("[WalletService] Call initWalletConnect first");

    if (!targetChainId) {
      throw new Error(
        "[WalletService] targetChainId is required for connectWalletConnect"
      );
    }

    console.log(
      `[WalletService] Starting WC handshake — requesting session on chain ${targetChainId}`
    );

    await this.wcProvider.connect({
      optionalNamespaces: {
        eip155: {
          methods: [
            "eth_sendTransaction",
            "eth_signTransaction",
            "eth_sign",
            "personal_sign",
            "eth_signTypedData",
          ],
          chains: [`eip155:${targetChainId}`],
          events: ["chainChanged", "accountsChanged"],
        },
      },
    });
  }


  _openWalletForApproval() {
    const session = this.wcProvider?.session;
    const native = session?.peer?.metadata?.redirect?.native;
    const universal = session?.peer?.metadata?.redirect?.universal;
    const target = native || universal;

    if (!target) {
      console.warn(
        "[WalletService] No redirect URI in session metadata — user must switch manually"
      );
      return;
    }

    if (this.isIOS()) {
      // window.open is blocked by Safari outside a user gesture — use href instead
      window.location.href = target;
    } else {
      window.open(target, "_blank", "noreferrer noopener");
    }
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
        // Chain not known to wallet — add it first
        console.log(
          `[WalletService] Chain ${networkName} unknown to wallet — adding it`
        );
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
        console.log(`[WalletService] Chain ${networkName} added and switched`);
      } else {
        throw err;
      }
    }
  }


  _attachProviderListeners(provider) {
    this._accountsChangedHandler = (accounts) => {
      console.log("[WalletService] accountsChanged →", accounts[0] ?? "none");
      this.connectedAddress = accounts[0] ?? null;
    };

    this._chainChangedHandler = (chain) => {
      // Only log for injected — WC chainChanged is already logged above
      if (this.connectionType === "injected") {
        console.log(
          "[WalletService] chainChanged (injected) →",
          parseInt(chain, 16)
        );
      }
    };

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

    this._cleanupWC();

    this.selectedProvider = null;
    this.connectedAddress = null;
    this.connectionType = null;
    this._wcSessionReady = false;

    console.log("[WalletService] Disconnected");
  }

  _cleanupWC() {
    if (this.wcProvider) {
      try {
        this.wcProvider.removeListener?.("display_uri", this._onWCUri);
      } catch (_) {}
      try {
        this.wcProvider.removeListener?.("connect", this._onWCConnected);
      } catch (_) {}
      try {
        this.wcProvider.removeListener?.("disconnect", this._onWCDisconnected);
      } catch (_) {}
      try {
        this.wcProvider.removeListener?.(
          "session_request_sent",
          this._wcSessionRequestSentHandler
        );
      } catch (_) {}
      try {
        this.wcProvider.disconnect();
      } catch (_) {}
      this.wcProvider = null;
    }

    this._wcSessionReady = false;
    this._onWCUri = null;
    this._onWCConnected = null;
    this._onWCDisconnected = null;
    this._wcSessionRequestSentHandler = null;
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
  getMobileWallets() {
    return MOBILE_WALLETS;
  }
}

export default WalletService;
