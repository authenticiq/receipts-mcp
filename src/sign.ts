import { ml_dsa87 } from '@noble/post-quantum/ml-dsa.js';
import { randomBytes } from 'node:crypto';

import { captureHashes, canonicalPayloadBytes } from './capture.js';
import {
  KEY_FIXTURE_SCHEMA_VERSION,
  RECEIPT_SCHEMA_VERSION,
  type EmitReceiptInput,
  type PublicKeyFixture,
  type ReceiptEmission,
  type ReceiptPayload,
  type ReceiptSigner,
} from './types.js';
import { base64Encode, generateUlid } from './utils.js';

export function createMlDsa87Signer(options: {
  keyId?: string;
  seed?: Uint8Array;
} = {}): ReceiptSigner {
  const seed = options.seed ?? randomBytes(32);
  const keys = ml_dsa87.keygen(seed);

  return {
    alg: 'ml-dsa87',
    keyId: options.keyId ?? 'ml-dsa87-dev',
    publicKey: keys.publicKey,
    sign(message: Uint8Array): Uint8Array {
      return ml_dsa87.sign(message, keys.secretKey);
    },
  };
}

export async function emitSignedReceipt(
  input: EmitReceiptInput,
  signer: ReceiptSigner,
): Promise<ReceiptEmission> {
  const hashes = captureHashes(input.input, input.output, input.hashAlgorithm ?? 'sha256');

  const payload: ReceiptPayload = {
    event_type: input.eventType,
    actor: input.actor,
    tool: input.tool,
    inputs_hash: hashes.inputsHash,
    outputs_hash: hashes.outputsHash,
    ...(input.parentReceiptId ? { parent_receipt_id: input.parentReceiptId } : {}),
  };

  const signatureBytes = await signer.sign(canonicalPayloadBytes(payload));
  const publicKey: PublicKeyFixture = {
    schema_version: KEY_FIXTURE_SCHEMA_VERSION,
    key_id: signer.keyId,
    alg: signer.alg,
    encoding: 'base64',
    value: base64Encode(signer.publicKey),
  };

  return {
    receipt: {
      schema_version: RECEIPT_SCHEMA_VERSION,
      receipt_id: input.receiptId ?? generateUlid(),
      issued_at: input.issuedAt ?? new Date().toISOString(),
      payload,
      signature: {
        alg: signer.alg,
        key_id: signer.keyId,
        encoding: 'base64',
        value: base64Encode(signatureBytes),
      },
    },
    publicKey,
  };
}
