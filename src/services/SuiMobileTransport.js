

import SignClient from "@walletconnect/sign-client";


const WC_PROJECT_ID = "3a2347dfc8ba5a336fe715a34644f490";

const STORAGE_PREFIX = "kwespaysui";

const SUI_NAMESPACE = "sui";
const SUI_CHAINS = {
  "sui:mainnet": "sui:mainnet",
  "sui:testnet": "sui:testnet",
};

const REQUIRED_METHODS = [
  "sui_signAndExecuteTransactionBlock",
  "sui_signTransactionBlock",
];
const REQUIRED_EVENTS = ["chainChanged", "accountsChanged"];


function truncate(addr) {
  if (!addr) return "";
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}


let _instance = null;

class SuiMobileTransport {
  static get(projectId) {
    if (!_instance) _instance = new SuiMobileTransport(projectId);
    return _instance;
  }

  constructor(projectId) {
    this._projectId = projectId || WC_PROJECT_ID;
    this._client = null;
    this._session = null;
    this._address = null;
    this._chain = null;
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
    const chain = SUI_CHAINS[chainId] ?? "sui:mainnet";

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
        [SUI_NAMESPACE]: {
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

    const accounts = session.namespaces[SUI_NAMESPACE]?.accounts ?? [];
    if (!accounts.length) {
      const e = new Error("No Sui accounts returned from wallet session");
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
      connectionType: "sui-wc",
    };
  }


  async restore(chainId) {
    const chain = SUI_CHAINS[chainId] ?? "sui:mainnet";
    await this._initClient();

    const usable = (s) =>
      typeof s.expiry === "number" &&
      s.expiry * 1000 > Date.now() + 5_000 &&
      s.acknowledged !== false &&
      (s.namespaces?.[SUI_NAMESPACE]?.accounts ?? []).some((a) =>
        a.startsWith(`${chain}:`)
      );

    const deadline = Date.now() + 8_000;
    let match = null;
    for (;;) {
      const sessions =
        typeof this._client.session?.getAll === "function"
          ? this._client.session.getAll()
          : [];
      match =
        sessions.filter(usable).sort((a, b) => b.expiry - a.expiry)[0] ?? null;
      if (match || Date.now() >= deadline) break;
      await new Promise((r) => setTimeout(r, 400));
    }
    if (!match) return null;

    const accounts = match.namespaces[SUI_NAMESPACE]?.accounts ?? [];
    if (!accounts.length) return null;

    this._session = match;
    const parts = accounts[0].split(":");
    this._address = parts[parts.length - 1];
    this._chain = chain;

    return { address: this._address, chain: this._chain };
  }


  getSuiWalletAdapter() {
    if (!this._session || !this._address) {
      throw new Error(
        "SuiMobileTransport: call connect() before getSuiWalletAdapter()"
      );
    }

    const transport = this;

    return {
      accounts: [{ address: this._address }],

      connect: async () => {
        return { accounts: [{ address: transport._address }] };
      },

      signAndExecuteTransactionBlock: async ({ transactionBlock }) => {
        return transport._signAndExecute(transactionBlock);
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

  isConnected() {
    return !!this._address;
  }


  async _signAndExecute(transactionBlock) {
    if (!this._session) throw new Error("No active WalletConnect session");

    const txBytes = await transactionBlock.toJSON();

    const result = await this._client.request({
      topic: this._session.topic,
      chainId: this._chain,
      request: {
        method: "sui_signAndExecuteTransactionBlock",
        params: {
          transactionBlock: txBytes,
          account: this._address,
          chain: this._chain,
          options: { showEffects: true },
        },
      },
    });

    return {
      digest: result.digest,
      effects: result.effects,
    };
  }
}

export default SuiMobileTransport;
