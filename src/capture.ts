import type { HashAlgorithm } from './types.js';
import { canonicalJsonBytes, hashValue } from './utils.js';

export interface CaptureResult {
  inputsHash: string;
  outputsHash: string;
}

export function captureHashes(
  input: unknown,
  output: unknown,
  algorithm: HashAlgorithm = 'sha256',
): CaptureResult {
  return {
    inputsHash: hashValue(input, algorithm),
    outputsHash: hashValue(output, algorithm),
  };
}

export function canonicalPayloadBytes(payload: unknown): Uint8Array {
  return canonicalJsonBytes(payload);
}
