
const RESUME_KEY = "kwespay:mobile-resume";
const RESUME_TTL_MS = 15 * 60 * 1000;

export function saveResumeState(record, now = Date.now()) {
  try {
    localStorage.setItem(
      RESUME_KEY,
      JSON.stringify({ v: 1, ts: now, ...record })
    );
  } catch (_) {
  }
}


export function loadResumeState(now = Date.now()) {
  let raw;
  try {
    raw = localStorage.getItem(RESUME_KEY);
  } catch (_) {
    return null;
  }
  if (!raw) return null;

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (_) {
    clearResumeState();
    return null;
  }

  if (
    !parsed ||
    parsed.v !== 1 ||
    typeof parsed.ts !== "number" ||
    now - parsed.ts > RESUME_TTL_MS ||
    !(parsed.config?.apiKey || parsed.config?.paymentLink) ||
    !parsed.flow?.network
  ) {
    clearResumeState();
    return null;
  }

  return parsed;
}

export function clearResumeState() {
  try {
    localStorage.removeItem(RESUME_KEY);
  } catch (_) {}
}
