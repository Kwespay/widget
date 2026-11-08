import PaymentService from "./paymentService.js";

const PENDING_KEY = "kpl_pending";

const OPTION_FIELDS = `network networkName ecosystem networkLogoUrl token tokenName tokenLogoUrl`;

const PUBLIC_LINK_QUERY = `
  query PublicPaymentLink($slug: String!) {
    publicPaymentLink(slug: $slug) {
      slug url title description purpose pricingMode currency currencyDecimals
      amount minAmount maxAmount suggestedAmounts targetAmount collectedAmount reference
      customerFields { name email reference referenceLabel }
      eventStartsAt eventLocation imageUrl
      merchant { displayName logoUrl primaryColor supportMessage }
      state expiresAt
      options { ${OPTION_FIELDS} }
    }
  }
`;

const NETWORKS_QUERY = `
  query PaymentNetworks {
    paymentNetworks {
      key name environment ecosystem chainId contractAddress registryObjectId platformFeeBps
      explorerTxUrl publicRpcUrl nativeSymbol networkPassphrase logoUrl
      tokens { symbol displaySymbol name logoUrl address decimals isNative }
    }
  }
`;

const PREVIEW_QUOTE_MUTATION = `
  mutation PreviewPaymentLinkQuote($input: PreviewPaymentLinkQuoteInput!) {
    previewPaymentLinkQuote(input: $input) {
      success message quoteId quoteReference cryptoCurrency tokenAddress amountBaseUnits
      totalBaseUnits displayAmount network chainId expiresAt usdPriceSnapshot
    }
  }
`;

const START_CHECKOUT_MUTATION = `
  mutation StartPaymentLinkCheckout($input: StartPaymentLinkCheckoutInput!) {
    startPaymentLinkCheckout(input: $input) {
      success message code checkoutToken resumed
      payment {
        paymentIdBytes32 backendSignature tokenAddress amountBaseUnits totalBaseUnits chainId deadline
        expiresAt vendorIdentifier vendorWallet contractAddress registryObjectId
        transaction { transactionReference transactionStatus blockchainNetwork }
      }
    }
  }
`;

const CHECKOUT_STATUS_QUERY = `
  query PaymentLinkCheckoutStatus($slug: String!, $transactionReference: String!, $checkoutToken: String!) {
    paymentLinkCheckoutStatus(slug: $slug, transactionReference: $transactionReference, checkoutToken: $checkoutToken) {
      transactionReference status paid fiatAmount fiatCurrency redirectUrl reference title merchantName
    }
  }
`;

export class PaymentLinkError extends Error {
  constructor(message, code) {
    super(message);
    this.name = "PaymentLinkError";
    this.code = code ?? null;
  }
}

function newKey() {
  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export default class LinkPaymentService extends PaymentService {
  constructor(slug, graphqlEndpoint, { idempotencyKey, previewLink } = {}) {
    super(PENDING_KEY, undefined, undefined, graphqlEndpoint, undefined);
    this.slug = slug;
    this.link = null;
    this.previewLink = previewLink ?? null;
    this.amount = null;
    this.customer = { name: "", email: "", reference: "" };
    this.idempotencyKey = idempotencyKey || newKey();
    this.checkoutToken = null;
    this.transactionReference = null;
    this._fingerprint = null;
  }

  async _gql(query, variables, apiKey) {
    const headers = { "Content-Type": "application/json" };
    if (apiKey) headers["X-API-Key"] = apiKey;
    let response;
    try {
      response = await fetch(this._graphqlEndpoint, {
        method: "POST",
        headers,
        body: JSON.stringify({ query, variables }),
      });
    } catch {
      throw new PaymentLinkError("We couldn't reach KwesPay. Check your connection and try again.", "NETWORK");
    }
    let body;
    try {
      body = await response.json();
    } catch {
      throw new PaymentLinkError("KwesPay returned an unexpected response. Please try again.", "NETWORK");
    }
    if (body.errors?.length) {
      throw new PaymentLinkError(body.errors[0].message || "Something went wrong.", "GRAPHQL");
    }
    return body.data;
  }

  async loadLink() {
    if (this.previewLink) {
      this.link = this.previewLink;
      return this.link;
    }
    const data = await this._gql(PUBLIC_LINK_QUERY, { slug: this.slug });
    this.link = data.publicPaymentLink;
    return this.link;
  }

  setCheckoutDetails({ amount, customer }) {
    this.amount = amount;
    this.customer = { name: "", email: "", reference: "", ...(customer || {}) };
  }

  async validateAPIKey() {
    const link = this.link ?? (await this.loadLink());
    const networks = [...new Set(link.options.map((o) => o.network))];
    const tokens = [...new Set(link.options.map((o) => o.token.toUpperCase()))];
    return {
      valid: true,
      vendorInfo: { vendorIdentifier: null, businessName: link.merchant.displayName },
      allowedNetworks: networks,
      allowedTokens: tokens,
      scope: { allowedVendors: null, isAuthorizedForVendor: null },
    };
  }

  async getNetworks() {
    const data = await this._gql(NETWORKS_QUERY, {});
    return data.paymentNetworks;
  }

  async getMerchantConfig() {
    const link = this.link ?? (await this.loadLink());
    const byNetwork = new Map();
    for (const o of link.options) {
      const entry = byNetwork.get(o.network) ?? { network: o.network, tokens: [], family: o.ecosystem };
      entry.tokens.push(o.token.toUpperCase());
      byNetwork.set(o.network, entry);
    }
    const families = new Set(link.options.map((o) => o.ecosystem));
    return {
      vendorIdentifier: null,
      businessName: link.merchant.displayName,
      enabledNetworks: [...byNetwork.keys()],
      networkTokenMap: [...byNetwork.values()],
      hasEvmWallet: families.has("evm"),
      hasSuiWallet: families.has("sui"),
      hasStellarWallet: families.has("stellar"),
      hasNearWallet: families.has("near"),
    };
  }

  async getQuote({ cryptoCurrency, network }) {
    if (this.previewLink) throw new PaymentLinkError("Quotes aren't available in preview.", "PREVIEW");
    const data = await this._gql(PREVIEW_QUOTE_MUTATION, {
      input: {
        slug: this.slug,
        network,
        token: cryptoCurrency,
        amount: this.link?.pricingMode === "flexible" ? String(this.amount ?? "") : null,
      },
    });
    const q = data.previewPaymentLinkQuote;
    if (!q.success) throw new PaymentLinkError(q.message || "We couldn't price this payment.", "QUOTE");
    return {
      quoteId: q.quoteId,
      quoteReference: q.quoteReference,
      cryptoCurrency: q.cryptoCurrency,
      tokenAddress: q.tokenAddress,
      amountBaseUnits: q.amountBaseUnits,
      totalBaseUnits: q.totalBaseUnits,
      displayAmount: q.displayAmount,
      network: q.network,
      chainId: q.chainId ?? 0,
      expiresAt: q.expiresAt,
      usdPriceSnapshot: q.usdPriceSnapshot,
    };
  }

  async createTransaction({ quote, payerWalletAddress }) {
    if (this.previewLink) throw new PaymentLinkError("Payments are off in preview.", "PREVIEW");
    const fingerprint = [quote.network, quote.cryptoCurrency, this.amount ?? "", payerWalletAddress].join("|");
    if (this._fingerprint && this._fingerprint !== fingerprint) this.startNewAttempt();
    this._fingerprint = fingerprint;
    const data = await this._gql(START_CHECKOUT_MUTATION, {
      input: {
        slug: this.slug,
        network: quote.network,
        token: quote.cryptoCurrency,
        payerWalletAddress,
        idempotencyKey: this.idempotencyKey,
        amount: this.link?.pricingMode === "flexible" ? String(this.amount ?? "") : null,
        customerName: this.customer.name || null,
        customerEmail: this.customer.email || null,
        customerReference: this.customer.reference || null,
        quoteId: quote.quoteId ?? null,
      },
    });
    const r = data.startPaymentLinkCheckout;
    if (!r.success) {
      if (r.code === "ATTEMPT_ENDED") this.idempotencyKey = newKey();
      throw new PaymentLinkError(r.message || "We couldn't start the payment.", r.code);
    }
    const p = r.payment;
    this.checkoutToken = r.checkoutToken;
    this.transactionReference = p.transaction.transactionReference;
    this._apiKey = r.checkoutToken;
    this._client = null;
    return {
      paymentIdBytes32: p.paymentIdBytes32,
      backendSignature: p.backendSignature,
      tokenAddress: p.tokenAddress,
      amountBaseUnits: p.amountBaseUnits,
      totalBaseUnits: p.totalBaseUnits,
      chainId: p.chainId ?? undefined,
      expiresAt: p.expiresAt,
      deadline: p.deadline,
      transactionReference: p.transaction.transactionReference,
      transactionStatus: p.transaction.transactionStatus,
      network: p.transaction.blockchainNetwork,
      vendorIdentifier: p.vendorIdentifier,
      vendorSuiWallet: null,
      vendorWallet: p.vendorWallet ?? null,
      payerWalletAddress,
      contractAddress: p.contractAddress ?? undefined,
      registryObjectId: p.registryObjectId ?? undefined,
    };
  }

  async checkoutStatus() {
    if (!this.checkoutToken || !this.transactionReference) return null;
    const data = await this._gql(CHECKOUT_STATUS_QUERY, {
      slug: this.slug,
      transactionReference: this.transactionReference,
      checkoutToken: this.checkoutToken,
    });
    return data.paymentLinkCheckoutStatus;
  }

  startNewAttempt() {
    this._fingerprint = null;
    this.idempotencyKey = newKey();
    this.checkoutToken = null;
    this.transactionReference = null;
    this._apiKey = PENDING_KEY;
    this._client = null;
  }
}
