# @kwespay/widget

> Accept crypto payments on any EVM chain with a single JavaScript widget.

[![npm version](https://img.shields.io/npm/v/@kwespay/widget)](https://www.npmjs.com/package/@kwespay/widget)
[![license](https://img.shields.io/npm/l/@kwespay/widget)](LICENSE)

---

## Get Started

1. Create a merchant account at [app.kwespay.xyz](https://app.kwespay.xyz)
2. Grab your **API Key** and **Vendor ID** from the dashboard
3. Install the widget and start accepting payments

---

## Installation

```bash
npm install @kwespay/widget
```

Or load via CDN (no bundler required):

```html
<script src="https://unpkg.com/@kwespay/widget/dist/kwespay-widget.min.js"></script>
```

---

## Quick Start

### One-liner (recommended)

The `kwespay()` function is the simplest way to integrate. It handles widget
creation, amount updates, and cleanup automatically — one `await` and you're done.

```js
import { kwespay } from "@kwespay/widget";

try {
  const result = await kwespay({
    apiKey: "your_api_key", // from app.kwespay.xyz
    vendorId: "your_vendor_id", // from app.kwespay.xyz
    amount: 49.99,
    currency: "USD",
  });

  console.log("Payment confirmed:", result.transactionHash);
  // fulfil your order here
} catch (err) {
  if (err.code !== "USER_CANCELLED") {
    console.error("Payment failed:", err.message);
  }
}
```

### Class-based (full lifecycle control)

If you need to manage the widget instance yourself — for example, to call
`updateAmount()` or `destroy()` explicitly — use the class directly.

```js
import KwesPayWidget from "@kwespay/widget";

const widget = new KwesPayWidget({
  apiKey: "your_api_key",
  vendorId: "your_vendor_id",
  amount: 49.99,
  currency: "USD",
});

try {
  const result = await widget.open();
  console.log("Payment confirmed:", result.transactionHash);
} catch (err) {
  if (err.code !== "USER_CANCELLED") {
    console.error("Payment failed:", err.message);
  }
} finally {
  widget.destroy();
}
```

The widget handles everything — wallet connection, network switching, token
selection, transaction signing, and success/error states.

---

## Configuration

```js
const widget = new KwesPayWidget({
  apiKey: "your_api_key", // Required — from app.kwespay.xyz
  vendorId: "your_vendor_id", // Required — from app.kwespay.xyz
  amount: 25.0, // Required — fiat amount to charge
  currency: "USD", // Optional — "USD" (default) or "GHS"
  acceptedTokens: ["USDT", "USDC"], // Optional — restrict accepted tokens
});
```

### `acceptedTokens`

| Value              | Behaviour                            |
| ------------------ | ------------------------------------ |
| `undefined`        | All tokens on all supported networks |
| `"stablecoins"`    | USDT, USDC, DAI, BUSD, USDc          |
| `["USDT", "USDC"]` | Only the listed tokens               |

Token and network availability is also scoped by the permissions set on your
API key in the dashboard.

---

## Supported Networks

| Network      | Chain ID | Type    |
| ------------ | -------- | ------- |
| Ethereum     | 1        | Mainnet |
| MEZO         | 31612    | Mainnet |
| Polygon      | 137      | Mainnet |
| Base         | 8453     | Mainnet |
| Lisk         | 1135     | Mainnet |
| Sepolia      | 11155111 | Testnet |
| Polygon Amoy | 80002    | Testnet |
| Base Sepolia | 84532    | Testnet |
| Lisk Sepolia | 4202     | Testnet |
| MEZO Testnet | 31611    | Testnet |

---

## Payment Result

Both `kwespay()` and `widget.open()` resolve with the same result object:

```ts
{
  transactionHash: string; // On-chain transaction hash
  transactionReference: string; // KwesPay internal payment reference
  paymentIdBytes32: string; // On-chain payment ID (bytes32)
  transactionStatus: "completed" | "unconfirmed";
  fiatAmount: number; // Charged fiat amount
  currency: string; // e.g. "USD"
  token: string; // e.g. "USDC"
  network: string; // e.g. "polygon"
}
```

`"unconfirmed"` means the transaction is confirmed on-chain but the KwesPay
backend did not acknowledge it within the polling window. The payment is still
valid — reconcile it via the `kwespay:paymentUnconfirmed` event or your backend.

### Error codes

The returned Promise rejects with an `Error` whose `.code` is one of:

| Code               | Meaning                                           |
| ------------------ | ------------------------------------------------- |
| `USER_CANCELLED`   | User closed the widget without completing payment |
| `USER_REJECTED`    | User rejected the transaction in their wallet     |
| `SESSION_EXPIRED`  | Wallet session timed out mid-payment              |
| `WIDGET_DESTROYED` | `widget.destroy()` was called mid-payment         |
| `UNKNOWN`          | Unexpected error — check `err.message`            |

---

## Methods

These are available on a `KwesPayWidget` instance. When using `kwespay()` you
don't need to call any of them — they are managed for you.

```js
widget.open(); // Open the widget — returns a Promise<PaymentResult>
widget.close(); // Close the widget
widget.isOpen(); // Returns boolean
widget.updateAmount(15.0, "USD"); // Update amount between opens
widget.getState(); // Returns current widget and config state
widget.destroy(); // Remove widget from DOM and clean up
```

---

## Events

DOM events are dispatched on `window` for every significant widget action.
These fire regardless of whether you use `kwespay()` or the class directly,
and are useful for analytics, logging, or non-`async` integrations.

```js
window.addEventListener("kwespay:paymentSuccess", (e) => {
  const {
    transactionHash,
    transactionReference,
    paymentIdBytes32,
    fiatAmount,
    currency,
    token,
    network,
  } = e.detail;
  // fulfil your order here
});

window.addEventListener("kwespay:paymentError", (e) => {
  console.error(e.detail.error, e.detail.errorType);
});

window.addEventListener("kwespay:paymentUnconfirmed", (e) => {
  // On-chain tx succeeded but backend confirmation timed out.
  // Safe to treat as paid — reconcile async on your backend.
  console.log(e.detail.transactionReference, e.detail.transactionHash);
});

window.addEventListener("kwespay:paymentCancelled", (e) => {
  console.log(e.detail.reason); // "user_cancelled_review" | "user_started_over"
});

window.addEventListener("kwespay:widgetOpened", () => {});

window.addEventListener("kwespay:widgetClosed", (e) => {
  console.log(e.detail.completedPayment); // boolean
});

window.addEventListener("kwespay:apiKeyValidated", (e) => {
  console.log(e.detail.vendorInfo);
});
```

---

## Wallet Support

- **Injected wallets** — MetaMask, Coinbase Wallet, Rabby, and any EIP-6963 compatible wallet
- **Mobile wallets** — WalletConnect v2 via QR code and deep link

---

## Examples

| Example                                                                 | Stack                 |
| ----------------------------------------------------------------------- | --------------------- |
| [Static HTML demo](https://github.com/kwespay/widget-example-static)    | Vanilla JS, unpkg CDN |
| [Next.js demo](https://github.com/Kwespay/Kwespay-embedded-widget-demo) | Next.js, React, npm   |

---

## License

MIT © KwesPay
