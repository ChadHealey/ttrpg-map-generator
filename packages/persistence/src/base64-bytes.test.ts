import { describe, expect, it } from 'vitest';

import { decodeBase64Bytes, decodedBase64ByteLength, encodeBase64Bytes } from './base64-bytes.js';

describe('canonical native base64 byte transport', () => {
  it.each([
    [[], ''],
    [[1], 'AQ=='],
    [[1, 2], 'AQI='],
    [[1, 2, 3], 'AQID'],
    [[0, 127, 128, 255], 'AH+A/w=='],
  ] as const)('round-trips %j', (source, encoded) => {
    const bytes = Uint8Array.from(source);
    expect(encodeBase64Bytes(bytes)).toBe(encoded);
    expect(Array.from(decodeBase64Bytes(encoded, bytes.length) ?? [])).toStrictEqual([...source]);
    expect(decodedBase64ByteLength(encoded)).toBe(bytes.length);
  });

  it('preserves bytes across the bounded encoder chunk boundary', () => {
    const source = Uint8Array.from({ length: 12_293 }, (_, index) => (index * 37) & 255);
    const encoded = encodeBase64Bytes(source);
    expect(decodeBase64Bytes(encoded, source.length)).toStrictEqual(source);
  });

  it.each(['A', 'AQ=', 'AQ===', 'AR==', 'AQJ=', 'AQ==AAAA', ' AQ=='])(
    'rejects malformed or noncanonical input %j',
    (value) => {
      expect(decodedBase64ByteLength(value)).toBeNull();
      expect(decodeBase64Bytes(value, 10)).toBeNull();
    },
  );

  it('rejects decoded data beyond the explicit byte bound', () => {
    expect(decodeBase64Bytes('AQID', 2)).toBeNull();
  });
});
