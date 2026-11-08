

import UniversalProvider from "@walletconnect/universal-provider";

export { EVM_MOBILE_WALLETS } from "./walletService.js";

const EVM_NAMESPACE = "eip155";
const REQUIRED_METHODS = [
  "eth_sendTransaction",
  "personal_sign",
  "eth_signTypedData",
  "eth_signTypedData_v4",
];
const OPTIONAL_METHODS = [
  "wallet_switchEthereumChain",
  "wallet_addEthereumChain",
  "eth_signTransaction",
];
const REQUIRED_EVENTS = ["chainChanged", "accountsChanged"];

const STORAGE_PREFIX = "kwespayevm";

function truncate(addr) {
  if (!addr) return "";
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function normalizeChainIdHex(raw, pinnedChainId) {
  let n;
  if (typeof raw === "number") n = raw;
  else if (typeof raw === "string") {
    const s = raw.trim();
    n = s.startsWith("0x") || s.startsWith("0X") ? parseInt(s, 16) : parseInt(s, 10);
  }
  if (!Number.isFinite(n)) n = pinnedChainId;
  return "0x" + Number(n).toString(16);
}

function isSessionDeathError(err) {
  const m = (err?.message ?? "").toLowerCase();
  return (
    m.includes("no matching key") ||
    m.includes("session topic doesn't exist") ||
    m.includes("missing or invalid. request()") ||
    m.includes("expired")
  );
}

let _instance = null;

class EvmMobileTransport {
  static get(projectId) {
    if (!_instance) _instance = new EvmMobileTransport(projectId);
    return _instance;
  }

  constructor(projectId) {
    this._projectId = projectId;
    this._provider = null;
    this._wrapped = null;
    this._address = null;
    this._chainId = null;
  }

  isConnected() {
    return !!this._address && !!this._provider;
  }

  getAddress() {
    return this._address;
  }

  getProvider() {
    return this._wrapped ?? this._provider;
  }

  _makeNormalizedProvider(provider, chainId) {
    return {
      request: async (args) => {
        if (args?.method === "eth_chainId") {
          let raw;
          try {
            raw = await provider.request(args);
          } catch (err) {
            if (isSessionDeathError(err)) throw err;
            return "0x" + Number(chainId).toString(16);
          }
          return normalizeChainIdHex(raw, chainId);
        }
        return provider.request(args);
      },
      on: (event, listener) => provider.on(event, listener),
      removeListener: (event, listener) =>
        provider.removeListener?.(event, listener),
      isWalletConnect: true,
      get chainId() {
        return chainId;
      },
      _wcProvider: provider,
    };
  }

  async _initProvider() {
    if (this._provider) return this._provider;
    this._provider = await UniversalProvider.init({
      projectId: this._projectId,
      customStoragePrefix: STORAGE_PREFIX,
      metadata: {
        name: "KwesPay",
        description: "KwesPay crypto payment widget",
        url: window.location.origin,
        icons: [`${window.location.origin}/favicon.ico`],
        redirect: {
          native: "",
          universal: window.location.href,
        },
      },
    });
    return this._provider;
  }

  
  async connect({ chainId, rpcUrl, onUri }) {
    if (!this._projectId) {
      throw new Error(
        "WalletConnect projectId is missing. Set config.projectId to a valid " +
          "id from https://cloud.reown.com to enable mobile EVM wallets."
      );
    }

    const caipChain = `${EVM_NAMESPACE}:${chainId}`;
    const provider = await this._initProvider();

    if (provider.session) {
      try {
        await provider.disconnect();
      } catch (_) {}
    }

    const onDisplayUri = (uri) => onUri?.(uri);
    provider.on("display_uri", onDisplayUri);

    try {
      await provider.connect({
        namespaces: {
          [EVM_NAMESPACE]: {
            methods: REQUIRED_METHODS,
            chains: [caipChain],
            events: REQUIRED_EVENTS,
            rpcMap: { [chainId]: rpcUrl },
          },
        },
        optionalNamespaces: {
          [EVM_NAMESPACE]: {
            methods: OPTIONAL_METHODS,
            chains: [caipChain],
            events: REQUIRED_EVENTS,
          },
        },
      });
    } catch (err) {
      provider.removeListener?.("display_uri", onDisplayUri);
      const e = new Error(
        err?.message?.toLowerCase().includes("reject")
          ? "You rejected the connection request."
          : err?.message || "Wallet connection failed."
      );
      e.code = "USER_CANCELLED";
      throw e;
    }

    provider.removeListener?.("display_uri", onDisplayUri);

    provider.setDefaultChain?.(caipChain, rpcUrl);

    const accounts = provider.session?.namespaces?.[EVM_NAMESPACE]?.accounts ?? [];
    if (!accounts.length) {
      const e = new Error("No EVM accounts returned from wallet session.");
      e.code = "USER_CANCELLED";
      throw e;
    }

    const parts = accounts[0].split(":");
    this._address = parts[parts.length - 1];
    this._chainId = chainId;
    this._wrapped = this._makeNormalizedProvider(this._provider, chainId);

    return {
      address: this._address,
      shortAddress: truncate(this._address),
      chainId: this._chainId,
      connectionType: "evm-wc",
    };
  }


  async restore(chainId, rpcUrl) {
    if (!this._projectId) return null;

    const provider = await this._initProvider();
    const prefix = `${EVM_NAMESPACE}:${chainId}:`;

    const usable = (s) =>
      !!s &&
      typeof s.expiry === "number" &&
      s.expiry * 1000 > Date.now() + 5_000 &&
      s.acknowledged !== false &&
      (s.namespaces?.[EVM_NAMESPACE]?.accounts ?? []).some((a) =>
        a.startsWith(prefix)
      );

    const deadline = Date.now() + 8_000;
    let session = null;
    for (;;) {
      const all = provider.client?.session?.getAll?.() ?? [];
      session =
        all.filter(usable).sort((a, b) => b.expiry - a.expiry)[0] ?? null;
      if (session || Date.now() >= deadline) break;
      await new Promise((r) => setTimeout(r, 400));
    }

    if (!session) {
      if (provider.session && !usable(provider.session)) {
        try {
          await provider.disconnect();
        } catch (_) {}
      }
      return null;
    }

    if (provider.session?.topic !== session.topic) {
      provider.session = session;
    }
    try {
      provider.createProviders();
    } catch (err) {
      return null;
    }

    const match = session.namespaces[EVM_NAMESPACE].accounts.find((a) =>
      a.startsWith(prefix)
    );
    this._address = match.slice(prefix.length);
    this._chainId = chainId;
    provider.setDefaultChain?.(`${EVM_NAMESPACE}:${chainId}`, rpcUrl);
    this._wrapped = this._makeNormalizedProvider(this._provider, chainId);

    return { address: this._address };
  }

  async disconnect() {
    if (this._provider) {
      try {
        await this._provider.disconnect();
      } catch (_) {}
    }
    this._address = null;
    this._chainId = null;
    this._wrapped = null;
  }
}

export default EvmMobileTransport;
