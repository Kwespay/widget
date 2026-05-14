class PaymentService {
  constructor(apiKey, graphqlEndpoint) {
    this.apiKey = apiKey;
    this.graphqlEndpoint = graphqlEndpoint;
    this._graphqlEndpoint = graphqlEndpoint;
    this._apiKey = apiKey;
    this.client = null;
  }

  async _initClient() {
    if (this.client) return;
    const { KwesPayClient } = await import("@kwespay/client");
    this.client = new KwesPayClient({ apiKey: this.apiKey });
  }

  async _rawGql(query, variables) {
    const res = await fetch(this._graphqlEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": this._apiKey,
      },
      body: JSON.stringify({ query, variables }),
    });
    return res.json();
  }

  async validateAPIKey() {
    try {
      await this._initClient();
      const result = await this.client.validateKey();
      if (!result.isValid) {
        return { valid: false, error: result.error ?? "Invalid access key" };
      }
      return {
        valid: true,
        keyId: result.keyId,
        vendorInfo: result.vendorInfo,
        allowedVendors: result.scope.allowedVendors ?? null,
        allowedNetworks: result.scope.allowedNetworks ?? null,
        allowedTokens: result.scope.allowedTokens ?? null,
      };
    } catch (err) {
      console.error("[KwesPay] API key validation error:", err);
      return { valid: false, error: err.message };
    }
  }

  async getQuote(params) {
    await this._initClient();
    return this.client.getQuote({
      vendorIdentifier: params.vendorIdentifier,
      fiatAmount: params.fiatAmount,
      fiatCurrency: params.fiatCurrency || "USD",
      cryptoCurrency: params.cryptoCurrency,
      network: params.network,
    });
  }

  async createPayment({ payload, walletProvider, onStatusUpdate }) {
    await this._initClient();

    const accounts = await walletProvider.request({ method: "eth_accounts" });
    const payerWalletAddress = accounts[0];

    // Call createTransaction directly so we can request the deadline field,
    // which the SDK's GQL_CREATE_TRANSACTION query does not yet include.
    const rawTx = await this._rawGql(
      `mutation CreateTransaction($input: CreateTransactionInput!) {
        createTransaction(input: $input) {
          success
          message
          paymentIdBytes32
          backendSignature
          tokenAddress
          amountBaseUnits
          chainId
          deadline
          expiresAt
          transaction {
            transactionReference
            transactionStatus
          }
        }
      }`,
      { input: { quoteId: payload.quoteId, payerWalletAddress } }
    );

    const ct = rawTx?.data?.createTransaction;

    if (!ct?.success) {
      throw new Error(ct?.message ?? "Transaction creation failed");
    }

    if (!ct.deadline) {
      throw new Error("Backend did not return a deadline");
    }

    // Compute totalBaseUnits locally — mirrors the contract formula:
    // fee = (amount * 50) / 10000,  total = amount + fee
    const PLATFORM_FEE_BPS = 50n;
    const amountBig = BigInt(ct.amountBaseUnits);
    const feeBig = (amountBig * PLATFORM_FEE_BPS) / 10000n;
    const totalBig = amountBig + feeBig;

    // Build the complete TransactionPayload the SDK's pay() expects.
    const txPayload = {
      paymentIdBytes32: ct.paymentIdBytes32,
      backendSignature: ct.backendSignature,
      tokenAddress: ct.tokenAddress,
      amountBaseUnits: ct.amountBaseUnits,
      totalBaseUnits: totalBig.toString(),
      chainId: ct.chainId,
      deadline: ct.deadline,
      expiresAt: ct.expiresAt,
      transactionReference: ct.transaction.transactionReference,
      transactionStatus: ct.transaction.transactionStatus,
      network: payload.network,
      vendorIdentifier: payload.vendorIdentifier,
    };

    const result = await this.client.pay({
      provider: walletProvider,
      payload: txPayload,
      onStatus: (title, detail) => onStatusUpdate?.(title, detail),
    });

    return {
      hash: result.txHash,
      blockNumber: result.blockNumber,
      transactionReference: result.transactionReference,
      paymentIdBytes32: result.paymentIdBytes32,
    };
  }

  async getTransactionStatus(transactionReference) {
    await this._initClient();
    return this.client.getTransactionStatus(transactionReference);
  }

  async pollTransactionStatus(
    transactionReference,
    { onStatus, intervalMs = 4000, maxAttempts = 60 } = {}
  ) {
    await this._initClient();
    let attempts = 0;
    return new Promise((resolve, reject) => {
      const id = setInterval(async () => {
        attempts++;
        try {
          const status = await this.getTransactionStatus(transactionReference);
          onStatus?.(status.transactionStatus);
          const terminal = [
            "completed",
            "failed",
            "expired",
            "underpaid",
            "overpaid",
            "refunded",
          ];
          if (terminal.includes(status.transactionStatus)) {
            clearInterval(id);
            resolve(status);
          } else if (attempts >= maxAttempts) {
            clearInterval(id);
            reject(new Error("Transaction status polling timed out."));
          }
        } catch (err) {
          if (attempts >= maxAttempts) {
            clearInterval(id);
            reject(err);
          }
        }
      }, intervalMs);
    });
  }
}

export default PaymentService;
