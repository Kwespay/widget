function injectOnboardZIndexFix() {
  const id = "kwespay-onboard-zfix";
  if (document.getElementById(id)) return;

  const style = document.createElement("style");
  style.id = id;
  style.textContent = `
    :root {
      --onboard-modal-z-index: 10000000;
      --onboard-account-select-modal-z-index: 10000001;
    }
  `;
  document.head.appendChild(style);
}
