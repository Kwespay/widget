let pending = null;

export function ensureBuffer() {
  if (typeof globalThis === "undefined" || globalThis.Buffer) {
    return Promise.resolve();
  }
  if (!pending) {
    pending = import("buffer").then(({ Buffer }) => {
      if (!globalThis.Buffer) globalThis.Buffer = Buffer;
    });
  }
  return pending;
}
