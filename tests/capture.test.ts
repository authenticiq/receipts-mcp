import { describe, expect, it } from 'vitest';

import { canonicalPayloadBytes, captureHashes } from '../src/capture.js';

describe('capture', () => {
  it('produces stable hashes for the same object with different key order', () => {
    const left = captureHashes({ b: 2, a: 1 }, { ok: true });
    const right = captureHashes({ a: 1, b: 2 }, { ok: true });

    expect(left.inputsHash).toBe(right.inputsHash);
    expect(left.outputsHash).toBe(right.outputsHash);
  });

  it('canonicalizes payload bytes deterministically', () => {
    const left = canonicalPayloadBytes({ z: 1, a: { d: 2, c: 1 } });
    const right = canonicalPayloadBytes({ a: { c: 1, d: 2 }, z: 1 });

    expect(Buffer.from(left).toString('utf8')).toBe(Buffer.from(right).toString('utf8'));
  });
});
