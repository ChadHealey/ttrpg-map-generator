/** Dependency-free FIPS PUB 180-4 SHA-256 for deterministic seed derivation. */

const INITIAL_HASH = [
  0x6a09_e667, 0xbb67_ae85, 0x3c6e_f372, 0xa54f_f53a, 0x510e_527f, 0x9b05_688c, 0x1f83_d9ab,
  0x5be0_cd19,
] as const;

const ROUND_CONSTANTS = [
  0x428a_2f98, 0x7137_4491, 0xb5c0_fbcf, 0xe9b5_dba5, 0x3956_c25b, 0x59f1_11f1, 0x923f_82a4,
  0xab1c_5ed5, 0xd807_aa98, 0x1283_5b01, 0x2431_85be, 0x550c_7dc3, 0x72be_5d74, 0x80de_b1fe,
  0x9bdc_06a7, 0xc19b_f174, 0xe49b_69c1, 0xefbe_4786, 0x0fc1_9dc6, 0x240c_a1cc, 0x2de9_2c6f,
  0x4a74_84aa, 0x5cb0_a9dc, 0x76f9_88da, 0x983e_5152, 0xa831_c66d, 0xb003_27c8, 0xbf59_7fc7,
  0xc6e0_0bf3, 0xd5a7_9147, 0x06ca_6351, 0x1429_2967, 0x27b7_0a85, 0x2e1b_2138, 0x4d2c_6dfc,
  0x5338_0d13, 0x650a_7354, 0x766a_0abb, 0x81c2_c92e, 0x9272_2c85, 0xa2bf_e8a1, 0xa81a_664b,
  0xc24b_8b70, 0xc76c_51a3, 0xd192_e819, 0xd699_0624, 0xf40e_3585, 0x106a_a070, 0x19a4_c116,
  0x1e37_6c08, 0x2748_774c, 0x34b0_bcb5, 0x391c_0cb3, 0x4ed8_aa4a, 0x5b9c_ca4f, 0x682e_6ff3,
  0x748f_82ee, 0x78a5_636f, 0x84c8_7814, 0x8cc7_0208, 0x90be_fffa, 0xa450_6ceb, 0xbef9_a3f7,
  0xc671_78f2,
] as const;

function rotateRight(value: number, bits: number): number {
  return ((value >>> bits) | (value << (32 - bits))) >>> 0;
}

function add32(...values: readonly number[]): number {
  let result = 0;
  for (const value of values) {
    result = (result + value) >>> 0;
  }
  return result;
}

/** Return the standard 32-byte SHA-256 digest of the supplied bytes. */
export function sha256(input: Uint8Array): Uint8Array {
  const bitLength = BigInt(input.byteLength) * 8n;
  const paddedLength = Math.ceil((input.byteLength + 9) / 64) * 64;
  const padded = new Uint8Array(paddedLength);
  padded.set(input);
  padded[input.byteLength] = 0x80;

  const paddedView = new DataView(padded.buffer);
  paddedView.setUint32(paddedLength - 8, Number((bitLength >> 32n) & 0xffff_ffffn), false);
  paddedView.setUint32(paddedLength - 4, Number(bitLength & 0xffff_ffffn), false);

  const hash: number[] = [...INITIAL_HASH];
  const words = new Uint32Array(64);
  for (let offset = 0; offset < paddedLength; offset += 64) {
    for (let index = 0; index < 16; index += 1) {
      words[index] = paddedView.getUint32(offset + index * 4, false);
    }
    for (let index = 16; index < words.length; index += 1) {
      const word15 = words[index - 15];
      const word2 = words[index - 2];
      const word16 = words[index - 16];
      const word7 = words[index - 7];
      if (
        word15 === undefined ||
        word2 === undefined ||
        word16 === undefined ||
        word7 === undefined
      ) {
        throw new Error('SHA-256 word schedule was incomplete.');
      }
      const sigma0 = rotateRight(word15, 7) ^ rotateRight(word15, 18) ^ (word15 >>> 3);
      const sigma1 = rotateRight(word2, 17) ^ rotateRight(word2, 19) ^ (word2 >>> 10);
      words[index] = add32(word16, sigma0, word7, sigma1);
    }

    let a = hash[0] ?? 0;
    let b = hash[1] ?? 0;
    let c = hash[2] ?? 0;
    let d = hash[3] ?? 0;
    let e = hash[4] ?? 0;
    let f = hash[5] ?? 0;
    let g = hash[6] ?? 0;
    let h = hash[7] ?? 0;

    for (let index = 0; index < words.length; index += 1) {
      const word = words[index];
      const roundConstant = ROUND_CONSTANTS[index];
      if (word === undefined || roundConstant === undefined) {
        throw new Error('SHA-256 round input was missing.');
      }
      const sum1 = rotateRight(e, 6) ^ rotateRight(e, 11) ^ rotateRight(e, 25);
      const choice = (e & f) ^ (~e & g);
      const temporary1 = add32(h, sum1, choice, roundConstant, word);
      const sum0 = rotateRight(a, 2) ^ rotateRight(a, 13) ^ rotateRight(a, 22);
      const majority = (a & b) ^ (a & c) ^ (b & c);
      const temporary2 = add32(sum0, majority);

      h = g;
      g = f;
      f = e;
      e = add32(d, temporary1);
      d = c;
      c = b;
      b = a;
      a = add32(temporary1, temporary2);
    }

    hash[0] = add32(hash[0] ?? 0, a);
    hash[1] = add32(hash[1] ?? 0, b);
    hash[2] = add32(hash[2] ?? 0, c);
    hash[3] = add32(hash[3] ?? 0, d);
    hash[4] = add32(hash[4] ?? 0, e);
    hash[5] = add32(hash[5] ?? 0, f);
    hash[6] = add32(hash[6] ?? 0, g);
    hash[7] = add32(hash[7] ?? 0, h);
  }

  const digest = new Uint8Array(32);
  const digestView = new DataView(digest.buffer);
  for (const [index, word] of hash.entries()) {
    digestView.setUint32(index * 4, word, false);
  }
  return digest;
}
