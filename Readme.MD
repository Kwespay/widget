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

```js
import KwesPayWidget from "@kwespay/widget";

const widget = new KwesPayWidget({
  apiKey: "your_api_key", // from app.kwespay.xyz
  vendorId: "your_vendor_id", // from app.kwespay.xyz
  amount: 10.0,
  currency: "USD",
});

widget.open();
```

The widget handles everything — wallet connection, network switching, token selection, transaction signing, and success/error states.

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

Token and network availability is also scoped by the permissions set on your API key in the dashboard.

---

## Supported Networks

| Network      | Chain ID | Type    |
| ------------ | -------- | ------- |
| Ethereum     | 1        | Mainnet |
| Polygon      | 137      | Mainnet |
| Base         | 8453     | Mainnet |
| Lisk         | 1135     | Mainnet |
| Sepolia      | 11155111 | Testnet |
| Polygon Amoy | 80002    | Testnet |
| Base Sepolia | 84532    | Testnet |
| Lisk Sepolia | 4202     | Testnet |

---

## Methods

```js
widget.open(); // Open the payment widget
widget.close(); // Close the widget
widget.isOpen(); // Returns boolean
widget.updateAmount(15.0, "USD"); // Update amount on the fly
widget.getState(); // Returns current widget and config state
widget.destroy(); // Remove widget from DOM and clean up
```

---

## Events

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

## Examples

| Example                                                              | Stack                 |
| -------------------------------------------------------------------- | --------------------- |
| [Static HTML demo](https://github.com/kwespay/widget-example-static) | Vanilla JS, unpkg CDN |
| [Next.js demo](https://github.com/kwespay/widget-example-nextjs)     | React, npm            |

---

## License

MIT © KwesPay
