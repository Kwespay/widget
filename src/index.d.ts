declare module "@kwespay/widget" {
  interface KwesPayOptions {
    apiKey: string;
    vendorId: string;
    amount: number;
    currency?: string;
    acceptedTokens?: string[] | "stablecoins";
  }

  export default class KwesPayWidget {
    constructor(options: KwesPayOptions);

    open(): Promise<void>;
    close(): void;
    destroy(): void;
    updateAmount(amount: number, currency?: string): void;
    isOpen(): boolean;
  }
}
