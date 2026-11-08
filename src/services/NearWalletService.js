import { ensureBuffer } from "../utils/nodeGlobals.js";

const SELECTOR_VERSION = "10.1.4";
const SELECTOR_CDN = "https://cdn.jsdelivr.net/npm";
const selectors = new Map();
let coreModule = null;

function loadFromCdn(pkg) {
  const url = `${SELECTOR_CDN}/@near-wallet-selector/${pkg}@${SELECTOR_VERSION}/+esm`;
  return import(/* webpackIgnore: true */ /* @vite-ignore */ url);
}

async function loadCore() {
  if (!coreModule) coreModule = await loadFromCdn("core");
  return coreModule;
}

async function loadSelector(networkId) {
  if (!selectors.has(networkId)) {
    const pending = (async () => {
      await ensureBuffer();
      const [{ setupWalletSelector }, meteor, intear, sender] = await Promise.all([
        loadCore(),
        loadFromCdn("meteor-wallet"),
        loadFromCdn("intear-wallet"),
        loadFromCdn("sender"),
      ]);
      return setupWalletSelector({
        network: networkId,
        modules: [meteor.setupMeteorWallet(), intear.setupIntearWallet(), sender.setupSender()],
      });
    })().catch((err) => {
      selectors.delete(networkId);
      const e = new Error(
        "NEAR wallets could not be loaded. Check your connection and try again."
      );
      e.code = "CONTRACT_ERROR";
      e.cause = err;
      throw e;
    });
    selectors.set(networkId, pending);
  }
  return selectors.get(networkId);
}

export function isNearUserRejection(err) {
  const msg = (err?.message ?? String(err ?? "")).toLowerCase();
  return /reject|declin|cancel|denied|closed|user abort/.test(msg);
}

export function wrapNearWallet(wallet, accountId, toNajAction) {
  return {
    getAccounts: async () => [{ accountId }],
    signAndSendTransaction: async ({ receiverId, actions }) => {
      try {
        return await wallet.signAndSendTransaction({
          signerId: accountId,
          receiverId,
          actions: toNajAction ? actions.map(toNajAction) : actions,
        });
      } catch (err) {
        if (isNearUserRejection(err)) {
          const e = new Error("Transaction cancelled by user.");
          e.code = "WALLET_REJECTED";
          throw e;
        }
        throw err;
      }
    },
  };
}

class NearWalletService {
  constructor({ external } = {}) {
    this._selector = null;
    this._wallet = null;
    this._external = external ?? null;
    this.connectedWalletId = null;
    this.connectedAddress = null;
    this._contractId = null;
  }

  hasExternalWallet() {
    return !!this._external;
  }

  async connectExternal() {
    const accounts = await this._external.getAccounts();
    const accountId = accounts?.[0]?.accountId;
    if (!accountId) {
      const e = new Error("The NEAR wallet passed to the widget has no signed-in account.");
      e.code = "USER_CANCELLED";
      throw e;
    }
    this.connectedWalletId = "external";
    this.connectedAddress = accountId;
    return this._connectionResult();
  }

  async discoverWallets({ networkId, contractId }) {
    this._contractId = contractId ?? null;
    this._selector = await loadSelector(networkId);
    return this._selector.store.getState().modules.map((mod) => ({
      id: mod.id,
      name: mod.metadata?.name ?? mod.id,
      icon: mod.metadata?.iconUrl ?? null,
      type: mod.type,
      isAvailable: mod.metadata?.available !== false && !mod.metadata?.deprecated,
    }));
  }

  async connect(walletId) {
    if (!this._selector) {
      throw new Error("NEAR wallets not loaded — call discoverWallets() first.");
    }
    let accounts;
    try {
      const wallet = await this._selector.wallet(walletId);
      const signedIn = await wallet.getAccounts().catch(() => []);
      accounts = signedIn?.length
        ? signedIn
        : await wallet.signIn({ contractId: this._contractId ?? undefined, methodNames: [] });
      this._wallet = wallet;
    } catch (err) {
      if (isNearUserRejection(err)) {
        const e = new Error("User rejected the connection");
        e.code = "USER_CANCELLED";
        throw e;
      }
      throw err;
    }
    const accountId = accounts?.[0]?.accountId;
    if (!accountId) {
      const e = new Error("No account returned from the NEAR wallet");
      e.code = "USER_CANCELLED";
      throw e;
    }
    this.connectedWalletId = walletId;
    this.connectedAddress = accountId;
    return this._connectionResult();
  }

  async disconnect() {
    if (this._wallet) {
      try {
        await this._wallet.signOut();
      } catch (_) {
      }
    }
    this._wallet = null;
    this.connectedWalletId = null;
    this.connectedAddress = null;
  }

  isConnected() {
    return !!this.connectedAddress;
  }

  getAddress() {
    return this.connectedAddress;
  }

  async getNearWalletAdapter() {
    if (!this.connectedAddress) {
      throw new Error("No NEAR wallet connected. Call connect() first.");
    }
    if (this.connectedWalletId === "external") {
      return wrapNearWallet(this._external, this.connectedAddress, null);
    }
    const { internalActionToNaj } = await loadCore();
    return wrapNearWallet(this._wallet, this.connectedAddress, internalActionToNaj);
  }

  _connectionResult() {
    const a = this.connectedAddress;
    return {
      address: a,
      shortAddress: a.length > 24 ? `${a.slice(0, 10)}…${a.slice(-8)}` : a,
      walletId: this.connectedWalletId,
      connectionType: this.connectedWalletId === "external" ? "external" : "near-wallet-selector",
    };
  }
}

export default NearWalletService;
