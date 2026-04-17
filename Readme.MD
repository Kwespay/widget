# @kwespay/widget

> Accept crypto payments in 3 lines of code — drop-in JavaScript widget for EVM chains.

[![npm version](https://img.shields.io/npm/v/@kwespay/widget)](https://www.npmjs.com/package/@kwespay/widget)
[![license](https://img.shields.io/npm/l/@kwespay/widget)](LICENSE)

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
  apiKey: "your_api_key",
  vendorId: "your_vendor_id",
  amount: 10.0,
  currency: "USD",
});

widget.open();
```

That's it. The widget handles wallet connection, network switching, token selection, transaction signing, and success/error states.

---

## Configuration

```js
const widget = new KwesPayWidget({
  apiKey: "your_api_key", // Required — your KwesPay API key
  vendorId: "your_vendor_id", // Required — your merchant identifier
  amount: 25.0, // Required — fiat amount to charge
  currency: "USD", // Optional — "USD" (default) or "GHS"
  acceptedTokens: ["USDT", "USDC"], // Optional — restrict tokens. Pass "stablecoins" to allow all stables
});
```

### `acceptedTokens`

| Value              | Behaviour                            |
| ------------------ | ------------------------------------ |
| `undefined`        | All tokens on all supported networks |
| `"stablecoins"`    | USDT, USDC, DAI, BUSD, USDc          |
| `["USDT", "USDC"]` | Only the listed tokens               |

Tokens are also scoped by your API key's network/token permissions set in the KwesPay dashboard.

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

Network and token availability in the widget is automatically filtered by your API key's permitted scope.

---

## Methods

```js
widget.open(); // Opens the payment widget
widget.close(); // Closes the widget
widget.isOpen(); // Returns boolean
widget.updateAmount(15.0, "USD"); // Update amount without re-creating the widget
widget.getState(); // Returns current widget + config state
widget.destroy(); // Removes widget from DOM and cleans up
```

---

## Events

Listen for widget lifecycle and payment events on the `window`:

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
  // Fulfil the order
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

- **Injected wallets** (MetaMask, Coinbase Wallet, Rabby, etc.) via EIP-6963
- **Mobile wallets** via WalletConnect v2 (QR code + deep link)

---

## Examples

| Example                                                              | Stack                 |
| -------------------------------------------------------------------- | --------------------- |
| [Static HTML demo](https://github.com/kwespay/widget-example-static) | Vanilla JS, unpkg CDN |
| [Next.js demo](https://github.com/kwespay/widget-example-nextjs)     | React, npm            |

---

## License

MIT © KwesPay
