# @kwespay/widget

Checkout modal for accepting crypto priced in fiat. EVM networks, Sui, Stellar and NEAR, plus payment from other chains powered by NEAR Intents.

Full documentation: [docs.kwespay.xyz/guides/checkout-widget](https://docs.kwespay.xyz/guides/checkout-widget/)

## HTML embed

```html
<script
  type="module"
  src="https://cdn.jsdelivr.net/npm/@kwespay/widget@1.2.0/dist/browser/kwespay-widget.js"
  data-kwespay-key="YOUR_API_KEY"
></script>

<button data-kwespay-amount="49.99" data-kwespay-currency="USD" data-kwespay-order="A-1042">Pay with crypto</button>
```

The key, vendor (`data-kwespay-vendor`) and environment (`data-kwespay-environment`) are read only from the script tag. The customer stays on your page: listen for `kwespay:result` on `document` to react when checkout finishes.

## JavaScript

```bash
npm install @kwespay/widget
```

```js
import { kwespay } from "@kwespay/widget";

const result = await kwespay({
  apiKey: "YOUR_API_KEY",
  amount: 49.99,
  currency: "USD",
  orderId: "A-1042",
});
```

## Confirm on your server

The browser result can be altered, so confirm the order with `@kwespay/client` before fulfilling it:

```js
const check = await kwespay.verifyPayment(reference, { orderId: "A-1042", amount: 49.99, currency: "USD" });
if (check.paid) await markOrderPaid("A-1042");
```

## Options

| Option | Default | |
| --- | --- | --- |
| `apiKey` | required | API key from the dashboard |
| `amount` | required | Fiat amount |
| `orderId` | | Your order ID, checked by `verifyPayment` |
| `vendorId` | from the key | Only needed when the key can access more than one merchant |
| `currency` | `"USD"` | Any ISO 4217 code |
| `environment` | `"mainnet"` | `"mainnet"` or `"testnet"` |
| `graphqlEndpoint` | | Overrides `environment` |
| `acceptedTokens` | all | Array of symbols, or `"stablecoins"` |
| `nearWallet` | | A NEAR wallet your page already connected (`getAccounts` + `signAndSendTransaction`). The widget then skips its NEAR wallet picker |
| `onPaymentSuccess` | | Transaction broadcast. Not proof of payment |
| `onPaymentConfirmed` | | KwesPay recorded `completed` |
| `onPaymentFinalised` | | Any final status, or `unconfirmed` |
| `onPaymentUnconfirmed` | | Confirmation timed out |
| `onPaymentError` | | A step failed. The customer may retry |

Networks, contracts and tokens are loaded from the KwesPay API for the chosen environment and filtered to what the merchant accepts. Nothing is hardcoded in the widget.

On NEAR the customer picks Meteor, Intear or Sender. The widget loads `@near-wallet-selector` from jsDelivr only when the customer chooses a NEAR network, so pages that never use NEAR download nothing extra.

## Pay from any chain (powered by NEAR Intents)

When a merchant turns on payments from other assets, the network list shows **Pay with XLM or BTC** next to the usual networks. No extra code or configuration is needed in your page.

1. The customer picks XLM or BTC and sees the live price.
2. They enter their own address for refunds.
3. The widget shows the amount, deposit address, memo and a QR code. The customer sends from any wallet or exchange; nothing connects to your site.
4. [NEAR Intents](https://near-intents.org) converts the payment and delivers USDC to the merchant on Base. KwesPay verifies the delivery on-chain, then the widget shows the receipt.

The result is the same as any other payment, with `network: "base"`, `token: "USDC"` and a `paidWith` field (`{ asset, amount, transactions }`). `transactionHash` is the Base delivery. Confirm it on your server with `verifyPayment()` as usual. The `crossChainDepositReady` event fires when the deposit details are shown.

## Result

`kwespay()` and `widget.open()` resolve with:

```ts
{
  transactionHash: string;
  transactionReference: string;
  paymentIdBytes32: string;
  transactionStatus: "completed" | "underpaid" | "overpaid" | "failed" | "expired" | "refunded" | "unconfirmed";
  fiatAmount: number;
  currency: string;
  token: string;
  network: string;
  orderId: string | null;
}
```

Only `completed` means paid in full. `unconfirmed` means the transaction was sent but KwesPay had not confirmed it yet. Do not treat it as paid.

The promise rejects only when the customer closes the widget without paying, or `destroy()` is called. `err.code` is `USER_CANCELLED`, `WIDGET_DESTROYED`, or the last failure the customer saw, such as `USER_REJECTED` or `INSUFFICIENT_BALANCE`.

## Methods

| Method | |
| --- | --- |
| `open()` | Opens the widget. Returns the payment promise |
| `close()` | Closes the widget and settles the promise |
| `destroy()` | Removes the widget. Rejects with `WIDGET_DESTROYED` |
| `isOpen()` | `true` while visible |
| `updateAmount(amount, currency?)` | Change the amount between opens |
| `getState()` | Debug snapshot |

## Events

Dispatched on `window` as `kwespay:<name>`:

`widgetOpened`, `widgetClosed`, `apiKeyValidated`, `apiKeyInvalid`, `apiKeyError`, `walletConnected`, `walletConnectionError`, `crossChainDepositReady`, `paymentSuccess`, `paymentFinalised`, `paymentConfirmed`, `paymentIncomplete`, `paymentUnconfirmed`, `paymentError`, `paymentCancelled`, `amountUpdated`, `widgetDestroyed`.

Events run in the customer's browser. They are not proof of payment.

## Development

```bash
pnpm install
pnpm build
pnpm check:publish
```

`pnpm.overrides` points `@kwespay/client` at the local SDK tarball for development. `prepublishOnly` refuses to publish while the required SDK version is not on npm, a dependency uses a local path, or the build contains a private endpoint.

## License

MIT
