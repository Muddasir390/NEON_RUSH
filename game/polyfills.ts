/* eslint-disable no-bitwise */
// Hermes has no TextDecoder; three's GLTFLoader needs one to read the JSON chunk.
type Bytes = ArrayBuffer | ArrayBufferView;

class Utf8Decoder {
  decode(input?: Bytes): string {
    if (!input) return '';
    const bytes =
      input instanceof ArrayBuffer
        ? new Uint8Array(input)
        : new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
    let out = '';
    let i = 0;
    while (i < bytes.length) {
      const b = bytes[i++];
      let cp = b;
      if (b >= 0xf0) {
        cp =
          ((b & 7) << 18) |
          ((bytes[i++] & 63) << 12) |
          ((bytes[i++] & 63) << 6) |
          (bytes[i++] & 63);
      } else if (b >= 0xe0) {
        cp = ((b & 15) << 12) | ((bytes[i++] & 63) << 6) | (bytes[i++] & 63);
      } else if (b >= 0xc0) {
        cp = ((b & 31) << 6) | (bytes[i++] & 63);
      }
      out += String.fromCodePoint(cp);
    }
    return out;
  }
}

const globalAny = globalThis as unknown as { TextDecoder?: unknown };
if (typeof globalAny.TextDecoder === 'undefined') {
  globalAny.TextDecoder = Utf8Decoder;
}
