/* eslint-disable no-bitwise */
const CHARS =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const lookup = new Uint8Array(128);
for (let i = 0; i < CHARS.length; i++) lookup[CHARS.charCodeAt(i)] = i;

/** Decodes base64 to bytes (Hermes' atob is slow and not always present). */
export function base64ToBytes(b64: string): Uint8Array {
  const pad = b64.endsWith('==') ? 2 : b64.endsWith('=') ? 1 : 0;
  const bytes = new Uint8Array((b64.length * 3) / 4 - pad);
  let p = 0;
  for (let i = 0; i < b64.length; i += 4) {
    const a = lookup[b64.charCodeAt(i)];
    const b = lookup[b64.charCodeAt(i + 1)];
    const c = lookup[b64.charCodeAt(i + 2)];
    const d = lookup[b64.charCodeAt(i + 3)];
    bytes[p++] = (a << 2) | (b >> 4);
    if (p < bytes.length) bytes[p++] = ((b & 15) << 4) | (c >> 2);
    if (p < bytes.length) bytes[p++] = ((c & 3) << 6) | d;
  }
  return bytes;
}
