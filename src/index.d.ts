declare module "@kwespay/widget" {
  export interface KwesPayConfig {
    apiKey: string;
    vendorId: string;
    amount: number;
    currency?: string;
    acceptedTokens?: string[] | "stablecoins";
    onPaymentSuccess?: (payload: PaymentResult) => void;
    onPaymentConfirmed?: (payload: PaymentResult) => void;
    onPaymentUnconfirmed?: (payload: UnconfirmedPayload) => void;
    onPaymentError?: (payload: { error: string; errorType: string }) => void;
  }

  export interface PaymentResult {
    transactionHash: string;
    transactionReference: string;
    paymentIdBytes32: string;
    /** "completed" when backend confirmed; "unconfirmed" on polling timeout */
    transactionStatus: "completed" | "unconfirmed";
    fiatAmount: number;
    currency: string;
    token: string;
    network: string;
  }

  export interface UnconfirmedPayload {
    transactionReference: string;
    transactionHash: string;
    reason: string;
  }

  export class KwesPayWidget {
    constructor(config: KwesPayConfig);

    /**
     * Open the widget and await the payment result.
     *
     * Resolves with PaymentResult on success.
     * Rejects with an Error (err.code set) on cancellation or failure.
     */
    open(): Promise<PaymentResult>;

    close(): void;
    destroy(): void;
    isOpen(): boolean;
    updateAmount(amount: number, currency?: string): void;
    getState(): object;
  }

  /**
   * Open the KwesPay checkout widget and await the result.
   * Handles instance lifecycle (creation, caching, cleanup) automatically.
   *
   * @example
   * try {
   *   const result = await kwespay({ apiKey, vendorId, amount, currency: "USD" });
   *   console.log("Paid:", result.transactionHash);
   * } catch (err) {
   *   if (err.code !== "USER_CANCELLED") console.error(err);
   * }
   */
  export function kwespay(config: KwesPayConfig): Promise<PaymentResult>;

  /** Default export is the KwesPayWidget class (backward compatibility) */
  export default KwesPayWidget;
}
