import KwesPayWidget, { kwespay } from "./index.js";

const KwesPay = { KwesPayWidget, kwespay, default: KwesPayWidget };

if (typeof window !== "undefined") {
  window.KwesPay = KwesPay;
}

export { KwesPayWidget, kwespay };
export default KwesPay;
