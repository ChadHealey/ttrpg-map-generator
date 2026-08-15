import { describe, expect, it } from 'vitest';

import { sha256 } from './sha-256.js';

describe('SHA-256', () => {
  it.each([
    ['', 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'],
    ['abc', 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'],
    ['a'.repeat(64), 'ffe054fe7ae0cb6dc65c3af9b61d5209f439851db43d0ba5997337df154668eb'],
  ])('matches a standard digest across padding boundaries', (input, expected) => {
    const digest = sha256(new TextEncoder().encode(input));
    expect(Array.from(digest, (byte) => byte.toString(16).padStart(2, '0')).join('')).toBe(
      expected,
    );
  });
});
