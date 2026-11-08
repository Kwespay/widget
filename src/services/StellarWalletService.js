

import { ensureBuffer } from "../utils/nodeGlobals.js";

const KIT_PACKAGE = "@creit.tech/stellar-wallets-kit";


const PUBLIC_PASSPHRASE = "Public Global Stellar Network ; September 2015";
const TESTNET_PASSPHRASE = "Test SDF Network ; September 2015";

let _modulesPromise = null;

async function loadModules() {
  if (!_modulesPromise) {
    _modulesPromise = (async () => {
      await ensureBuffer();
      const { defaultModules } = await import(
        "@creit.tech/stellar-wallets-kit/modules/utils"
      );
      return defaultModules();
    })().catch((err) => {
      _modulesPromise = null;
      const e = new Error(
        `Stellar payments require the optional '${KIT_PACKAGE}' package, ` +
          `which is not installed. Run \`npm install ${KIT_PACKAGE}\` ` +
          "(or yarn/pnpm equivalent) to enable Stellar wallet connections."
      );
      e.code = "CONTRACT_ERROR";
      e.cause = err;
      throw e;
    });
  }
  return _modulesPromise;
}

function resolveWalletNetwork(networkPassphrase) {
  if (networkPassphrase && networkPassphrase.includes("Test")) {
    return TESTNET_PASSPHRASE;
  }
  return PUBLIC_PASSPHRASE;
}

function withTimeout(promise, ms, fallback) {
  const timer = new Promise((r) => setTimeout(() => r(fallback), ms));
  return Promise.race([timer, promise]).catch(() => fallback);
}

class StellarWalletService {
  constructor({ projectId, appName } = {}) {
    this._modules = null;
    this._module = null;
    this.connectedWalletId = null;
    this.connectedAddress = null;
    this._networkPassphrase = null;
    this._projectId = projectId ?? null;
    this._appName = appName ?? "KwesPay";
  }

  isMobile() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      navigator.userAgent
    );
  }

  isIOS() {
    return /iPhone|iPad|iPod/i.test(navigator.userAgent);
  }


  async _ensureModules(networkPassphrase) {
    this._modules = await loadModules();
    this._networkPassphrase = resolveWalletNetwork(networkPassphrase);
    return this._modules;
  }


  async discoverWallets(networkPassphrase) {
    const modules = await this._ensureModules(networkPassphrase);
    return Promise.all(
      modules.map(async (mod) => ({
        id: mod.productId,
        name: mod.productName,
        type: mod.moduleType,
        icon: mod.productIcon,
        isAvailable: await withTimeout(mod.isAvailable(), 1000, false),
        isPlatformWrapper: mod.isPlatformWrapper
          ? await withTimeout(mod.isPlatformWrapper(), 1000, false)
          : false,
        url: mod.productUrl,
      }))
    );
  }


  async connect(walletId) {
    const mod = this._modules?.find((m) => m.productId === walletId);
    if (!mod) {
      throw new Error(
        this._modules
          ? `Wallet id "${walletId}" is not an available Stellar wallet`
          : "Stellar wallets not loaded — call discoverWallets() first."
      );
    }

    let address;
    try {
      const result = await mod.getAddress();
      address = typeof result === "string" ? result : result.address;
    } catch (err) {
      if (isStellarUserRejection(err)) {
        const e = new Error("User rejected the connection");
        e.code = "USER_CANCELLED";
        throw e;
      }
      throw err;
    }

    if (!address) {
      const e = new Error("No address returned from Stellar wallet");
      e.code = "USER_CANCELLED";
      throw e;
    }

    this._module = mod;
    this.connectedWalletId = walletId;
    this.connectedAddress = address;

    return this._connectionResult();
  }

  async disconnect() {
    try {
      await this._module?.disconnect?.();
    } catch (_) {
    }
    this._module = null;
    this.connectedWalletId = null;
    this.connectedAddress = null;
  }

  isConnected() {
    return !!this.connectedAddress;
  }

  getAddress() {
    return this.connectedAddress;
  }

  getStellarWalletAdapter() {
    if (!this._module || !this.connectedAddress) {
      throw new Error(
        "No Stellar wallet connected. Call connect() before getStellarWalletAdapter()."
      );
    }

    const mod = this._module;
    const address = this.connectedAddress;
    const fallbackPassphrase = this._networkPassphrase;

    return {
      getAddress: async () => ({ address }),

      signTransaction: async (xdr, opts) => {
        try {
          const result = await mod.signTransaction(xdr, {
            address,
            networkPassphrase: opts?.networkPassphrase || fallbackPassphrase,
          });
          return result;
        } catch (err) {
          if (isStellarUserRejection(err)) {
            const e = new Error("Transaction cancelled by user.");
            e.code = "WALLET_REJECTED";
            throw e;
          }
          throw err;
        }
      },
    };
  }


  _connectionResult() {
    return {
      address: this.connectedAddress,
      shortAddress: this._truncate(this.connectedAddress),
      walletId: this.connectedWalletId,
      connectionType: "stellar-wallets-kit",
    };
  }

  _truncate(addr) {
    if (!addr) return "";
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  }
}

function isStellarUserRejection(err) {
  const msg = (err?.message ?? String(err ?? "")).toLowerCase();
  return (
    msg.includes("rejected") ||
    msg.includes("declined") ||
    msg.includes("user declined") ||
    msg.includes("cancelled") ||
    msg.includes("canceled")
  );
}

export default StellarWalletService;
