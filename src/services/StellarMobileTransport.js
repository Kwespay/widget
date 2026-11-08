import SignClient from "@walletconnect/sign-client";

const STORAGE_PREFIX = "kwespaystellar";

const STELLAR_NAMESPACE = "stellar";
const STELLAR_WC_CHAINS = {
  "stellar:mainnet": "stellar:pubnet",
  "stellar:testnet": "stellar:testnet",
};
const REQUIRED_METHODS = ["stellar_signXDR"];
const REQUIRED_EVENTS = [];

function truncate(addr) {
  if (!addr) return "";
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

let _instance = null;

class StellarMobileTransport {
  static get(projectId) {
    if (!_instance) _instance = new StellarMobileTransport(projectId);
    return _instance;
  }

  constructor(projectId) {
    this._projectId = projectId;
    this._client = null;
    this._session = null;
    this._address = null;
    this._chain = null;
  }

  isConnected() {
    return !!this._address && !!this._session;
  }

  getAddress() {
    return this._address;
  }

  async _initClient() {
    if (this._client) return this._client;
    this._client = await SignClient.init({
      projectId: this._projectId,
      customStoragePrefix: STORAGE_PREFIX,
      metadata: {
        name: "KwesPay",
        description: "KwesPay crypto payment widget",
        url: window.location.origin,
        icons: [`${window.location.origin}/favicon.ico`],
        redirect: { native: "", universal: window.location.href },
      },
    });
    return this._client;
  }

  async connect({ chainId, onUri }) {
    if (!this._projectId) {
      throw new Error(
        "WalletConnect projectId is missing. Set config.projectId to a valid " +
          "id from https://cloud.reown.com to enable mobile Stellar wallets."
      );
    }

    const chain = STELLAR_WC_CHAINS[chainId] ?? "stellar:pubnet";

    await this._initClient();

    try {
      for (const s of this._client.session.getAll()) {
        this._client
          .disconnect({
            topic: s.topic,
            reason: { code: 6000, message: "Stale session cleanup" },
          })
          .catch(() => {});
      }
    } catch (_) {}

    const { uri, approval } = await this._client.connect({
      requiredNamespaces: {
        [STELLAR_NAMESPACE]: {
          methods: REQUIRED_METHODS,
          chains: [chain],
          events: REQUIRED_EVENTS,
        },
      },
    });

    if (!uri) throw new Error("WalletConnect did not return a pairing URI");
    onUri?.(uri);

    let session;
    try {
      session = await approval();
    } catch (err) {
      const e = new Error(
        err?.message?.toLowerCase().includes("reject")
          ? "You rejected the connection request."
          : err?.message || "Wallet connection failed."
      );
      e.code = "USER_CANCELLED";
      throw e;
    }

    this._session = session;

    const accounts = session.namespaces[STELLAR_NAMESPACE]?.accounts ?? [];
    if (!accounts.length) {
      const e = new Error("No Stellar accounts returned from wallet session.");
      e.code = "USER_CANCELLED";
      throw e;
    }

    const parts = accounts[0].split(":");
    this._address = parts[parts.length - 1];
    this._chain = chain;

    return {
      address: this._address,
      shortAddress: truncate(this._address),
      chain: this._chain,
      connectionType: "stellar-wc",
    };
  }

  async restore(chainId) {
    if (!this._projectId) return null;
    const chain = STELLAR_WC_CHAINS[chainId] ?? "stellar:pubnet";
    await this._initClient();

    const usable = (s) =>
      !!s &&
      typeof s.expiry === "number" &&
      s.expiry * 1000 > Date.now() + 5_000 &&
      s.acknowledged !== false &&
      (s.namespaces?.[STELLAR_NAMESPACE]?.accounts ?? []).some((a) =>
        a.startsWith(`${chain}:`)
      );

    const deadline = Date.now() + 8_000;
    let session = null;
    for (;;) {
      const all =
        typeof this._client.session?.getAll === "function"
          ? this._client.session.getAll()
          : [];
      session = all.filter(usable).sort((a, b) => b.expiry - a.expiry)[0] ?? null;
      if (session || Date.now() >= deadline) break;
      await new Promise((r) => setTimeout(r, 400));
    }
    if (!session) return null;

    const accounts = session.namespaces[STELLAR_NAMESPACE]?.accounts ?? [];
    if (!accounts.length) return null;

    this._session = session;
    const parts = accounts[0].split(":");
    this._address = parts[parts.length - 1];
    this._chain = chain;

    return {
      address: this._address,
      shortAddress: truncate(this._address),
      chain: this._chain,
      connectionType: "stellar-wc",
    };
  }

  getStellarWalletAdapter() {
    if (!this._session || !this._address) {
      throw new Error(
        "StellarMobileTransport: call connect() before getStellarWalletAdapter()"
      );
    }

    const transport = this;
    const address = this._address;

    return {
      getAddress: async () => ({ address }),

      signTransaction: async (xdr) => {
        const result = await transport._client.request({
          topic: transport._session.topic,
          chainId: transport._chain,
          request: {
            method: "stellar_signXDR",
            params: { xdr },
          },
        });
        const signedTxXdr = result?.signedXDR ?? result?.signedTxXdr ?? result;
        return { signedTxXdr };
      },
    };
  }

  async disconnect() {
    if (this._client && this._session) {
      try {
        await this._client.disconnect({
          topic: this._session.topic,
          reason: { code: 6000, message: "User disconnected" },
        });
      } catch (_) {}
    }
    this._session = null;
    this._address = null;
    this._chain = null;
  }
}

export default StellarMobileTransport;
