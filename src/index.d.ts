declare module "@kwespay/widget" {
  export type FinalStatus =
    | "completed"
    | "underpaid"
    | "overpaid"
    | "failed"
    | "expired"
    | "refunded";

  export interface SuiNetworkOverride {
    packageId?: string;
    registryObjectId?: string;
  }

  export interface StellarNetworkOverride {
    contractId?: string;
    rpcUrl?: string;
  }

  export interface NearNetworkOverride {
    contractId?: string;
    rpcUrl?: string;
  }

  export interface NearWallet {
    getAccounts(): Promise<Array<{ accountId: string }>>;
    signAndSendTransaction(params: {
      signerId?: string;
      receiverId: string;
      actions: Array<{
        type: "FunctionCall";
        params: { methodName: string; args: Record<string, unknown>; gas: string; deposit: string };
      }>;
    }): Promise<unknown>;
  }

  export interface KwesPayConfig {
    apiKey: string;
    vendorId?: string;
    amount: number;
    orderId?: string;
    currency?: string;
    environment?: "mainnet" | "testnet";
    graphqlEndpoint?: string;
    acceptedTokens?: string[] | "stablecoins";
    appName?: string;
    projectId?: string;
    suiNetworks?: Record<string, SuiNetworkOverride>;
    stellarNetworks?: Record<string, StellarNetworkOverride>;
    nearNetworks?: Record<string, NearNetworkOverride>;
    nearWallet?: NearWallet;
    onPaymentSuccess?: (payload: PaymentResult) => void;
    onPaymentConfirmed?: (payload: PaymentResult) => void;
    onPaymentFinalised?: (payload: PaymentResult) => void;
    onPaymentUnconfirmed?: (payload: UnconfirmedPayload) => void;
    onPaymentError?: (payload: ErrorPayload) => void;
  }

  export interface PaidWith {
    asset: string;
    amount: string;
    transactions: Array<{ hash: string; explorerUrl: string | null }>;
  }

  export interface PaymentResult {
    transactionHash: string;
    transactionReference: string;
    paymentIdBytes32: string | null;
    transactionStatus: FinalStatus | "unconfirmed";
    fiatAmount: number;
    currency: string;
    token: string;
    network: string;
    orderId: string | null;
    paidWith?: PaidWith;
  }

  export interface UnconfirmedPayload {
    transactionReference: string;
    transactionHash: string;
    reason: string;
  }

  export interface ErrorPayload {
    error: string;
    errorType: string;
  }

  export type WidgetErrorCode =
    | "USER_CANCELLED"
    | "USER_REJECTED"
    | "SESSION_EXPIRED"
    | "WIDGET_DESTROYED"
    | "UNKNOWN"
    | (string & {});

  export class KwesPayWidget {
    constructor(config: KwesPayConfig);
    open(): Promise<PaymentResult>;
    close(): void;
    destroy(): void;
    isOpen(): boolean;
    updateAmount(amount: number, currency?: string): void;
    getState(): object;
  }

  export function kwespay(config: KwesPayConfig): Promise<PaymentResult>;
  export function attemptMobileResume(): void;
  export function hasPendingMobileResume(): boolean;

  export default KwesPayWidget;
}
