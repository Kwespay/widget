class PaymentService {
  constructor(apiKey, graphqlEndpoint) {
    this.apiKey = apiKey;
    this.graphqlEndpoint = graphqlEndpoint;
    this.client = null;

    console.log("[KwesPay] PaymentService initialized", {
      apiKey: this.apiKey?.slice(0, 6) + "...",
    });
  }

  async _initClient() {
    if (this.client) return;

    console.log("[KwesPay] Initializing SDK client...");

    const { KwesPayClient } = await import("@kwespay/client");

    this.client = new KwesPayClient({ apiKey: this.apiKey });

    console.log("[KwesPay] SDK client ready");
  }

  async validateAPIKey() {
    try {
      await this._initClient();

      const result = await this.client.validateKey();

      if (!result.isValid) {
        console.error("[KwesPay] Invalid API key:", result.error);
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

    console.log("[KwesPay] Requesting quote...", params);

    const quote = await this.client.quote({
      vendorIdentifier: params.vendorId,
      fiatAmount: params.fiatAmount,
      fiatCurrency: params.fiatCurrency || "USD",
      cryptoCurrency: params.cryptoCurrency,
      network: params.network,
      payerWalletAddress: params.payerWalletAddress,
    });

    console.log("[KwesPay] Quote received:", quote);

    return quote;
  }

  async createPayment({ payload, walletProvider, onStatusUpdate }) {
    await this._initClient();

    console.log("[KwesPay] 💳 createPayment called", {
      payloadKeys: payload ? Object.keys(payload) : null,
      amountBaseUnits: payload?.amountBaseUnits,
      contractAddress: payload?.contractAddress,
      paymentId: payload?.paymentId,
      vendorAddress: payload?.vendorAddress,
      expiresAt: payload?.expiresAt,
      providerType: walletProvider?.constructor?.name,
    });

    try {
      const result = await this.client.pay({
        provider: walletProvider,
        payload,
        onStatus: (status) => {
          console.log("[KwesPay] 📋 Payment status update:", status);
          onStatusUpdate?.(status);
        },
      });

      console.log("[KwesPay] ✅ Payment completed:", result);

      return {
        hash: result.txHash,
        blockNumber: result.blockNumber,
        transactionReference: result.transactionReference,
        paymentIdBytes32: result.paymentIdBytes32,
      };
    } catch (err) {
      console.error("[KwesPay] ❌ createPayment error:", {
        message: err?.message,
        code: err?.code,
        reason: err?.reason,
        data: err?.data,
        transaction: err?.transaction
          ? {
              to: err.transaction?.to,
              from: err.transaction?.from,
              value: err.transaction?.value?.toString(),
              gasLimit: err.transaction?.gasLimit?.toString(),
              data: err.transaction?.data,
            }
          : undefined,
        receipt: err?.receipt
          ? {
              status: err.receipt?.status,
              gasUsed: err.receipt?.gasUsed?.toString(),
              blockNumber: err.receipt?.blockNumber,
              transactionHash: err.receipt?.transactionHash,
            }
          : undefined,
        stack: err?.stack,
        raw: err,
      });
      throw err;
    }
  }

  async getTransactionStatus(transactionReference) {
    await this._initClient();

    console.log("[KwesPay] Fetching transaction status:", transactionReference);

    const status = await this.client.getTransactionStatus(transactionReference);

    console.log("[KwesPay] Transaction status:", status);

    return status;
  }

  async pollTransactionStatus(
    transactionReference,
    { onStatus, intervalMs = 4000, maxAttempts = 60 } = {}
  ) {
    await this._initClient();

    console.log("[KwesPay] Starting polling...", {
      transactionReference,
      intervalMs,
    });

    let attempts = 0;

    return new Promise((resolve, reject) => {
      const id = setInterval(async () => {
        attempts++;

        try {
          const status = await this.getTransactionStatus(transactionReference);

          console.log(
            `[KwesPay] Poll attempt ${attempts}:`,
            status.transactionStatus
          );

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
            console.log(
              "[KwesPay] Final status reached:",
              status.transactionStatus
            );
            clearInterval(id);
            resolve(status);
          } else if (attempts >= maxAttempts) {
            console.error("[KwesPay] Polling timeout");
            clearInterval(id);
            reject(new Error("Transaction status polling timed out."));
          }
        } catch (err) {
          console.error("[KwesPay] Polling error:", err);

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
