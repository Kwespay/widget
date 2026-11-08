
const PATHS = {
  arrow_back: '<path d="M19 12H5"/><path d="M11 18l-6-6 6-6"/>',
  chevron_right: '<path d="M9 5l7 7-7 7"/>',
  check_circle:
    '<circle cx="12" cy="12" r="9"/><path d="M8 12.5l2.5 2.5L16 9.5"/>',
  account_balance_wallet:
    '<path d="M3 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v2"/><path d="M3 7v10a2 2 0 0 0 2 2h14a1 1 0 0 0 1-1v-4"/><path d="M14 13h4a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1h-4a2 2 0 0 1 0-4Z"/>',
  lock: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  shield_lock:
    '<path d="M12 3l7 3v6c0 4.5-3 8-7 9-4-1-7-4.5-7-9V6l7-3Z"/><rect x="9.5" y="12" width="5" height="4" rx="1"/><path d="M10.5 12v-1.5a1.5 1.5 0 0 1 3 0V12"/>',
  wifi_off:
    '<path d="M3 3l18 18"/><path d="M5 12.5a11 11 0 0 1 3.3-2.1M15.7 10.4A11 11 0 0 1 19 12.5M8.8 16a5.5 5.5 0 0 1 6.4 0"/><path d="M12 20h.01"/>',
  schedule: '<circle cx="12" cy="12" r="9"/><path d="M12 7.5V12l3 2"/>',
  link_off: '<path d="M9 15l6-6"/><path d="M10.5 6.5l1.4-1.4a4 4 0 0 1 5.7 5.7l-1.4 1.4"/><path d="M13.5 17.5l-1.4 1.4a4 4 0 0 1-5.7-5.7l1.4-1.4"/><path d="M3 3l18 18"/>',
  location_on: '<path d="M12 21s-6.5-5.4-6.5-11a6.5 6.5 0 0 1 13 0c0 5.6-6.5 11-6.5 11Z"/><circle cx="12" cy="10" r="2.5"/>',
  receipt_long:
    '<path d="M6 3h12v18l-2-1.3L14 21l-2-1.3L10 21l-2-1.3L6 21V3Z"/><path d="M9 8h6M9 12h6M9 16h3.5"/>',
  payments: '<circle cx="9" cy="9.5" r="5.5"/><circle cx="15" cy="14.5" r="5.5"/>',
  phone_iphone:
    '<rect x="7" y="2" width="10" height="20" rx="2"/><path d="M11 18.5h2"/>',
  cloud_sync:
    '<path d="M7.5 18a4.5 4.5 0 0 1-1-8.9 5.5 5.5 0 0 1 10.6-2A4.5 4.5 0 0 1 16.5 18h-9Z"/><path d="M10 14.5a2 2 0 0 1 3.5-1.3M14 12.5v1.7h-1.7M14 14.5a2 2 0 0 1-3.5 1.3M10 16.5v-1.7h1.7"/>',
  open_in_new:
    '<path d="M14 4h6v6"/><path d="M20 4l-9 9"/><path d="M9 5H6a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-3"/>',
  error: '<circle cx="12" cy="12" r="9"/><path d="M12 8v5"/><path d="M12 16h.01"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5"/><path d="M12 8h.01"/>',
  qr_code_2:
    '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="3" height="3"/><rect x="19" y="14" width="2" height="2"/><rect x="14" y="19" width="2" height="2"/><rect x="18" y="18" width="3" height="3"/>',
};

export function icon(name, extraClass = "", extraStyle = "") {
  const inner = PATHS[name] ?? "";
  const cls = extraClass
    ? `material-symbols-outlined ${extraClass}`
    : "material-symbols-outlined";
  const styleAttr = extraStyle ? ` style="${extraStyle}"` : "";
  return (
    `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" ` +
    `stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ` +
    `aria-hidden="true"${styleAttr}>${inner}</svg>`
  );
}
