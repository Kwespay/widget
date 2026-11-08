import { getWallets } from "@mysten/wallet-standard";
import { ensureBuffer } from "../utils/nodeGlobals.js";

const SUI_CHAIN_PREFIX = "sui:";

let _slushRegistered = false;

const SUI_KNOWN_EXTENSION_WALLETS = [
  {
    name: "Slush",
    icon: "https://arthuremma2.github.io/img-hosting/slush.svg",
    installUrl:
      "https://chromewebstore.google.com/detail/slush-sui-wallet/opcgpfmipidbgpenhmajoajpbobppdil",
  },
  {
    name: "Nightly",
    icon: "https://nightly.app/favicon.ico",
    installUrl:
      "https://chromewebstore.google.com/detail/nightly/fiikommddbeccaoicoejoniammnalkfa",
  },
  {
    name: "Phantom",
    icon: "https://arthuremma2.github.io/img-hosting/phantom1.png",
    installUrl:
      "https://chromewebstore.google.com/detail/phantom/bfnaelmomeimhlpmgjnjophhpkkoljpa",
  },
  {
    name: "Backpack",
    icon: "https://backpack.app/favicon.ico",
    installUrl:
      "https://chromewebstore.google.com/detail/backpack/aflkmfhebedbjioipglgcbcmnbpgliof",
  },
];

const SUI_MOBILE_WALLETS = [
  {
    name: "Slush",
    icon: "https://arthuremma2.github.io/img-hosting/slush.svg",
    deepLink: (uri) => `slush://wc?uri=${encodeURIComponent(uri)}`,
    universalLink: (uri) =>
      `https://my.slush.app/wc?uri=${encodeURIComponent(uri)}`,
  },
  {
    name: "Nightly",
    icon: "https://nightly.app/favicon.ico",
    deepLink: (uri) => `nightly://wc?uri=${encodeURIComponent(uri)}`,
    universalLink: (uri) =>
      `https://nightly.app/wc?uri=${encodeURIComponent(uri)}`,
    universalBase: "https://nightly.app",
  },
  {
    name: "Phantom",
    icon: "https://arthuremma2.github.io/img-hosting/phantom1.png",
    deepLink: (uri) => `phantom://wc?uri=${encodeURIComponent(uri)}`,
    universalLink: (uri) =>
      `https://phantom.app/ul/wc?uri=${encodeURIComponent(uri)}`,
    universalBase: "https://phantom.app/ul",
  },
  {
    name: "Backpack",
    icon: "https://backpack.app/favicon.ico",
    deepLink: (uri) => `backpack://wc?uri=${encodeURIComponent(uri)}`,
    universalLink: (uri) =>
      `https://backpack.app/wc?uri=${encodeURIComponent(uri)}`,
    universalBase: "https://backpack.app",
  },
];

function isSuiWallet(wallet) {
  const chains = wallet.chains ?? [];
  return (
    chains.some(
      (c) => typeof c === "string" && c.startsWith(SUI_CHAIN_PREFIX)
    ) || Object.keys(wallet.features ?? {}).some((f) => f.startsWith("sui:"))
  );
}

function _normaliseConnectResult(raw, fallbackAccounts = []) {
  let accounts;
  if (Array.isArray(raw)) {
    accounts = raw;
  } else if (raw && typeof raw === "object" && Array.isArray(raw.accounts)) {
    accounts = raw.accounts;
  } else {
    accounts = fallbackAccounts;
  }
  return {
    accounts: accounts.map((a) => ({ address: a.address ?? a })),
  };
}

class SuiWalletService {
  constructor() {
    this.connectedAddress = null;
    this.connectedWallet = null;
    this.connectedChain = null;
    this._changeHandler = null;
  }


  isMobile() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      navigator.userAgent
    );
  }

  isIOS() {
    return /iPhone|iPad|iPod/i.test(navigator.userAgent);
  }

  async ensureSlushWebWallet(appName) {
    if (_slushRegistered) return;
    try {
      await ensureBuffer();
      const { registerSlushWallet } = await import("@mysten/slush-wallet");
      registerSlushWallet(appName || "KwesPay");
      _slushRegistered = true;
    } catch {}
  }

  discoverWallets() {
    return new Promise((resolve) => {
      const discovered = [];
      const seen = new Set();

      const add = (w) => {
        if (!w || !isSuiWallet(w)) return;
        if (seen.has(w.name)) return;
        seen.add(w.name);
        discovered.push(w);
      };

      try {
        getWallets().get().forEach(add);
      } catch {}

      const registry = {
        wallets: [],
        register: (...wallets) => {
          for (const w of wallets) {
            registry.wallets.push(w);
            add(w);
          }
        },
      };
      window.dispatchEvent(
        new CustomEvent("wallet-standard:app-ready", { detail: registry })
      );

      setTimeout(() => resolve(discovered), 300);
    });
  }

  async connect(wallet, targetChainId, { silent = false } = {}) {
    const raw = await wallet.features["standard:connect"].connect(
      silent ? { silent: true } : undefined
    );
    const { accounts } = _normaliseConnectResult(raw, wallet.accounts ?? []);

    if (!accounts.length) {
      const e = new Error(
        silent
          ? "No previously authorized Sui accounts for silent connect"
          : "No accounts returned from Sui wallet"
      );
      e.code = silent ? "SILENT_CONNECT_FAILED" : "USER_CANCELLED";
      throw e;
    }

    const account = targetChainId
      ? accounts.find((a) => a.chains?.includes(targetChainId)) ?? accounts[0]
      : accounts[0];

    this.connectedAddress = account.address;
    this.connectedWallet = wallet;
    this.connectedChain = targetChainId ?? account.chains?.[0] ?? "sui:mainnet";

    if (wallet.features["standard:events"]) {
      this._changeHandler = ({ accounts: newAccounts }) => {
        if (newAccounts?.length) {
          this.connectedAddress = newAccounts[0].address;
        }
      };
      wallet.features["standard:events"].on("change", this._changeHandler);
    }

    return this._connectionResult();
  }

  async disconnect() {
    if (this.connectedWallet?.features["standard:disconnect"]) {
      try {
        await this.connectedWallet.features["standard:disconnect"].disconnect();
      } catch (_) {}
    }
    this.connectedAddress = null;
    this.connectedWallet = null;
    this.connectedChain = null;
    this._changeHandler = null;
  }

  async signAndExecuteTransaction(txBytes) {
    if (!this.connectedWallet) throw new Error("No Sui wallet connected");
    const features = this.connectedWallet.features;

    if (features["sui:signAndExecuteTransaction"]) {
      return features[
        "sui:signAndExecuteTransaction"
      ].signAndExecuteTransaction({
        transaction: txBytes,
        chain: this.connectedChain,
      });
    }
    if (features["sui:signAndExecuteTransactionBlock"]) {
      return features[
        "sui:signAndExecuteTransactionBlock"
      ].signAndExecuteTransactionBlock({
        transactionBlock: txBytes,
        options: { showEffects: true },
      });
    }
    throw new Error(
      "Connected Sui wallet does not support transaction execution"
    );
  }

  getSuiWalletAdapter() {
    if (!this.connectedWallet || !this.connectedAddress) {
      throw new Error(
        "No Sui wallet connected. Call connect() before getSuiWalletAdapter()."
      );
    }

    const wallet = this.connectedWallet;
    const address = this.connectedAddress;
    const chain = this.connectedChain;

    const walletAccount = (wallet.accounts ?? []).find(
      (a) => a.address === address
    ) ??
      wallet.accounts?.[0] ?? { address };

    return {
      accounts: [{ address }],

      connect: async () => {
        const raw = await wallet.features["standard:connect"].connect();
        return _normaliseConnectResult(raw, wallet.accounts ?? []);
      },

      signAndExecuteTransactionBlock: async ({ transactionBlock, options }) => {
        const features = wallet.features;

        if (features["sui:signAndExecuteTransaction"]) {
          const result = await features[
            "sui:signAndExecuteTransaction"
          ].signAndExecuteTransaction({
            transaction: transactionBlock,
            account: walletAccount,
            chain,
          });
          return {
            digest: result.digest,
            effects: result.effects,
          };
        }

        if (features["sui:signAndExecuteTransactionBlock"]) {
          const { Transaction: TxClass } = await import(
            "@mysten/sui/transactions"
          );
          const reconstructed = TxClass.from(await transactionBlock.toJSON());
          const result = await features[
            "sui:signAndExecuteTransactionBlock"
          ].signAndExecuteTransactionBlock({
            transactionBlock: reconstructed,
            account: walletAccount,
            chain,
            options: { showEffects: true, ...(options ?? {}) },
          });
          return {
            digest: result.digest,
            effects: result.effects,
          };
        }

        throw new Error(
          `Connected wallet "${wallet.name}" does not support transaction execution. ` +
            "Please use a wallet that supports sui:signAndExecuteTransaction or sui:signAndExecuteTransactionBlock."
        );
      },
    };
  }

  isConnected() {
    return !!this.connectedAddress;
  }
  getAddress() {
    return this.connectedAddress;
  }

  getWallet() {
    return this.connectedWallet;
  }
  getChain() {
    return this.connectedChain;
  }

  getKnownExtensionWallets() {
    return SUI_KNOWN_EXTENSION_WALLETS;
  }
  getMobileWallets() {
    return SUI_MOBILE_WALLETS;
  }

  _connectionResult() {
    return {
      address: this.connectedAddress,
      shortAddress: this._truncate(this.connectedAddress),
      wallet: this.connectedWallet,
      chain: this.connectedChain,
      connectionType: "sui-injected",
    };
  }

  _truncate(addr) {
    if (!addr) return "";
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  }
}

export default SuiWalletService;
