/** Internal dependency-free RFC UUIDv5 implementation for stable identity derivation. */

export function deriveUuidV5(namespaceUuid: string, name: string): string {
  const namespace = uuidToBytes(namespaceUuid);
  const nameBytes = new TextEncoder().encode(name);
  const digest = sha1(concatenate(namespace, nameBytes));
  const uuidBytes = digest.slice(0, 16);

  const versionByte = uuidBytes[6];
  const variantByte = uuidBytes[8];
  if (versionByte === undefined || variantByte === undefined) {
    throw new Error('UUIDv5 digest did not contain 16 bytes.');
  }

  uuidBytes[6] = (versionByte & 0x0f) | 0x50;
  uuidBytes[8] = (variantByte & 0x3f) | 0x80;
  return bytesToUuid(uuidBytes);
}

function uuidToBytes(uuid: string): Uint8Array {
  const hex = uuid.replaceAll('-', '');
  const bytes = new Uint8Array(16);
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16);
  }
  return bytes;
}

function bytesToUuid(bytes: Uint8Array): string {
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

function concatenate(left: Uint8Array, right: Uint8Array): Uint8Array {
  const combined = new Uint8Array(left.length + right.length);
  combined.set(left);
  combined.set(right, left.length);
  return combined;
}

function rotateLeft(value: number, bits: number): number {
  return ((value << bits) | (value >>> (32 - bits))) >>> 0;
}

/** FIPS PUB 180-4 SHA-1, used only because RFC UUIDv5 requires it. */
function sha1(input: Uint8Array): Uint8Array {
  const paddedLength = Math.ceil((input.length + 9) / 64) * 64;
  const padded = new Uint8Array(paddedLength);
  padded.set(input);
  padded[input.length] = 0x80;

  const paddedView = new DataView(padded.buffer);
  const bitLength = input.length * 8;
  paddedView.setUint32(paddedLength - 8, Math.floor(bitLength / 0x1_0000_0000), false);
  paddedView.setUint32(paddedLength - 4, bitLength >>> 0, false);

  let h0 = 0x6745_2301;
  let h1 = 0xefcd_ab89;
  let h2 = 0x98ba_dcfe;
  let h3 = 0x1032_5476;
  let h4 = 0xc3d2_e1f0;
  const words = new Uint32Array(80);

  for (let offset = 0; offset < paddedLength; offset += 64) {
    for (let index = 0; index < 16; index += 1) {
      words[index] = paddedView.getUint32(offset + index * 4, false);
    }
    for (let index = 16; index < words.length; index += 1) {
      const wordA = words[index - 3];
      const wordB = words[index - 8];
      const wordC = words[index - 14];
      const wordD = words[index - 16];
      if (
        wordA === undefined ||
        wordB === undefined ||
        wordC === undefined ||
        wordD === undefined
      ) {
        throw new Error('SHA-1 word schedule was incomplete.');
      }
      words[index] = rotateLeft(wordA ^ wordB ^ wordC ^ wordD, 1);
    }

    let a = h0;
    let b = h1;
    let c = h2;
    let d = h3;
    let e = h4;

    for (let index = 0; index < words.length; index += 1) {
      let f: number;
      let k: number;
      if (index < 20) {
        f = (b & c) | (~b & d);
        k = 0x5a82_7999;
      } else if (index < 40) {
        f = b ^ c ^ d;
        k = 0x6ed9_eba1;
      } else if (index < 60) {
        f = (b & c) | (b & d) | (c & d);
        k = 0x8f1b_bcdc;
      } else {
        f = b ^ c ^ d;
        k = 0xca62_c1d6;
      }

      const word = words[index];
      if (word === undefined) {
        throw new Error('SHA-1 round word was missing.');
      }
      const temporary = (rotateLeft(a, 5) + f + e + k + word) >>> 0;
      e = d;
      d = c;
      c = rotateLeft(b, 30);
      b = a;
      a = temporary;
    }

    h0 = (h0 + a) >>> 0;
    h1 = (h1 + b) >>> 0;
    h2 = (h2 + c) >>> 0;
    h3 = (h3 + d) >>> 0;
    h4 = (h4 + e) >>> 0;
  }

  const output = new Uint8Array(20);
  const outputView = new DataView(output.buffer);
  outputView.setUint32(0, h0, false);
  outputView.setUint32(4, h1, false);
  outputView.setUint32(8, h2, false);
  outputView.setUint32(12, h3, false);
  outputView.setUint32(16, h4, false);
  return output;
}
