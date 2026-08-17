/** Dependency-free canonical base64 for bounded native byte transport. */

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const ENCODE_CHUNK_BYTES = 12_288;

export function encodeBase64Bytes(bytes: Uint8Array): string {
  const chunks: string[] = [];
  for (let start = 0; start < bytes.length; start += ENCODE_CHUNK_BYTES) {
    const end = Math.min(bytes.length, start + ENCODE_CHUNK_BYTES);
    let chunk = '';
    for (let index = start; index < end; index += 3) {
      const first = bytes[index] ?? 0;
      const hasSecond = index + 1 < end;
      const hasThird = index + 2 < end;
      const second = bytes[index + 1] ?? 0;
      const third = bytes[index + 2] ?? 0;
      chunk += ALPHABET.charAt(first >> 2);
      chunk += ALPHABET.charAt(((first & 3) << 4) | (second >> 4));
      chunk += hasSecond ? ALPHABET.charAt(((second & 15) << 2) | (third >> 6)) : '=';
      chunk += hasThird ? ALPHABET.charAt(third & 63) : '=';
    }
    chunks.push(chunk);
  }
  return chunks.join('');
}

export function decodedBase64ByteLength(value: string): number | null {
  if (value.length % 4 !== 0) return null;
  if (value.length === 0) return 0;
  const padding = value.endsWith('==') ? 2 : value.endsWith('=') ? 1 : 0;
  const dataLength = value.length - padding;
  if (dataLength < 2) return null;
  for (let index = 0; index < dataLength; index += 1) {
    if (sextet(value[index]) < 0) return null;
  }
  for (let index = dataLength; index < value.length; index += 1) {
    if (value[index] !== '=') return null;
  }
  const length = (value.length / 4) * 3 - padding;
  const lastData = sextet(value[value.length - padding - 1]);
  if ((padding === 2 && (lastData & 15) !== 0) || (padding === 1 && (lastData & 3) !== 0)) {
    return null;
  }
  return length;
}

export function decodeBase64Bytes(value: string, maximumBytes: number): Uint8Array | null {
  const length = decodedBase64ByteLength(value);
  if (length === null || length > maximumBytes) return null;
  const result = new Uint8Array(length);
  let output = 0;
  for (let index = 0; index < value.length; index += 4) {
    const first = sextet(value[index]);
    const second = sextet(value[index + 1]);
    const third = value[index + 2] === '=' ? 0 : sextet(value[index + 2]);
    const fourth = value[index + 3] === '=' ? 0 : sextet(value[index + 3]);
    if (output < length) result[output] = (first << 2) | (second >> 4);
    if (output + 1 < length) result[output + 1] = ((second & 15) << 4) | (third >> 2);
    if (output + 2 < length) result[output + 2] = ((third & 3) << 6) | fourth;
    output += 3;
  }
  return result;
}

function sextet(character: string | undefined): number {
  if (character === undefined) return -1;
  const code = character.charCodeAt(0);
  if (code >= 65 && code <= 90) return code - 65;
  if (code >= 97 && code <= 122) return code - 97 + 26;
  if (code >= 48 && code <= 57) return code - 48 + 52;
  return code === 43 ? 62 : code === 47 ? 63 : -1;
}
