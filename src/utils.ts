import { createHash, randomBytes } from 'node:crypto';

import type { HashAlgorithm, JsonValue } from './types.js';

const encoder = new TextEncoder();
const CROCKFORD_BASE32 = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

export function base64Encode(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('base64');
}

export function base64Decode(value: string): Uint8Array {
  return new Uint8Array(Buffer.from(value, 'base64'));
}

export function toJsonValue(value: unknown): JsonValue {
  if (value === null) {
    return null;
  }

  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }

  if (value === undefined) {
    return null;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (value instanceof Uint8Array || Buffer.isBuffer(value)) {
    return base64Encode(value);
  }

  if (Array.isArray(value)) {
    return value.map((entry) => toJsonValue(entry));
  }

  if (typeof value === 'object') {
    const result: Record<string, JsonValue> = {};

    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      if (entry !== undefined) {
        result[key] = toJsonValue(entry);
      }
    }

    return result;
  }

  return String(value);
}

export function sortJsonValue(value: JsonValue): JsonValue {
  if (Array.isArray(value)) {
    return value.map((entry) => sortJsonValue(entry));
  }

  if (value && typeof value === 'object') {
    const sorted: Record<string, JsonValue> = {};
    for (const key of Object.keys(value).sort()) {
      sorted[key] = sortJsonValue(value[key]);
    }
    return sorted;
  }

  return value;
}

export function canonicalJsonBytes(value: unknown): Uint8Array {
  const jsonValue = sortJsonValue(toJsonValue(value));
  return encoder.encode(JSON.stringify(jsonValue));
}

export function bytesForHash(value: unknown): Uint8Array {
  if (typeof value === 'string') {
    return encoder.encode(value);
  }

  if (value instanceof Uint8Array || Buffer.isBuffer(value)) {
    return new Uint8Array(value);
  }

  return canonicalJsonBytes(value);
}

export function hashBytes(bytes: Uint8Array, algorithm: HashAlgorithm): string {
  const hash = createHash(algorithm);
  hash.update(bytes);
  return `${algorithm}:${hash.digest('hex')}`;
}

export function hashValue(value: unknown, algorithm: HashAlgorithm): string {
  return hashBytes(bytesForHash(value), algorithm);
}

function encodeCrockford(value: bigint, length: number): string {
  let result = '';
  let remaining = value;

  for (let index = 0; index < length; index += 1) {
    result = CROCKFORD_BASE32[Number(remaining & 31n)] + result;
    remaining >>= 5n;
  }

  return result;
}

export function generateUlid(timestamp = Date.now()): string {
  const random = randomBytes(10);
  let randomValue = 0n;

  for (const byte of random) {
    randomValue = (randomValue << 8n) | BigInt(byte);
  }

  return `${encodeCrockford(BigInt(timestamp), 10)}${encodeCrockford(randomValue, 16)}`;
}

export function normalizeError(error: unknown, fallback: string): Error {
  if (error instanceof Error) {
    return error;
  }

  return new Error(fallback);
}
