import { ensureBuffer } from "../utils/nodeGlobals.js";

let _KwesPayClient = null;

async function getClientClass() {
  if (_KwesPayClient) return _KwesPayClient;
  await ensureBuffer();
  const mod = await import("@kwespay/client");
  _KwesPayClient = mod.KwesPayClient;
  return _KwesPayClient;
}

export default class PaymentService {
  constructor(apiKey, suiNetworks, stellarNetworks, graphqlEndpoint, nearNetworks) {
    this._apiKey = apiKey;
    this._suiNetworks = suiNetworks ?? undefined;
    this._stellarNetworks = stellarNetworks ?? undefined;
    this._graphqlEndpoint = graphqlEndpoint ?? undefined;
    this._nearNetworks = nearNetworks ?? undefined;
    this._client = null;
  }

  async _getClient() {
    if (this._client) return this._client;
    const KwesPayClient = await getClientClass();
    this._client = new KwesPayClient({
      apiKey: this._apiKey,
      suiNetworks: this._suiNetworks,
      stellarNetworks: this._stellarNetworks,
      nearNetworks: this._nearNetworks,
      graphqlEndpoint: this._graphqlEndpoint,
    });
    return this._client;
  }

  async validateAPIKey(vendorId = null) {
    const client = await this._getClient();
    const result = await client.validateKey(vendorId ?? undefined);
    if (!result.isValid) {
      return { valid: false, error: result.error };
    }
    return {
      valid: true,
      vendorInfo: result.vendorInfo,
      allowedNetworks: result.scope?.allowedNetworks ?? null,
      allowedTokens: result.scope?.allowedTokens ?? null,
      scope: {
        allowedVendors: result.scope?.allowedVendors ?? null,
        isAuthorizedForVendor: result.scope?.isAuthorizedForVendor ?? null,
      },
    };
  }

  async getNetworks() {
    const client = await this._getClient();
    return client.getNetworks();
  }

  async getMerchantConfig(vendorIdentifier) {
    const client = await this._getClient();
    return client.getMerchantConfig(vendorIdentifier);
  }

  async getQuote({ vendorId, fiatAmount, fiatCurrency, cryptoCurrency, network, orderId }) {
    const client = await this._getClient();
    return client.getQuote({
      vendorIdentifier: vendorId ?? undefined,
      fiatAmount,
      fiatCurrency: fiatCurrency ?? "USD",
      cryptoCurrency,
      network,
      orderId: orderId ?? undefined,
    });
  }

  async checkBalance({ quote, payerWalletAddress, provider }) {
    const client = await this._getClient();
    return client.checkBalance({ quote, payerWalletAddress, provider });
  }

  async createTransaction({ quote, vendorId, payerWalletAddress }) {
    const client = await this._getClient();
    return client.createTransaction({
      quote,
      vendorIdentifier: vendorId,
      payerWalletAddress,
    });
  }

  async createPayment({ payload, walletProvider, onStatusUpdate }) {
    const client = await this._getClient();
    const result = await client.pay({
      provider: walletProvider,
      payload,
      onStatus: onStatusUpdate,
    });
    return {
      hash: result.txHash,
      transactionReference: result.transactionReference,
      paymentIdBytes32: result.paymentIdBytes32,
      blockNumber: result.blockNumber,
    };
  }

  async createSuiPayment({ payload, wallet, onStatusUpdate }) {
    const client = await this._getClient();
    const result = await client.pay({
      wallet,
      payload,
      onStatus: onStatusUpdate,
    });
    return {
      hash: result.txHash,
      transactionReference: result.transactionReference,
      paymentIdBytes32: result.paymentIdBytes32,
      blockNumber: result.blockNumber,
    };
  }

 
  async createStellarPayment({ payload, wallet, onStatusUpdate }) {
    const client = await this._getClient();
    const result = await client.pay({
      wallet,
      payload,
      onStatus: onStatusUpdate,
    });
    return {
      hash: result.txHash,
      transactionReference: result.transactionReference,
      paymentIdBytes32: result.paymentIdBytes32,
      blockNumber: result.blockNumber,
    };
  }

  async createNearPayment({ payload, wallet, onStatusUpdate }) {
    const client = await this._getClient();
    const result = await client.pay({
      wallet,
      payload,
      onStatus: onStatusUpdate,
    });
    return {
      hash: result.txHash,
      transactionReference: result.transactionReference,
      paymentIdBytes32: result.paymentIdBytes32,
      blockNumber: result.blockNumber,
    };
  }

  async getCrossChainOptions({ quote }) {
    const client = await this._getClient();
    return client.getCrossChainOptions({ quote });
  }

  async payFromAnotherAsset({ quoteId, originAsset, refundAddress }) {
    const client = await this._getClient();
    return client.payFromAnotherAsset({ quoteId, originAsset, refundAddress });
  }

  async sendCrossChainDeposit({ route, wallet, onStatus }) {
    const client = await this._getClient();
    return client.sendCrossChainDeposit({ route, wallet, onStatus });
  }

  async getPaymentRoute(transactionReference) {
    const client = await this._getClient();
    return client.getPaymentRoute(transactionReference);
  }

  async pollTransactionStatus(
    transactionReference,
    { intervalMs, maxAttempts, onStatus } = {}
  ) {
    const client = await this._getClient();
    return client.pollTransactionStatus(transactionReference, {
      intervalMs,
      maxAttempts,
      onStatus,
    });
  }
}
